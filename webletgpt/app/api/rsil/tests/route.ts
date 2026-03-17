import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { fetchTraces } from "@/lib/langfuse/client"
import { deployWinner, evaluateAbTest } from "@/lib/rsil/deployer"

const getQuerySchema = z.object({
  webletId: z.string().min(1),
})

const postSchema = z.object({
  webletId: z.string().min(1),
  action: z.enum(["promote", "end"]),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const parsed = getQuerySchema.safeParse({
      webletId: req.nextUrl.searchParams.get("webletId"),
    })

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query params" }, { status: 400 })
    }

    const { webletId } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    const [evaluation, testingVersion] = await Promise.all([
      evaluateAbTest(webletId),
      prisma.webletVersion.findFirst({
        where: { webletId, status: "TESTING", isAbTest: true },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const tracesResponse = await fetchTraces({
      webletId,
      fromTimestamp: testingVersion?.abTestStartedAt?.toISOString(),
      limit: 50,
    })

    const testResult =
      evaluation.winner !== "insufficient_data"
        ? {
            controlScore: evaluation.controlAvg,
            variantScore: evaluation.variantAvg,
            controlSessions: evaluation.controlCount,
            variantSessions: evaluation.variantCount,
            improvement: evaluation.improvement,
            pValue: 0.05,
            isSignificant: evaluation.controlCount >= 10 && evaluation.variantCount >= 10,
          }
        : null

    return NextResponse.json({
      evaluation: testResult,
      testingVersion,
      traces: tracesResponse?.data || [],
    })
  } catch (error) {
    console.error("RSIL tests GET error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const body = await req.json()
    const parsed = postSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { webletId, action } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    if (action === "promote") {
      const result = await deployWinner(webletId)
      return NextResponse.json({ ok: true, result })
    }

    const testingVersion = await prisma.webletVersion.findFirst({
      where: { webletId, status: "TESTING", isAbTest: true },
      orderBy: { createdAt: "desc" },
    })

    if (!testingVersion) {
      return NextResponse.json({ error: "No active A/B test found" }, { status: 404 })
    }

    await prisma.webletVersion.update({
      where: { id: testingVersion.id },
      data: {
        status: "ARCHIVED",
        isAbTest: false,
        abTestEndedAt: new Date(),
        abTestWinner: false,
      },
    })

    return NextResponse.json({
      ok: true,
      result: { action: "ended_test", versionId: testingVersion.id },
    })
  } catch (error) {
    console.error("RSIL tests POST error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
