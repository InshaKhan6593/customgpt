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
  defaultPrompt: z.string().max(2000).optional(),
  steps: z.array(z.object({
    webletId: z.string(),
    order: z.number().int().min(1),
    inputMapping: z.string(),
    hitlGate: z.boolean(),
    role: z.string().optional(),
    stepPrompt: z.string().max(2000).optional(),
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

    // Resolve weblet names + icons for all steps in one query
    const allWebletIds = new Set<string>();
    flows.forEach((f) => {
      ((f.steps as any[]) || []).forEach((s: any) => {
        if (s.webletId) allWebletIds.add(s.webletId);
      });
    });

    let webletMap: Record<string, { name: string; iconUrl: string | null }> = {};
    if (allWebletIds.size > 0) {
      const weblets = await prisma.weblet.findMany({
        where: { id: { in: Array.from(allWebletIds) } },
        select: { id: true, name: true, iconUrl: true },
      });
      weblets.forEach((w) => { webletMap[w.id] = { name: w.name, iconUrl: w.iconUrl }; });
    }

    // Enrich each flow's steps with weblet info
    const enrichedFlows = flows.map((f) => ({
      ...f,
      steps: ((f.steps as any[]) || []).map((s: any) => ({
        ...s,
        webletName: webletMap[s.webletId]?.name || null,
        webletIconUrl: webletMap[s.webletId]?.iconUrl || null,
      })),
    }));

    return paginatedResponse(enrichedFlows, total, page, limit);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    console.error("[GET /api/flows]", err);
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

    const { name, description, mode, defaultPrompt, steps, masterWebletId, isPublic } = result.data;

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
        defaultPrompt,
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
