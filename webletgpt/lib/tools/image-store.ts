/**
 * File-system-backed image store for generated images.
 *
 * Images are saved to `data/generated-images/` as binary files so they
 * persist across dev server restarts, HMR reloads, and serverless
 * cold starts (in development).
 *
 * The `/api/image/[id]` route reads from this folder to serve images.
 */

import { randomUUID } from "crypto"
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from "fs"
import path from "path"

interface ImageMeta {
    mimeType: string
    createdAt: number
}

const IMAGES_DIR = path.join(process.cwd(), "data", "generated-images")
const META_SUFFIX = ".meta.json"
const MAX_IMAGES = Number(process.env.IMAGE_STORE_MAX_ENTRIES) || 500
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  // 10 MB per image

// Ensure directory exists on startup
if (!existsSync(IMAGES_DIR)) {
    mkdirSync(IMAGES_DIR, { recursive: true })
}

/**
 * Evict oldest images when over the limit.
 */
function evictIfNeeded(): void {
    try {
        const files = readdirSync(IMAGES_DIR).filter(f => !f.endsWith(META_SUFFIX))
        if (files.length <= MAX_IMAGES) return

        // Sort by creation time, evict oldest
        const withTime = files.map(f => ({
            name: f,
            time: statSync(path.join(IMAGES_DIR, f)).mtimeMs,
        })).sort((a, b) => a.time - b.time)

        const toRemove = withTime.slice(0, files.length - MAX_IMAGES)
        for (const { name } of toRemove) {
            try {
                unlinkSync(path.join(IMAGES_DIR, name))
                unlinkSync(path.join(IMAGES_DIR, name + META_SUFFIX))
            } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
}

/**
 * Store a base64 image to disk and return the ID.
 *
 * @param base64 - raw base64 image data (no `data:` prefix)
 * @param mimeType - e.g. "image/png"
 * @returns the generated image ID
 */
export function storeImage(base64: string, mimeType: string = "image/png"): string {
    const estimatedBytes = Math.ceil(base64.length * 0.75)
    if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(`Image too large (${(estimatedBytes / 1024 / 1024).toFixed(1)}MB). Max: ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`)
    }

    evictIfNeeded()

    const id = randomUUID()
    const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg"
        : mimeType.includes("webp") ? "webp"
            : "png"

    const filePath = path.join(IMAGES_DIR, `${id}.${ext}`)
    const metaPath = path.join(IMAGES_DIR, `${id}.${ext}${META_SUFFIX}`)

    // Write binary image file
    const buffer = Buffer.from(base64, "base64")
    writeFileSync(filePath, buffer)

    // Write metadata
    const meta: ImageMeta = { mimeType, createdAt: Date.now() }
    writeFileSync(metaPath, JSON.stringify(meta))

    return `${id}.${ext}`
}

/**
 * Retrieve a stored image by ID (filename).
 * Returns null if not found.
 */
export function getImage(id: string): { data: Buffer; mimeType: string } | null {
    // Sanitize: only allow uuid.ext format
    if (!/^[0-9a-f-]+\.(png|jpg|webp)$/i.test(id)) return null

    const filePath = path.join(IMAGES_DIR, id)
    const metaPath = path.join(IMAGES_DIR, id + META_SUFFIX)

    if (!existsSync(filePath)) return null

    try {
        const data = readFileSync(filePath)
        let mimeType = "image/png"
        if (existsSync(metaPath)) {
            const meta: ImageMeta = JSON.parse(readFileSync(metaPath, "utf-8"))
            mimeType = meta.mimeType
        }
        return { data, mimeType }
    } catch {
        return null
    }
}

/** Current number of images stored (for monitoring). */
export function getStoreSize(): number {
    try {
        return readdirSync(IMAGES_DIR).filter(f => !f.endsWith(META_SUFFIX)).length
    } catch {
        return 0
    }
}
