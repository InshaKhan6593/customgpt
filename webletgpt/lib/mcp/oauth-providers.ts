/**
 * Platform-level OAuth 2.1 provider configurations for MCP servers.
 *
 * Each entry maps a catalog ID to the OAuth endpoints, scopes, and
 * environment variable names for the platform's registered OAuth app.
 * One OAuth app per provider for the entire platform (not per-developer).
 */

export type OAuthProviderConfig = {
    catalogId: string
    authorizationUrl: string
    tokenUrl: string
    scopes: string[]
    clientIdEnvVar: string
    clientSecretEnvVar: string
    extraAuthParams?: Record<string, string>
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
    github: {
        catalogId: "github",
        authorizationUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scopes: ["repo", "read:org", "read:user"],
        clientIdEnvVar: "MCP_GITHUB_CLIENT_ID",
        clientSecretEnvVar: "MCP_GITHUB_CLIENT_SECRET",
    },
    slack: {
        catalogId: "slack",
        authorizationUrl: "https://slack.com/oauth/v2/authorize",
        tokenUrl: "https://slack.com/api/oauth.v2.access",
        scopes: ["channels:read", "chat:write", "search:read"],
        clientIdEnvVar: "MCP_SLACK_CLIENT_ID",
        clientSecretEnvVar: "MCP_SLACK_CLIENT_SECRET",
    },
    "google-drive": {
        catalogId: "google-drive",
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        clientIdEnvVar: "MCP_GOOGLE_CLIENT_ID",
        clientSecretEnvVar: "MCP_GOOGLE_CLIENT_SECRET",
        extraAuthParams: { access_type: "offline", prompt: "consent" },
    },
    notion: {
        catalogId: "notion",
        authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
        tokenUrl: "https://api.notion.com/v1/oauth/token",
        scopes: [],
        clientIdEnvVar: "MCP_NOTION_CLIENT_ID",
        clientSecretEnvVar: "MCP_NOTION_CLIENT_SECRET",
        extraAuthParams: { owner: "user" },
    },
    figma: {
        catalogId: "figma",
        authorizationUrl: "https://www.figma.com/oauth",
        tokenUrl: "https://api.figma.com/v1/oauth/token",
        scopes: ["files:read"],
        clientIdEnvVar: "MCP_FIGMA_CLIENT_ID",
        clientSecretEnvVar: "MCP_FIGMA_CLIENT_SECRET",
    },
}

export function getOAuthProvider(catalogId: string | null | undefined): OAuthProviderConfig | undefined {
    if (!catalogId) return undefined
    return OAUTH_PROVIDERS[catalogId]
}
