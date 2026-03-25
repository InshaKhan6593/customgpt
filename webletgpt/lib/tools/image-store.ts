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

/**
 * Resolve the images directory at runtime.
 *
 * On Vercel's serverless runtime (`/var/task` is read-only), we use `/tmp`
 * which is the only writable directory. In development, we use the project-local
 * `data/generated-images` folder so images persist across dev server restarts.
 */
function resolveImagesDir(): string {
    const isVercel = !!process.env.VERCEL
    if (isVercel) {
        return path.join("/tmp", "generated-images")
    }
    return path.join(process.cwd(), "data", "generated-images")
}

// Lazy-initialized to avoid filesystem side-effects at module evaluation time.
let _imagesDir: string | undefined

function getImagesDir(): string {
    if (!_imagesDir) {
        _imagesDir = resolveImagesDir()
    }
    return _imagesDir
}

const META_SUFFIX = ".meta.json"
const MAX_IMAGES = Number(process.env.IMAGE_STORE_MAX_ENTRIES) || 500
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  // 10 MB per image

/**
 * Returns true if the images directory is available and writable.
 * On Vercel's read-only serverless filesystem (/var/task), mkdirSync will throw
 * EROFS or ENOENT — in that case image storage is simply disabled at runtime.
 */
function ensureImagesDirExists(): boolean {
    try {
        const dir = getImagesDir()
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }
        return true
    } catch {
        return false
    }
}

/**
 * Evict oldest images when over the limit.
 */
function evictIfNeeded(): void {
    try {
        const dir = getImagesDir()
        const files = readdirSync(dir).filter(f => !f.endsWith(META_SUFFIX))
        if (files.length <= MAX_IMAGES) return

        const withTime = files.map(f => ({
            name: f,
            time: statSync(path.join(dir, f)).mtimeMs,
        })).sort((a, b) => a.time - b.time)

        const toRemove = withTime.slice(0, files.length - MAX_IMAGES)
        for (const { name } of toRemove) {
            try {
                unlinkSync(path.join(dir, name))
                unlinkSync(path.join(dir, name + META_SUFFIX))
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

    if (!ensureImagesDirExists()) {
        throw new Error("Image store is not available in this environment (read-only filesystem).")
    }

    evictIfNeeded()

    const id = randomUUID()
    const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg"
        : mimeType.includes("webp") ? "webp"
            : "png"

    const dir = getImagesDir()
    const filePath = path.join(dir, `${id}.${ext}`)
    const metaPath = path.join(dir, `${id}.${ext}${META_SUFFIX}`)

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
    if (!/^[0-9a-f-]+\.(png|jpg|webp)$/i.test(id)) return null

    const dir = getImagesDir()
    if (!existsSync(dir)) return null

    const filePath = path.join(dir, id)
    const metaPath = path.join(dir, id + META_SUFFIX)

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

export function getStoreSize(): number {
    try {
        return readdirSync(getImagesDir()).filter(f => !f.endsWith(META_SUFFIX)).length
    } catch {
        return 0
    }
}
