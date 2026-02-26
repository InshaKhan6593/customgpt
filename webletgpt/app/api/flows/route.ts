import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { FlowMode } from "@prisma/client";

const createFlowSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  mode: z.nativeEnum(FlowMode).default(FlowMode.SEQUENTIAL),
  steps: z.array(z.object({
    webletId: z.string(),
    order: z.number().int().min(1),
    inputMapping: z.string(),
    hitlGate: z.boolean(),
    role: z.string().optional(),
  })).default([]),
  masterWebletId: z.string().optional(),
  isPublic: z.boolean().default(false)
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("USER");
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const [flows, total] = await Promise.all([
      prisma.userFlow.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.userFlow.count({ where: { userId: user.id } })
    ]);

    return paginatedResponse(flows, total, page, limit);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("USER");
    const body = await req.json();
    const result = createFlowSchema.safeParse(body);

    if (!result.success) {
      console.error("Zod Validation Failed:", result.error.errors);
      return errorResponse("Invalid input data", 400, result.error.errors);
    }

    const { name, description, mode, steps, masterWebletId, isPublic } = result.data;

    // Validate weblets actually exist (skip for empty draft flows)
    if (steps.length > 0) {
      const webletIds = [...new Set(steps.map(s => s.webletId))];
      const existingWeblets = await prisma.weblet.count({
        where: { id: { in: webletIds } }
      });

      if (existingWeblets !== webletIds.length) {
        return errorResponse("One or more weblets in the flow do not exist.", 400);
      }
    }

    const flow = await prisma.userFlow.create({
      data: {
        userId: user.id,
        name,
        description,
        mode,
        steps,
        masterWebletId,
        isPublic
      }
    });

    return successResponse(flow, 201);
  } catch (err: any) {
    console.error("Failed to create flow:", err);
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
