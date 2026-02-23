import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizeSlug } from "@/lib/utils/slugify";
import { WebletCategory } from "@prisma/client";

// Zod schema for Weblet creation
const createWebletSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(300).optional(),
  iconUrl: z.string().url().optional(),
  category: z.nativeEnum(WebletCategory),
  isPublic: z.boolean().default(false),
  prompt: z.string().min(10).max(8000),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("DEVELOPER");
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const [weblets, total] = await Promise.all([
      prisma.weblet.findMany({
        where: { developerId: user.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { chatSessions: true, analyticsEvents: true } } }
      }),
      prisma.weblet.count({ where: { developerId: user.id } })
    ]);

    return paginatedResponse(weblets, total, page, limit);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("DEVELOPER");
    const body = await req.json();
    const result = createWebletSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("Invalid input data", 400, result.error.errors);
    }

    const { name, description, category, isPublic, prompt } = result.data;
    
    // Generate unique slug
    let slug = sanitizeSlug(name);
    const existing = await prisma.weblet.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;

    // Create weblet & active version inside transaction
    const weblet = await prisma.$transaction(async (tx) => {
      const w = await tx.weblet.create({
        data: {
          developerId: user.id,
          name,
          slug,
          description,
          category,
          isPublic,
          versions: {
            create: {
              versionNum: 1,
              prompt,
              status: "ACTIVE"
            }
          }
        },
        include: { versions: true }
      });
      return w;
    });

    return successResponse(weblet, 201);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse(err.message || "Internal server error", 500);
  }
}
