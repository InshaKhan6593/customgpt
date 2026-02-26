import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { suggestTeam } from "@/lib/orchestrator/auto-suggest";
import { z } from "zod";

const suggestSchema = z.object({
  task: z.string().min(5, "Task description must be at least 5 characters"),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole("USER");

    const body = await req.json();
    const result = suggestSchema.safeParse(body);
    if (!result.success) {
      return errorResponse("Invalid input", 400, result.error.errors);
    }

    const { task } = result.data;

    // Fetch all published weblets as candidates
    const weblets = await prisma.weblet.findMany({
      where: { isActive: true, isPublic: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        capabilities: true,
      },
      take: 50,
    });

    if (weblets.length === 0) {
      return errorResponse("No published weblets available for team suggestion", 400);
    }

    const suggestion = await suggestTeam(task, weblets);

    return successResponse(suggestion);
  } catch (err: any) {
    console.error("Auto-suggest error:", err);
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Failed to generate team suggestion", 500);
  }
}
