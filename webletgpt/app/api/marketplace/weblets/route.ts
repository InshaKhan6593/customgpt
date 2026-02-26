import { NextRequest } from "next/server";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { WebletCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const category = searchParams.get("category") as WebletCategory | null;
    const sort = searchParams.get("sort") || "newest";
    
    const all = searchParams.get("all") === "true";
    
    const skip = (page - 1) * limit;

    let whereClause: any = {};
    if (!all) {
      whereClause = { 
        isActive: true, 
        isPublic: true 
      };
    }

    if (category) {
      // Validate category exists in enum
      if (Object.values(WebletCategory).includes(category)) {
        whereClause.category = category;
      }
    }

    let orderByClause: any = { createdAt: "desc" };
    if (sort === "popular") {
      orderByClause = { chatSessions: { _count: "desc" } };
    }

    const [weblets, total] = await Promise.all([
      prisma.weblet.findMany({
        where: whereClause,
        orderBy: orderByClause,
        skip,
        take: limit,
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
      }),
      prisma.weblet.count({ where: whereClause })
    ]);

    return paginatedResponse(weblets, total, page, limit);
  } catch (err: any) {
    console.error(err);
    return errorResponse("Internal server error", 500);
  }
}
