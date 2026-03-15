import type { MCPCatalogEntry } from "./config"

/**
 * Curated registry of popular MCP servers.
 *
 * These appear in the "Popular Integrations" dropdown in the builder's MCP tab.
 * Server URLs point to the publicly documented MCP endpoints for each service.
 * Creators pick one, authenticate, and the platform discovers available tools.
 */
export const MCP_CATALOG: MCPCatalogEntry[] = [
    {
        id: "github",
        name: "GitHub",
        description: "Create issues, manage repos, pull requests, and code search",
        serverUrl: "https://api.githubcopilot.com/mcp",
        iconUrl: "/mcp-icons/github.svg",
        authType: "OAUTH",
        category: "developer",
    },
    {
        id: "slack",
        name: "Slack",
        description: "Send messages, manage channels, search workspace history",
        serverUrl: "https://mcp.slack.com/sse",
        iconUrl: "/mcp-icons/slack.svg",
        authType: "OAUTH",
        category: "communication",
    },
    {
        id: "google-drive",
        name: "Google Drive",
        description: "Search, read, and manage files in Google Drive",
        serverUrl: "https://mcp.google.com/drive",
        iconUrl: "/mcp-icons/google-drive.svg",
        authType: "OAUTH",
        category: "productivity",
    },
    {
        id: "notion",
        name: "Notion",
        description: "Query databases, create pages, search workspace content",
        serverUrl: "https://mcp.notion.com/sse",
        iconUrl: "/mcp-icons/notion.svg",
        authType: "BEARER_TOKEN",
        category: "productivity",
    },
    {
        id: "figma",
        name: "Figma",
        description: "Extract design data, components, and layout information",
        serverUrl: "https://mcp.figma.com/sse",
        iconUrl: "/mcp-icons/figma.svg",
        authType: "BEARER_TOKEN",
        category: "design",
    },
    {
        id: "supabase",
        name: "Supabase",
        description: "Query and manage Supabase databases, auth, and storage",
        serverUrl: "https://mcp.supabase.com/sse",
        iconUrl: "/mcp-icons/supabase.svg",
        authType: "API_KEY",
        category: "database",
    },
    {
        id: "stripe",
        name: "Stripe",
        description: "Manage customers, subscriptions, invoices, and payments",
        serverUrl: "https://mcp.stripe.com/sse",
        iconUrl: "/mcp-icons/stripe.svg",
        authType: "API_KEY",
        category: "payments",
    },
    {
        id: "linear",
        name: "Linear",
        description: "Create issues, manage projects, track progress and sprints",
        serverUrl: "https://mcp.linear.app/sse",
        iconUrl: "/mcp-icons/linear.svg",
        authType: "API_KEY",
        category: "project_management",
    },
    {
        id: "brave-search",
        name: "Brave Search",
        description: "Search the web with privacy-first Brave Search API",
        serverUrl: "https://mcp.brave.com/sse",
        iconUrl: "/mcp-icons/brave.svg",
        authType: "API_KEY",
        category: "search",
    },
    {
        id: "postgres",
        name: "PostgreSQL",
        description: "Connect to any PostgreSQL database for queries and schema inspection",
        serverUrl: "", // Custom — user provides their own connection URL
        iconUrl: "/mcp-icons/postgres.svg",
        authType: "API_KEY",
        category: "database",
    },
]

/** Look up a catalog entry by its ID */
export function getCatalogEntry(catalogId: string): MCPCatalogEntry | undefined {
    return MCP_CATALOG.find((entry) => entry.id === catalogId)
}
