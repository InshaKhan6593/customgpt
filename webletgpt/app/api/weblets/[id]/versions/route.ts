import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { VersionStatus } from "@prisma/client";
import {
  OPTIMIZATION_REVIEW_EVENT_TYPE,
  parseOptimizationReviewData,
} from "@/lib/rsil/optimization-review";

const createVersionSchema = z.object({
  prompt: z.string().min(10),
  commitMsg: z.string().optional(),
  model: z.string().optional()
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("DEVELOPER");
    
    // Auth Check
    const weblet = await prisma.weblet.findUnique({ where: { id } });
    if (!weblet) return errorResponse("Weblet not found", 404);
    if (weblet.developerId !== user.id) return errorResponse("Forbidden", 403);

    const versions = await prisma.webletVersion.findMany({
      where: { webletId: id },
      orderBy: { versionNum: "desc" }
    });

    const optimizationEvents = await prisma.analyticsEvent.findMany({
      where: {
        webletId: id,
        eventType: OPTIMIZATION_REVIEW_EVENT_TYPE,
      },
      orderBy: { createdAt: 'desc' },
    })

    const reviewVersionIds = new Set(
      optimizationEvents
        .map((event) => parseOptimizationReviewData(event.eventData)?.optimizedVersionId)
        .filter((versionId): versionId is string => Boolean(versionId))
    )

    const versionsWithReviewFlag = versions.map((version) => ({
      ...version,
      hasOptimizationResult: reviewVersionIds.has(version.id),
    }))

    return successResponse(versionsWithReviewFlag);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("DEVELOPER");
    
    // Auth Check
    const weblet = await prisma.weblet.findUnique({ where: { id } });
    if (!weblet) return errorResponse("Weblet not found", 404);
    if (weblet.developerId !== user.id) return errorResponse("Forbidden", 403);

    const body = await req.json();
    const result = createVersionSchema.safeParse(body);
    if (!result.success) return errorResponse("Invalid input", 400, result.error.errors);

    const { prompt, commitMsg, model } = result.data;

    // Get the latest version number
    const latestVersion = await prisma.webletVersion.findFirst({
      where: { webletId: id },
      orderBy: { versionNum: "desc" }
    });

    const nextVersionNum = (latestVersion?.versionNum || 0) + 1;

    // Create new version and set others to ARCHIVED
    const version = await prisma.$transaction(async (tx) => {
      // Archive old ones if this new one is ACTIVE
      // Default to DRAFT unless specified otherwise
      await tx.webletVersion.updateMany({
        where: { webletId: id, status: "ACTIVE" },
        data: { status: "ARCHIVED" }
      });

      return tx.webletVersion.create({
        data: {
          webletId: id,
          versionNum: nextVersionNum,
          prompt,
          commitMsg,
          model,
          status: "ACTIVE"
        }
      });
    });

    return successResponse(version, 201);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
