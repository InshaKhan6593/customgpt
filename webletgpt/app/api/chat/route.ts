import { NextRequest } from "next/server"
import { requireRole } from "@/lib/utils/auth-guard"
import { errorResponse } from "@/lib/utils/api-response"

// POST /api/chat — Send message to a weblet (streaming response)
// Full implementation in Segment 05 — this is a stub route for structural completeness
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("USER")
    const body = await req.json()

    // Segment 05 will implement:
    // 1. Validate webletId and message
    // 2. Create or continue a ChatSession
    // 3. Load weblet config (prompt, capabilities, knowledge)
    // 4. Stream AI response via SSE using the configured model
    // 5. Save messages to ChatMessage table
    // 6. Log analytics events

    return errorResponse(
      "Chat engine not yet implemented. Coming in Segment 05.",
      501
    )
  } catch (err: any) {
    if (err.name === "AuthorizationError") {
      return errorResponse(err.message, err.message.includes("Not auth") ? 401 : 403)
    }
    return errorResponse("Internal server error", 500)
  }
}
