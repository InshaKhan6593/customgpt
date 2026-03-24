import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("DEVELOPER");

    const weblets = await prisma.weblet.findMany({
      where: { developerId: user.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        rsilEnabled: true,
      },
    });

    const webletsWithCounts = await Promise.all(
      weblets.map(async (weblet) => {
        const interactionCount = await prisma.chatMessage.count({
          where: { chatSession: { webletId: weblet.id } },
        });

        return {
          id: weblet.id,
          name: weblet.name,
          slug: weblet.slug,
          rsilEnabled: weblet.rsilEnabled,
          interactionCount,
        };
      })
    );

    return successResponse({ weblets: webletsWithCounts });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "name" in err && err.name === "AuthorizationError") {
      const message = "message" in err && typeof err.message === "string" ? err.message : "Authorization failed";
      const status = message === "Not authenticated" || message === "Authentication failed" ? 401 : 403;
      return errorResponse(message, status);
    }
    return errorResponse("Internal server error", 500);
  }
}
