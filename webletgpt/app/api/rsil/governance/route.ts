import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getGovernance, validateGovernance } from "@/lib/rsil/governance"

const getQuerySchema = z.object({
  webletId: z.string().min(1),
})

const putSchema = z.object({
  webletId: z.string().min(1),
  governance: z.record(z.unknown()),
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
      select: { id: true, rsilGovernance: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    const governance = getGovernance({ rsilGovernance: weblet.rsilGovernance })

    return NextResponse.json({
      webletId: weblet.id,
      governance,
    })
  } catch (error) {
    console.error("RSIL governance GET error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const body = await req.json()
    const parsed = putSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { webletId, governance: governanceInput } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    const validationResult = validateGovernance(governanceInput)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid governance config", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const updated = await prisma.weblet.update({
      where: { id: webletId },
      data: { rsilGovernance: validationResult.data },
      select: { id: true, rsilGovernance: true },
    })

    const governance = getGovernance({ rsilGovernance: updated.rsilGovernance })

    return NextResponse.json({
      webletId: updated.id,
      governance,
    })
  } catch (error) {
    console.error("RSIL governance PUT error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
