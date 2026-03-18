import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { analyzeWeblet } from "@/lib/rsil/analyzer"
import { generateImprovedPrompt } from "@/lib/rsil/generator"

const optimizeSchema = z.object({
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
    const parsed = optimizeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { webletId } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    // Check no running A/B test
    const existingTest = await prisma.webletVersion.findFirst({
      where: { webletId, status: "TESTING" },
    })

    if (existingTest) {
      return NextResponse.json({ error: "A/B test already running" }, { status: 409 })
    }

    // Get current ACTIVE version
    const activeVersion = await prisma.webletVersion.findFirst({
      where: { webletId, status: "ACTIVE" },
      orderBy: { versionNum: "desc" },
    })

    if (!activeVersion) {
      return NextResponse.json({ error: "No active version found" }, { status: 404 })
    }

    // Analyze weblet performance
    const analysis = await analyzeWeblet(webletId)

    // Generate improved prompt
    const generation = await generateImprovedPrompt({
      webletId,
      currentPrompt: activeVersion.prompt,
      weakDimensions: analysis.weakDimensions,
      compositeScore: analysis.compositeScore,
      dimensions: analysis.dimensions,
    })

    // Get max version number
    const maxVersion = await prisma.webletVersion.findFirst({
      where: { webletId },
      orderBy: { versionNum: "desc" },
      select: { versionNum: true },
    })

    // Create DRAFT version — does NOT auto-start A/B test, user reviews first
    const draftVersion = await prisma.webletVersion.create({
      data: {
        webletId,
        prompt: generation.improvedPrompt,
        status: "DRAFT",
        model: activeVersion.model,
        versionNum: (maxVersion?.versionNum ?? 0) + 1,
        commitMsg: generation.changelog,
      },
    })

    return NextResponse.json({
      draftVersion: {
        id: draftVersion.id,
        prompt: draftVersion.prompt,
        changelog: generation.changelog,
        versionNum: draftVersion.versionNum,
      },
      currentVersion: {
        id: activeVersion.id,
        prompt: activeVersion.prompt,
        versionNum: activeVersion.versionNum,
      },
      analysis,
    })
  } catch (error) {
    console.error("RSIL optimize POST error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
