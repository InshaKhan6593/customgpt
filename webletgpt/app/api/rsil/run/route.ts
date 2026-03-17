import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { analyzeWeblet } from "@/lib/rsil/analyzer"
import { createAbTestVersion } from "@/lib/rsil/ab-test"
import { generateImprovedPrompt } from "@/lib/rsil/generator"
import { checkGovernance } from "@/lib/rsil/governance"

const schema = z.object({
  webletId: z.string().min(1),
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

    const { webletId } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true, name: true, description: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    const devPlan = await prisma.developerPlan.findUnique({
      where: { userId: developerId },
    })
    const creditsRemaining = (devPlan?.creditsIncluded ?? 0) - (devPlan?.creditsUsed ?? 0)
    if (devPlan && devPlan.creditsIncluded !== -1 && creditsRemaining <= 0) {
      return NextResponse.json({
        error: "Insufficient credits for RSIL optimization",
        reason: "developer_credits_exhausted",
      }, { status: 402 })
    }

    const governance = await checkGovernance(webletId)
    if (!governance.allowed) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: governance.reason,
      })
    }

    const analysis = await analyzeWeblet(webletId)

    if (analysis.decision === "NONE") {
      return NextResponse.json({
        ok: true,
        action: "none",
        analysis,
      })
    }

    if (analysis.decision === "SUGGESTION") {
      return NextResponse.json({
        ok: true,
        action: "suggestion",
        analysis,
      })
    }

    const activeVersion = await prisma.webletVersion.findFirst({
      where: { webletId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    })

    if (!activeVersion) {
      return NextResponse.json({ error: "No active version found" }, { status: 404 })
    }

    const improvedPrompt = await generateImprovedPrompt({
      currentPrompt: activeVersion.prompt,
      webletId,
      lowScoredTraceIds: analysis.lowScoredTraceIds,
      weakDimensions: analysis.weakDimensions,
      webletName: weblet.name,
      webletDescription: weblet.description,
      developerId,
    })

    const testingVersion = await createAbTestVersion({
      webletId,
      newPrompt: improvedPrompt,
      baseVersionId: activeVersion.id,
      trafficPct: 50,
    })

    return NextResponse.json({
      ok: true,
      action: "ab_test_started",
      analysis,
      testingVersion: {
        id: testingVersion.id,
        versionNum: testingVersion.versionNum,
        status: testingVersion.status,
        abTestTrafficPct: testingVersion.abTestTrafficPct,
        abTestStartedAt: testingVersion.abTestStartedAt,
      },
    })
  } catch (error) {
    console.error("RSIL run error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
