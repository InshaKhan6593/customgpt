export const APP_NAME = "WebletGPT";
export const APP_DESCRIPTION = "The easiest way to build, share, and monetize AI agents.";
export { PLATFORM_FEE_RATE } from "@/lib/billing/pricing";

// Platform Feature Flags & Configs
export const ENABLE_PAYMENT_ENFORCEMENT = process.env.ENABLE_PAYMENT_ENFORCEMENT === "true";

// File Upload Limits
export const MAX_KNOWLEDGE_FILES = 10;
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Chat Limits
export const MAX_MESSAGES_PER_SESSION = 100;

// Builder Limits (aligned with OpenAI GPT Builder)
export const MAX_INSTRUCTIONS_LENGTH = 8000; // 8,000 characters for system prompt
export const MAX_CONVERSATION_STARTERS = 4;  // Max 4 conversation starters
