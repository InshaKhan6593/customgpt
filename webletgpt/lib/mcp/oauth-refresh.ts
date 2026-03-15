import { decryptToken, encryptToken } from "./encryption"
import { getOAuthProvider } from "./oauth-providers"

type StoredToken = {
    tokenEnc: string
    tokenIv: string
    refreshTokenEnc?: string | null
    refreshTokenIv?: string | null
    expiresAt?: Date | null
    tokenType?: string | null
}

/**
 * Returns a valid access token, refreshing it if needed.
 *
 * - PAT tokens (tokenType !== "oauth") are returned as-is.
 * - OAuth tokens that are still valid (>5 min until expiry) are returned as-is.
 * - OAuth tokens expiring soon are refreshed using the stored refresh token.
 * - Returns null if the token can't be refreshed (triggers re-auth).
 */
export async function getValidAccessToken(
    userToken: StoredToken,
    serverId: string,
    userId: string,
    catalogId: string | null
): Promise<string | null> {
    const accessToken = decryptToken(userToken.tokenEnc, userToken.tokenIv)

    // PAT tokens have no expiry tracking — return as-is
    if (userToken.tokenType !== "oauth" || !userToken.expiresAt) {
        return accessToken
    }

    // Check if token is still valid (>5 min buffer)
    const now = new Date()
    const fiveMinFromNow = new Date(now.getTime() + 5 * 60 * 1000)

    if (userToken.expiresAt > fiveMinFromNow) {
        return accessToken
    }

    // Token is expiring soon or expired — try to refresh
    if (!userToken.refreshTokenEnc || !userToken.refreshTokenIv) {
        return null // No refresh token, user must re-authenticate
    }

    const provider = getOAuthProvider(catalogId)
    if (!provider) {
        return null // No provider config, can't refresh
    }

    const clientId = process.env[provider.clientIdEnvVar]
    const clientSecret = process.env[provider.clientSecretEnvVar]
    if (!clientId || !clientSecret) {
        console.warn(`[MCP OAuth] Missing env vars for ${catalogId} refresh`)
        return null
    }

    const refreshToken = decryptToken(userToken.refreshTokenEnc, userToken.refreshTokenIv)

    try {
        const res = await fetch(provider.tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
            }),
        })

        if (!res.ok) {
            console.warn(`[MCP OAuth] Refresh failed for ${catalogId}: ${res.status}`)
            return null
        }

        const data = await res.json()
        const newAccessToken = data.access_token
        if (!newAccessToken) return null

        // Encrypt and update tokens in DB
        const { prisma } = await import("@/lib/prisma")
        const encAccess = encryptToken(newAccessToken)

        const updateData: Record<string, any> = {
            tokenEnc: encAccess.encrypted,
            tokenIv: encAccess.iv,
            expiresAt: data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000)
                : null,
        }

        // Some providers rotate refresh tokens
        if (data.refresh_token) {
            const encRefresh = encryptToken(data.refresh_token)
            updateData.refreshTokenEnc = encRefresh.encrypted
            updateData.refreshTokenIv = encRefresh.iv
        }

        await prisma.userMCPToken.update({
            where: { userId_serverId: { userId, serverId } },
            data: updateData,
        })

        return newAccessToken
    } catch (err) {
        console.error(`[MCP OAuth] Refresh error for ${catalogId}:`, err)
        return null
    }
}
