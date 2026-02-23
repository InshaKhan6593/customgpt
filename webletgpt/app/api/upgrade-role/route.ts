import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be logged in to upgrade your role." },
        { status: 401 }
      )
    }

    if (session.user.role === "DEVELOPER" || session.user.role === "ADMIN") {
      return NextResponse.json(
        { error: "You are already a developer or admin." },
        { status: 400 }
      )
    }

    // Upgrade the user to DEVELOPER
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { role: "DEVELOPER" },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        role: updatedUser.role,
      },
    })
  } catch (error) {
    console.error("Error upgrading role:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
