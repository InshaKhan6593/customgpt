import { generateText } from "ai";
import { langfuseSpanProcessor } from "@/instrumentation";

/**
 * A utility to truncate text to a maximum token approximation
 * before sending it to the next agent to prevent context overflow.
 * 
 * Assumes a rough estimate of 1 token ≈ 4 characters.
 */
export function truncateTextToTokenBudget(text: string | undefined | null, maxTokens: number): string {
    if (!text) return "";

    const maxLength = maxTokens * 4;
    if (text.length <= maxLength) {
        return text;
    }

    const truncatedText = text.substring(0, maxLength);
    return truncatedText + "\n...[Content truncated due to length limits]...";
}

/**
 * Truncate a Vercel AI SDK messages array to fit within a token budget.
 * Keeps the most recent messages. Uses a rough estimate of 1 token ≈ 4 chars.
 * Always preserves at least the last message.
 */
export function truncateMessages(messages: any[], maxTokens: number): any[] {
    const estimateTokens = (msg: any): number => {
        const content = msg.content
        if (typeof content === "string") return Math.ceil(content.length / 4)
        if (Array.isArray(content)) {
            return content.reduce((sum: number, part: any) => {
                if (part.type === "text") return sum + Math.ceil((part.text?.length || 0) / 4)
                if (part.type === "tool-call") return sum + Math.ceil(JSON.stringify(part.args || {}).length / 4) + 20
                if (part.type === "tool-result") return sum + Math.ceil(JSON.stringify(part.result || "").length / 4) + 20
                return sum + 50
            }, 0)
        }
        return 50
    }

    let totalTokens = 0
    let startIndex = messages.length

    for (let i = messages.length - 1; i >= 0; i--) {
        const tokens = estimateTokens(messages[i])
        if (totalTokens + tokens > maxTokens && i < messages.length - 1) break
        totalTokens += tokens
        startIndex = i
    }


    return messages.slice(startIndex)
}

/**
 * Mid-flight auto-compaction mechanism for long-running Agent loops.
 * 
 * To be used inside `experimental_prepareStep`. If the current message loop exceeds
 * `maxTokens`, this will slice out the oldest history, run a fast background LLM 
 * summarization call, and replace the old history with a single "system" summary message.
 * 
 * @param messages The full conversation history up to this loop step.
 * @param maxTokens The approximate token buffer limit to trigger compaction.
 * @param summarizationModel The fast, cheap model to use for the compaction step.
 * @returns A compacted array of messages.
 */
export async function autoCompactMessages(
    messages: any[],
    maxTokens: number,
    summarizationModel: any
): Promise<any[]> {
    const estimateTokens = (msg: any): number => {
        const content = msg.content;
        if (typeof content === "string") return Math.ceil(content.length / 4);
        if (Array.isArray(content)) {
            return content.reduce((sum: number, part: any) => {
                if (part.type === "text") return sum + Math.ceil((part.text?.length || 0) / 4);
                if (part.type === "tool-call") return sum + Math.ceil(JSON.stringify(part.args || {}).length / 4) + 20;
                if (part.type === "tool-result") return sum + Math.ceil(JSON.stringify(part.result || "").length / 4) + 20;
                return sum + 50;
            }, 0);
        }
        return 50;
    };

    let totalTokens = 0;
    for (const msg of messages) {
        totalTokens += estimateTokens(msg);
    }

    // If we're under the budget, just proceed normally.
    if (totalTokens <= maxTokens) {
        return messages;
    }

    console.log(`[Auto-Compaction] Token budget exceeded (${totalTokens} > ${maxTokens}). Triggering summary buffer...`);

    // Always preserve the very first system message if it exists
    const hasSystemPrompt = messages.length > 0 && messages[0].role === "system";
    const systemPromptMsg = hasSystemPrompt ? messages[0] : null;

    // We need to keep a few of the most recent messages so the agent doesn't lose immediate context of the current step.
    const RECENT_MESSAGES_TO_KEEP = 6;

    // Safety check: if there aren't enough messages to compact, just truncate to prevent a crash
    if (messages.length <= RECENT_MESSAGES_TO_KEEP + (hasSystemPrompt ? 1 : 0)) {
        return truncateMessages(messages, maxTokens);
    }

    const startIndex = hasSystemPrompt ? 1 : 0;
    const splitIndex = messages.length - RECENT_MESSAGES_TO_KEEP;

    const messagesToSummarize = messages.slice(startIndex, splitIndex);
    const recentMessages = messages.slice(splitIndex);

    try {
        const { text: summary } = await generateText({
            model: summarizationModel,
            system: "You are an internal system memory compactor. Your job is to take the following raw conversation history and tool outputs, and write a highly dense, factual summary. Preserve all critical entities, findings, tool results, and the original user intent. Do not include conversational filler.",
            messages: messagesToSummarize as any,
            experimental_telemetry: {
                isEnabled: true,
                metadata: {
                    action: "auto-compaction",
                    originalLength: messagesToSummarize.length,
                }
            }
        });

        const compactedMessages: any[] = [];
        if (systemPromptMsg) {
            compactedMessages.push(systemPromptMsg as any);
        }

        compactedMessages.push({
            role: "system",
            content: `[SYSTEM MEMORY BUFFER: The following is a summary of earlier steps in this task to save memory]\n\n${summary}`
        });

        compactedMessages.push(...recentMessages as any[]);

        console.log(`[Auto-Compaction] Successfully compacted ${messagesToSummarize.length} messages down to 1 summary message.`);

        // Ensure background trace gets sent out immediately before returning to orchestrator
        try {
            await langfuseSpanProcessor.forceFlush();
        } catch (flushErr) {
            console.warn("[Auto-Compaction] Failed to flush langfuse tracer:", flushErr);
        }

        return compactedMessages;

    } catch (error) {
        console.error("[Auto-Compaction] Failed to summarize. Falling back to hard truncation.", error);
        return truncateMessages(messages, maxTokens);
    }
}
