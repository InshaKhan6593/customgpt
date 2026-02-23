import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizeSlug } from "@/lib/utils/slugify";
import { WebletCategory, AccessType } from "@prisma/client";

const updateSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(300).optional(),
  iconUrl: z.string().url().optional().or(z.literal("")),
  category: z.nativeEnum(WebletCategory).optional(),
  isPublic: z.boolean().optional(),
  accessType: z.nativeEnum(AccessType).optional(),
  monthlyPrice: z.number().min(0).optional(),
  rsilEnabled: z.boolean().optional(),
  rsilGovernance: z.any().optional(),
  capabilities: z.any().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("DEVELOPER").catch(() => null);
    
    const weblet = await prisma.weblet.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNum: 'desc'} } }
    });

    if (!weblet) return errorResponse("Weblet not found", 404);

    // If it's public and active, everyone can view it. If not, only the owning developer can.
    if (!weblet.isActive || !weblet.isPublic) {
      if (!user || user.id !== weblet.developerId) {
        return errorResponse("Forbidden", 403);
      }
    }

    return successResponse(weblet);
  } catch (err: any) {
    return errorResponse("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("DEVELOPER");
    
    // Auth Check
    const weblet = await prisma.weblet.findUnique({ where: { id } });
    if (!weblet) return errorResponse("Weblet not found", 404);
    if (weblet.developerId !== user.id) return errorResponse("Forbidden", 403);

    const body = await req.json();
    const result = updateSchema.safeParse(body);
    if (!result.success) return errorResponse("Invalid input", 400, result.error.errors);

    const data = result.data as any;
    if (data.name && data.name !== weblet.name) {
      let slug = sanitizeSlug(data.name);
      const existing = await prisma.weblet.findUnique({ where: { slug } });
      if (existing) slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
      data.slug = slug;
    }

    const updated = await prisma.weblet.update({
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
    const user = await requireRole("DEVELOPER");
    
    // Auth Check
    const weblet = await prisma.weblet.findUnique({ where: { id } });
    if (!weblet) return errorResponse("Weblet not found", 404);
    if (weblet.developerId !== user.id) return errorResponse("Forbidden", 403);

    // Soft delete
    await prisma.weblet.update({
      where: { id },
      data: { isActive: false, isPublic: false }
    });

    return successResponse({ success: true, message: "Weblet disabled" });
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
