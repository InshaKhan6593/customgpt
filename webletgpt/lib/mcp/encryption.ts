import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
    const key = process.env.MCP_ENCRYPTION_KEY
    if (!key) {
        throw new Error("MCP_ENCRYPTION_KEY environment variable is not set")
    }
    // Key must be 32 bytes for AES-256
    return crypto.createHash("sha256").update(key).digest()
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Returns the encrypted text and IV (both as hex strings).
 */
export function encryptToken(plaintext: string): { encrypted: string; iv: string } {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    })

    let encrypted = cipher.update(plaintext, "utf8", "hex")
    encrypted += cipher.final("hex")

    // Append the auth tag to the encrypted data
    const authTag = cipher.getAuthTag()
    encrypted += authTag.toString("hex")

    return {
        encrypted,
        iv: iv.toString("hex"),
    }
}

/**
 * Decrypt an encrypted token using AES-256-GCM.
 */
export function decryptToken(encryptedHex: string, ivHex: string): string {
    const key = getEncryptionKey()
    const iv = Buffer.from(ivHex, "hex")

    // Separate the auth tag from the encrypted data
    const authTagStart = encryptedHex.length - AUTH_TAG_LENGTH * 2
    const encData = encryptedHex.slice(0, authTagStart)
    const authTag = Buffer.from(encryptedHex.slice(authTagStart), "hex")

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encData, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
}
