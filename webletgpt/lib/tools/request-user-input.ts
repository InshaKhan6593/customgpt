import { tool } from 'ai'
import { z } from 'zod'

/**
 * Client-side tool: no execute function.
 * When the agent calls this, AI SDK streams the tool call to the client
 * where UI renders a card with the question + optional choices.
 * The user responds via addToolOutput() and the conversation auto-continues.
 */
export const requestUserInputTool = tool({
  description: 'Ask the user a specific question when you need clarification, a decision, or additional information before proceeding. Use this instead of asking in plain text when you need a structured response — for example, choosing between options, confirming an action, or providing specific details.',
  inputSchema: z.object({
    question: z.string().describe('The question to display to the user'),
    options: z.array(z.string()).optional().describe('Optional list of predefined choices the user can pick from'),
    placeholder: z.string().optional().describe('Placeholder text for the free-form text input field'),
    allowFreeText: z.boolean().optional().default(true).describe('Whether to show a free-form text input in addition to options'),
  }),
  // No execute function — this is a client-side tool
})
