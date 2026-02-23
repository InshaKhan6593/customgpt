import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params

    const chatSession = await prisma.chatSession.findUnique({
      where: { id }
    })

    if (!chatSession || chatSession.userId !== session.user.id) {
      return new NextResponse("Not Found", { status: 404 })
    }

    await prisma.chatSession.delete({
      where: { id }
    })

    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("Failed to delete chat session:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
