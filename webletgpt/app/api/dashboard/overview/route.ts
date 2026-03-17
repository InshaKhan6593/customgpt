import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma as db } from "@/lib/prisma";
import { subDays, startOfDay, format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const developerId = session.user.id;
  const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));

  try {
    // 1. Get all weblets for this developer
    const weblets = await db.weblet.findMany({
      where: { developerId },
      include: {
        _count: {
          select: { chatSessions: true } // Assuming 'chats' is the relation name, we'll actually use analytics though
        }
      }
    });

    // 2. Aggregate analytics (chats & revenue per day)
    const analytics = await db.analyticsEvent.findMany({
      where: {
        weblet: { developerId },
        createdAt: { gte: thirtyDaysAgo },
        eventType: "chat_completed"
      },
      select: {
        createdAt: true,
        webletId: true,
        weblet: { select: { category: true } }
      }
    });

    const subscriptions = 0; // Subscriptions are not directly linked to weblets yet

    const transactions = await db.transaction.aggregate({
      where: { userId: developerId, status: "COMPLETED" }, // Transactions belong to user, we'll approximate dev revenue for now
      _sum: { amount: true }
    });

    const totalRevenue = transactions._sum.amount || 0;
    const activeSubscribers = subscriptions;

    // Process daily trend
    const dailyDataMap = new Map();
    for (let i = 0; i < 30; i++) {
      const date = format(subDays(new Date(), 29 - i), "MMM dd");
      dailyDataMap.set(date, { date, chats: 0, revenue: 0 }); // Note: We mock daily revenue here as transaction dates require separate aggregation
    }

    // Process category breakdown
    const categoryMap = new Map();

    analytics.forEach(event => {
      // Daily chats
      const dateStr = format(event.createdAt, "MMM dd");
      if (dailyDataMap.has(dateStr)) {
        const current = dailyDataMap.get(dateStr);
        current.chats += 1;
      }

      // Categories
      const cat = event.weblet?.category || "Uncategorized";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });

    const dailyTrend = Array.from(dailyDataMap.values());
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
    const totalChats = analytics.length;
    
    const webletIds = weblets.map(w => w.id)
    const ratingEvents = await db.analyticsEvent.findMany({
      where: {
        webletId: { in: webletIds },
        eventType: "user_rating",
      },
      select: {
        webletId: true,
        eventData: true,
      },
    })

    const webletRatings = new Map<string, { sum: number; count: number }>()
    for (const event of ratingEvents) {
      const data = event.eventData as Record<string, unknown> | null
      const score = data?.score ?? data?.rating
      const numScore = typeof score === "number" ? score : Number(score)
      if (!isFinite(numScore)) continue

      const existing = webletRatings.get(event.webletId) || { sum: 0, count: 0 }
      existing.sum += numScore
      existing.count += 1
      webletRatings.set(event.webletId, existing)
    }

    let totalRatingSum = 0
    let totalRatingCount = 0
    for (const { sum, count } of webletRatings.values()) {
      totalRatingSum += sum
      totalRatingCount += count
    }
    const averageRating = totalRatingCount > 0
      ? (totalRatingSum / totalRatingCount).toFixed(1)
      : "0.0"

    const topWeblets = weblets.map(w => {
      const wr = webletRatings.get(w.id)
      const rating = wr && wr.count > 0 ? (wr.sum / wr.count).toFixed(1) : "0.0"
      return {
        id: w.id,
        name: w.name,
        category: w.category,
        status: w.isPublic ? "Active" : "Draft",
        rating,
        revenue: 0, // Mocked for table
        chats: analytics.filter(a => a.webletId === w.id).length,
      }
    }).sort((a, b) => b.chats - a.chats).slice(0, 5);

    return NextResponse.json({
      overview: {
        totalChats,
        averageRating,
        activeSubscribers,
        totalRevenue
      },
      dailyTrend,
      categoryBreakdown,
      topWeblets
    });

  } catch (error) {
    console.error("Dashboard overview error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
