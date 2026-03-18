import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getABTestStatus } from "@/lib/rsil/ab-test"
import { getGovernance } from "@/lib/rsil/governance"

const querySchema = z.object({
  webletId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const parsed = querySchema.safeParse({
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

    const status = await getABTestStatus(webletId, {
      minTestDurationHours: governance.minTestDurationHours,
      minScoresPerVersion: governance.minScoresPerVersion,
    })

    if (!status) {
      return NextResponse.json({ active: false })
    }

    return NextResponse.json({ active: true, ...status })
  } catch (error) {
    console.error("RSIL ab-test GET error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
