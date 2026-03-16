import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const schema = z.object({
  webletId: z.string().min(1),
  targetVersionId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { webletId, targetVersionId } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    const targetVersion = await prisma.webletVersion.findFirst({
      where: { id: targetVersionId, webletId },
      select: { id: true, status: true, versionNum: true },
    })

    if (!targetVersion) {
      return NextResponse.json({ error: "Target version not found" }, { status: 404 })
    }

    if (targetVersion.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Target version must be ARCHIVED" }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.webletVersion.updateMany({
        where: { webletId, status: "ACTIVE" },
        data: { status: "ARCHIVED" },
      }),
      prisma.webletVersion.update({
        where: { id: targetVersionId },
        data: {
          status: "ACTIVE",
          isAbTest: false,
          abTestEndedAt: new Date(),
          commitMsg: `Manually rolled back to v${targetVersion.versionNum}`,
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      action: "rollback_complete",
      targetVersionId,
    })
  } catch (error) {
    console.error("RSIL rollback error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
