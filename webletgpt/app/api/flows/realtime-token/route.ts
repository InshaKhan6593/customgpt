import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { inngest } from "@/lib/inngest/client";
import { getSubscriptionToken } from "@inngest/realtime";

export async function GET(req: NextRequest) {
  try {
    await requireRole("USER");
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return Response.json({ error: "Missing sessionId" }, { status: 400 });

    const token = await getSubscriptionToken(inngest, {
      channel: `orchestration:${sessionId}`,
      topics: ["events"],
    });

    return Response.json({ token });
  } catch (err: any) {
    if (err.name === "AuthorizationError") return Response.json({ error: err.message }, { status: 403 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
