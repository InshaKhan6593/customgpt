import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { MAX_KNOWLEDGE_FILES } from "@/lib/constants";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("DEVELOPER");
    
    // Auth Check
    const weblet = await prisma.weblet.findUnique({ where: { id } });
    if (!weblet) return errorResponse("Weblet not found", 404);
    if (weblet.developerId !== user.id) return errorResponse("Forbidden", 403);

    const files = await prisma.knowledgeFile.findMany({
      where: { webletId: id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } }
    });

    return successResponse(files);
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

    // Limit check
    const currentFilesCount = await prisma.knowledgeFile.count({ where: { webletId: id } });
    if (currentFilesCount >= MAX_KNOWLEDGE_FILES) {
      return errorResponse(`Maximum of ${MAX_KNOWLEDGE_FILES} knowledge files allowed`, 400);
    }

    // In a real implementation this would parse FormData and upload to S3/Vercel Blob.
    // For this segment, we simulate the database record creation.
    
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return errorResponse("No file provided", 400);

    const storageKey = `mock_key_${Date.now()}_${file.name}`;
    
    const kFile = await prisma.knowledgeFile.create({
      data: {
        webletId: id,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storageKey
      }
    });

    return successResponse(kFile, 201);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
