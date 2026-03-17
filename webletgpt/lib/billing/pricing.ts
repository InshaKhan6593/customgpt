export const CREDITS_BY_TIER = {
  STARTER: 200,
  PRO: 10_000,
  BUSINESS: 50_000,
  ENTERPRISE: -1,
  FREE_USER: 100,
  PLUS: 1_000,
  POWER: -1,
} as const

export const CREDIT_MULTIPLIERS = {
  base: 1,
  fileSearch: 2,
  rag: 2,
  webSearch: 3,
  tavily: 3,
  codeInterpreter: 3,
  e2b: 3,
  imageGeneration: 5,
  dalle: 5,
  custom_action: 2,
  mcp: 2,
} as const

export const MODEL_RATES = {
  "anthropic/claude-3.5-sonnet": { in: 3.0, out: 15.0 },
  "anthropic/claude-3.5-haiku": { in: 0.8, out: 4.0 },
  "anthropic/claude-3-haiku": { in: 0.25, out: 1.25 },
  "anthropic/claude-3-opus": { in: 15.0, out: 75.0 },
  "anthropic/claude-opus-4": { in: 15.0, out: 75.0 },
  "anthropic/claude-opus-4-6": { in: 15.0, out: 75.0 },
  "anthropic/claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "anthropic/claude-haiku-4-5": { in: 0.8, out: 4.0 },
  "openai/gpt-4o": { in: 5.0, out: 15.0 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "openai/gpt-4-turbo": { in: 10.0, out: 30.0 },
  "openai/o1": { in: 15.0, out: 60.0 },
  "openai/o1-mini": { in: 3.0, out: 12.0 },
  "openai/o3-mini": { in: 1.1, out: 4.4 },
  "google/gemini-2.5-flash": { in: 0.15, out: 0.6 },
  "google/gemini-2.5-flash-lite": { in: 0.075, out: 0.3 },
  "google/gemini-2.0-flash": { in: 0.1, out: 0.4 },
  "google/gemini-2.0-flash-001": { in: 0.1, out: 0.4 },
  "google/gemini-1.5-pro": { in: 1.25, out: 5.0 },
  "google/gemini-1.5-flash": { in: 0.075, out: 0.3 },
  "meta-llama/llama-3.3-70b-instruct": { in: 0.2, out: 0.6 },
  "meta-llama/llama-3.1-70b-instruct": { in: 0.2, out: 0.6 },
  "meta-llama/llama-3.1-8b-instruct": { in: 0.05, out: 0.05 },
  "meta-llama/llama-3.2-3b-instruct": { in: 0.015, out: 0.025 },
  "mistral/mistral-large": { in: 8.0, out: 24.0 },
  "mistral/mistral-small": { in: 0.2, out: 0.6 },
  "mistral/mixtral-8x7b-instruct": { in: 0.24, out: 0.24 },
  "deepseek/deepseek-chat": { in: 0.14, out: 0.28 },
  "deepseek/deepseek-r1": { in: 0.55, out: 2.19 },
} as const

export const FALLBACK_MODEL_RATE = { in: 3.0, out: 15.0 } as const

export const TOOL_COSTS_USD = {
  imageGeneration: 0.04,
  webSearch: 0.01,
  codeInterpreter: 0.02,
} as const

export const WORKFLOW_RUNS_BY_TIER = {
  FREE_USER: 2,
  PLUS: 20,
  POWER: 999_999,
} as const

export const PLATFORM_FEE_RATE = 0.15

export const OVERAGE_DEFAULTS = {
  autoReloadAmount: 2000,
  overageRate: 0.005,
} as const

export const RSIL_CREDIT_COST = 10

export const FREE_TIERS = new Set(["STARTER", "FREE_USER"])

export function getCreditsForTier(tier: string): number {
  if (!(tier in CREDITS_BY_TIER)) {
    throw new Error(`Unknown tier: ${tier}`)
  }
  return CREDITS_BY_TIER[tier as keyof typeof CREDITS_BY_TIER]
}

export function getWorkflowRunsForTier(tier: string): number {
  return (
    WORKFLOW_RUNS_BY_TIER[tier as keyof typeof WORKFLOW_RUNS_BY_TIER] ??
    WORKFLOW_RUNS_BY_TIER.FREE_USER
  )
}

export function getModelRate(modelId: string): { in: number; out: number } {
  return MODEL_RATES[modelId as keyof typeof MODEL_RATES] ?? FALLBACK_MODEL_RATE
}

export const USER_PLAN_DISPLAY = [
  {
    tier: "FREE_USER",
    name: "Free",
    price: "$0",
    period: "/mo",
    credits: "100 credits / month",
    features: ["100 credits/month", "2 workflow runs/mo", "All free weblets"],
    popular: false,
  },
  {
    tier: "PLUS",
    name: "Plus",
    price: "$9.99",
    period: "/mo",
    credits: "1,000 credits / month",
    features: ["1,000 credits/month", "20 workflow runs/mo", "Multi-agent (5 agents)", "Priority support"],
    popular: true,
  },
  {
    tier: "POWER",
    name: "Power",
    price: "$19.99",
    period: "/mo",
    credits: "Unlimited credits",
    features: ["Unlimited credits", "Unlimited workflows", "Unlimited multi-agent", "Priority support"],
    popular: false,
  },
] as const

export const DEV_PLAN_DISPLAY = [
  {
    tier: "STARTER",
    name: "Starter",
    price: "$0",
    period: "/mo",
    credits: "200 credits / month",
    features: ["1 weblet", "200 credits/month", "No RSIL", "No composability"],
    popular: false,
  },
  {
    tier: "PRO",
    name: "Pro",
    price: "$29",
    period: "/mo",
    credits: "10,000 credits / month",
    features: ["5 weblets", "10,000 credits/month", "RSIL enabled", "Composability enabled"],
    popular: true,
  },
  {
    tier: "BUSINESS",
    name: "Business",
    price: "$99",
    period: "/mo",
    credits: "50,000 credits / month",
    features: ["Unlimited weblets", "50,000 credits/month", "RSIL + Composability + MCP", "Auto-reload overage"],
    popular: false,
  },
] as const

export const UPGRADE_MESSAGES = {
  user_credits_exceeded: {
    title: "You've run out of credits",
    description:
      "You've used all your free credits this month. Upgrade to Plus for 1,000 credits/month at just $9.99/month.",
    cta: "Upgrade to Plus →",
  },
  developer_credits_exhausted: {
    title: "This weblet is temporarily unavailable",
    description:
      "The creator of this weblet has exceeded their monthly quota. Please try again later or try a different weblet.",
    cta: null,
  },
  default: {
    title: "Upgrade your plan",
    description: "You need more credits to continue. Upgrade your plan to keep chatting.",
    cta: "View Plans →",
  },
} as const
