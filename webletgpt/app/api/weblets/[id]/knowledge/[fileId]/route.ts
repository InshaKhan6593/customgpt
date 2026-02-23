import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, fileId: string }> }) {
  try {
    const { id, fileId } = await params;
    const user = await requireRole("DEVELOPER");
    
    // Auth Check
    const weblet = await prisma.weblet.findUnique({ where: { id } });
    if (!weblet) return errorResponse("Weblet not found", 404);
    if (weblet.developerId !== user.id) return errorResponse("Forbidden", 403);

    // Ensure the file belongs to this weblet
    const file = await prisma.knowledgeFile.findUnique({
      where: { id: fileId }
    });

    if (!file || file.webletId !== id) {
      return errorResponse("Knowledge file not found", 404);
    }

    // Deleting the knowledge file will cascade and delete its chunks
    await prisma.knowledgeFile.delete({
      where: { id: fileId }
    });

    // Code to delete from actual storage (S3/Vercel Blob) goes here...

    return successResponse({ success: true, message: "File deleted successfully" });
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
