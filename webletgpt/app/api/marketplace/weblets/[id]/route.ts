import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const weblet = await prisma.weblet.findFirst({
      where: { 
        id,
        isActive: true,
        isPublic: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        accessType: true,
        monthlyPrice: true,
        createdAt: true,
        developer: {
          select: { name: true, image: true }
        },
        _count: {
          select: { chatSessions: true }
        }
      }
    });

    if (!weblet) return errorResponse("Weblet not found or not public", 404);

    return successResponse(weblet);
  } catch (err: any) {
    return errorResponse("Internal server error", 500);
  }
}
