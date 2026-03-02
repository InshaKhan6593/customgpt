import { NextRequest, NextResponse } from "next/server"
import { getImage } from "@/lib/tools/image-store"

// Only allow valid filenames: uuid.ext
const FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/i

/**
 * GET /api/image/[id]
 *
 * Serves a generated image from the local filesystem.
 * Images are stored in `data/generated-images/` by the image generation tool.
 *
 * Security:
 * - Filename format validation (no path traversal)
 * - No auth required — filenames are unguessable UUIDs
 * - Long cache for immutable content
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    // Validate ID format
    if (!id || !FILE_RE.test(id)) {
        return NextResponse.json(
            { error: "Invalid image ID" },
            { status: 400 }
        )
    }

    const image = getImage(id)

    if (!image) {
        return NextResponse.json(
            { error: "Image not found." },
            { status: 404 }
        )
    }

    return new NextResponse(image.data as any, {
        status: 200,
        headers: {
            "Content-Type": image.mimeType,
            "Content-Length": String(image.data.length),
            "Cache-Control": "public, max-age=31536000, immutable",  // permanent — file-backed
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
        },
    })
}
