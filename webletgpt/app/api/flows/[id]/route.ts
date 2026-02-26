import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { FlowMode } from "@prisma/client";

const updateFlowSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  mode: z.nativeEnum(FlowMode).optional(),
  steps: z.array(z.object({
    webletId: z.string(),
    order: z.number().int().min(1),
    inputMapping: z.string(),
    hitlGate: z.boolean(),
    role: z.string().optional(),
  })).optional(),
  masterWebletId: z.string().optional(),
  isPublic: z.boolean().optional()
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("USER").catch(() => null);
    
    const flow = await prisma.userFlow.findUnique({
      where: { id }
    });

    if (!flow) return errorResponse("Flow not found", 404);

    // If it's public, everyone can view it. If not, only the owning user can.
    if (!flow.isPublic) {
      if (!user || user.id !== flow.userId) {
        return errorResponse("Forbidden", 403);
      }
    }

    // Optional: Populate weblet details manually if needed
    // For now we just return the steps JSON which contains weblet IDs

    return successResponse(flow);
  } catch (err: any) {
    return errorResponse("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("USER");
    
    // Auth Check
    const flow = await prisma.userFlow.findUnique({ where: { id } });
    if (!flow) return errorResponse("Flow not found", 404);
    if (flow.userId !== user.id) return errorResponse("Forbidden", 403);

    const body = await req.json();
    const result = updateFlowSchema.safeParse(body);
    if (!result.success) return errorResponse("Invalid input", 400, result.error.errors);

    const data = result.data;
    
    if (data.steps) {
       // Validate weblets actually exist
      const webletIds = [...new Set(data.steps.map(s => s.webletId))];
      const existingWeblets = await prisma.weblet.count({
        where: { id: { in: webletIds } }
      });

      if (existingWeblets !== webletIds.length) {
        return errorResponse("One or more weblets in the flow do not exist.", 400);
      }
    }

    const updated = await prisma.userFlow.update({
      where: { id },
      data
    });

    return successResponse(updated);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("USER");
    
    // Auth Check
    const flow = await prisma.userFlow.findUnique({ where: { id } });
    if (!flow) return errorResponse("Flow not found", 404);
    if (flow.userId !== user.id) return errorResponse("Forbidden", 403);

    await prisma.userFlow.delete({
      where: { id }
    });

    return successResponse({ success: true, message: "Flow deleted" });
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
