import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { errorResponse, successResponse } from "@/lib/utils/api-response"

const profileSchema = z.object({
  name: z.string().max(50, "Name must be 50 characters or less").optional(),
})

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return errorResponse("Unauthorized", 401)
    }

    const body = await req.json()
    const parsed = profileSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0].message, 400)
    }

    const { name } = parsed.data

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { name },
    })

    return successResponse(updatedUser)
  } catch (err: any) {
    console.error("Profile update error:", err)
    return errorResponse(err.message || "Failed to update profile", 500)
  }
}
