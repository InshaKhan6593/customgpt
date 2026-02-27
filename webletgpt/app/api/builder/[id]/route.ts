import { NextRequest } from "next/server"
import { requireRole } from "@/lib/utils/auth-guard"
import { successResponse, errorResponse } from "@/lib/utils/api-response"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/builder/[id]
 *
 * Dedicated endpoint for the Weblet Builder UI.
 * Requires the caller to be an authenticated DEVELOPER who owns the weblet.
 * Returns the weblet with its versions so the builder can pre-populate form fields.
 *
 * Unlike GET /api/weblets/[id] (which serves public/marketplace reads),
 * this endpoint is strict: no public access, no partial auth fallback.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Strict auth — must be authenticated DEVELOPER, no fallback to null
    const user = await requireRole("DEVELOPER")

    const weblet = await prisma.weblet.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNum: "desc" },
        },
      },
    })

    if (!weblet) {
      return errorResponse("Weblet not found", 404)
    }

    // Ownership check — developers can only edit their own weblets
    if (weblet.developerId !== user.id) {
      return errorResponse("You do not have permission to edit this weblet", 403)
    }

    return successResponse(weblet)
  } catch (err: any) {
    if (err.name === "AuthorizationError") {
      return errorResponse(err.message, 403)
    }
    console.error("[GET /api/builder/:id]", err)
    return errorResponse("Internal server error", 500)
  }
}
