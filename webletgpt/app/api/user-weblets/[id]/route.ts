import { requireRole } from "@/lib/utils/auth-guard";
import { errorResponse, successResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("USER");
    const { id: webletId } = await params;

    await prisma.userWeblet.deleteMany({
      where: { userId: user.id, webletId },
    });

    return successResponse({ ok: true });
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    console.error("[user-weblets DELETE]", err);
    return errorResponse("Internal server error", 500);
  }
}
