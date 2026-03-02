// MCP Configuration Types

export type MCPAuthType = "NONE" | "API_KEY" | "BEARER_TOKEN" | "OAUTH"

export type MCPCatalogEntry = {
    id: string
    name: string
    description: string
    serverUrl: string
    iconUrl?: string
    authType: MCPAuthType
    category: "developer" | "communication" | "productivity" | "design" | "database" | "search" | "payments" | "project_management"
}

export type MCPToolDef = {
    name: string
    description: string
    inputSchema?: Record<string, unknown>
}

export type MCPServerStatus = "connected" | "disconnected" | "error" | "discovering"

export type ConnectedMCPServer = {
    id: string
    webletId: string
    serverUrl: string
    label: string
    description: string | null
    iconUrl: string | null
    authType: MCPAuthType
    tools: MCPToolDef[] | null
    isActive: boolean
    requiresUserAuth: boolean
    catalogId: string | null
    createdAt: string
}
