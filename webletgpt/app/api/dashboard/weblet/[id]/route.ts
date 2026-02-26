import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma as db } from "@/lib/prisma";
import { subDays, startOfDay, format } from "date-fns";

export async function GET(
  req: Request,
  context: any
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // 1. Verify ownership and get weblet basics
    const weblet = await db.weblet.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNum: "desc" },
          take: 5
        },
        _count: {
          select: { chatSessions: true }
        }
      }
    });

    if (!weblet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (weblet.developerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 2. Aggregate analytics (chats & revenue per day)
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
    
    const analytics = await db.analyticsEvent.findMany({
      where: {
        webletId: id,
        createdAt: { gte: thirtyDaysAgo },
        eventType: "chat_completed"
      },
      select: { createdAt: true }
    });

    // No transaction relation to weblet directly in this schema currently
    const totalRevenue = 0;

    // Process daily trend
    const dailyDataMap = new Map();
    for (let i = 0; i < 30; i++) {
      const date = format(subDays(new Date(), 29 - i), "MMM dd");
      dailyDataMap.set(date, { date, chats: 0, revenue: 0 }); // Note: We mock daily revenue here as transaction dates require separate aggregation
    }

    analytics.forEach(event => {
      const dateStr = format(event.createdAt, "MMM dd");
      if (dailyDataMap.has(dateStr)) {
        const current = dailyDataMap.get(dateStr);
        current.chats += (1); 
      }
    });

    const dailyTrend = Array.from(dailyDataMap.values());
    const totalChats = analytics.length;
    
    // Quick summary for latest logs (mocking a few recent entries from analytics)
    const recentLogs = await db.analyticsEvent.findMany({
      where: { webletId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
         id: true,
         eventType: true,
         createdAt: true,
         eventData: true
      }
    });

    return NextResponse.json({
      weblet: {
        id: weblet.id,
        name: weblet.name,
        category: weblet.category,
        isPublic: weblet.isPublic,
        avatarUrl: weblet.iconUrl,
        pricingModel: weblet.accessType,
        priceAmount: weblet.monthlyPrice || 0,
        averageRating: "0.0",
        ratingsCount: 0,
      },
      stats: {
        totalChats,
        activeSubscribers: 0,
        totalRevenue,
      },
      dailyTrend,
      versions: weblet.versions.map(v => ({
         version: v.versionNum,
         createdAt: v.createdAt,
         model: v.model,
         capabilities: weblet.capabilities
      })),
      recentLogs
    });

  } catch (error) {
    console.error("Weblet analytics error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
