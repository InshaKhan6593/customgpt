import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getGovernance, type GovernanceConfig } from "@/lib/rsil/governance"

const getQuerySchema = z.object({
  webletId: z.string().min(1),
})

const governanceSchema: z.ZodType<GovernanceConfig> = z.object({
  minInteractionsBeforeOptimize: z.number().int().min(1),
  cooldownHours: z.number().int().min(0),
  maxUpdatesPerDay: z.number().int().min(1),
  minTestDurationHours: z.number().int().min(1),
  requireCreatorApproval: z.boolean(),
  performanceFloor: z.number().min(0).max(5),
  autoOptimizationEnabled: z.boolean(),
  autoOptimizationFrequency: z.enum(['every_6h', 'every_12h', 'daily', 'weekly']),
  autoOptimizationHour: z.number().int().min(0).max(23),
})

const putSchema = z.object({
  webletId: z.string().min(1),
  rsilEnabled: z.boolean().optional(),
  governance: governanceSchema.optional(),
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
      select: { id: true, rsilEnabled: true, rsilGovernance: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    return NextResponse.json({
      webletId: weblet.id,
      rsilEnabled: weblet.rsilEnabled,
      governance: getGovernance(weblet.rsilGovernance),
    })
  } catch (error) {
    console.error("RSIL config GET error:", error)
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

    const { webletId, rsilEnabled, governance } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    if (rsilEnabled === undefined && governance === undefined) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 })
    }

    const updated = await prisma.weblet.update({
      where: { id: webletId },
      data: {
        ...(rsilEnabled !== undefined ? { rsilEnabled } : {}),
        ...(governance !== undefined ? { rsilGovernance: governance } : {}),
      },
      select: { id: true, rsilEnabled: true, rsilGovernance: true },
    })

    return NextResponse.json({
      webletId: updated.id,
      rsilEnabled: updated.rsilEnabled,
      governance: getGovernance(updated.rsilGovernance),
    })
  } catch (error) {
    console.error("RSIL config PUT error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
