import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("DEVELOPER");

    // Aggregate key metrics for the developer dashboard
    const [totalWeblets, activeWeblets, totalPayoutsData, totalChatsData] = await Promise.all([
      prisma.weblet.count({ where: { developerId: user.id } }),
      prisma.weblet.count({ where: { developerId: user.id, isActive: true } }),
      
      // Sum of all completed payouts
      prisma.payout.aggregate({
        where: { developerId: user.id, status: "COMPLETED" },
        _sum: { amount: true }
      }),

      // Count of all chat sessions across the developer's weblets
      prisma.chatSession.count({
        where: {
          weblet: { developerId: user.id }
        }
      })
    ]);

    return successResponse({
      summary: {
        totalWeblets,
        activeWeblets,
        totalEarnings: totalPayoutsData._sum.amount || 0,
        totalInteractions: totalChatsData
      }
    });
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
