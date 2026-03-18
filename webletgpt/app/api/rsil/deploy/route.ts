import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startABTest, concludeABTest, promoteVersion } from "@/lib/rsil/deployer"
import { getGovernance } from "@/lib/rsil/governance"

const deploySchema = z.object({
  webletId: z.string().min(1),
  versionId: z.string().min(1).optional(),
  action: z.enum(["test", "deploy", "conclude", "cancel"]),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const body = await req.json()
    const parsed = deploySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { webletId, versionId, action } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true, rsilGovernance: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    const governance = getGovernance({ rsilGovernance: weblet.rsilGovernance })

    switch (action) {
      case "test": {
        if (!versionId) {
          return NextResponse.json(
            { error: "versionId required for test action" },
            { status: 400 }
          )
        }
        const version = await startABTest({
          webletId,
          draftVersionId: versionId,
          trafficPct: governance.abTestTrafficPct,
        })
        return NextResponse.json({ version })
      }

      case "deploy": {
        if (!versionId) {
          return NextResponse.json(
            { error: "versionId required for deploy action" },
            { status: 400 }
          )
        }
        await promoteVersion(webletId, versionId, "instant")
        return NextResponse.json({ success: true, versionId })
      }

      case "conclude": {
        if (!versionId) {
          return NextResponse.json(
            { error: "versionId required for conclude action" },
            { status: 400 }
          )
        }
        await concludeABTest(webletId, versionId)
        await promoteVersion(
          webletId,
          versionId,
          "instant" // Always instant after A/B test conclusion — winner is already validated
        )
        return NextResponse.json({ success: true, versionId })
      }

      case "cancel": {
        const testingVersion = await prisma.webletVersion.findFirst({
          where: { webletId, status: "TESTING" },
        })

        if (!testingVersion) {
          return NextResponse.json(
            { error: "No active A/B test found" },
            { status: 404 }
          )
        }

        const archivedVersion = await prisma.webletVersion.update({
          where: { id: testingVersion.id },
          data: {
            status: "ARCHIVED",
            abTestEndedAt: new Date(),
            abTestWinner: false,
            isAbTest: false,
          },
        })

        return NextResponse.json({ version: archivedVersion })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    console.error("RSIL deploy POST error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
