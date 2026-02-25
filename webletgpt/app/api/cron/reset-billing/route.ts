import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';

// This route should be protected either by a secret header (e.g. Vercel Cron Secret)
// or triggered securely. For demonstration, we'll check for a simple bearer token.
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // In a real production app on Vercel, you'd verify `req.headers.get('x-vercel-cron')` 
      // or similar instead. We're using a generic bearer token for compatibility.
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const now = new Date();

    // Reset Developer Plans
    const devPlansReset = await db.developerPlan.updateMany({
      where: {
        billingCycleEnd: {
          lte: now, // The cycle has ended
        },
      },
      data: {
        creditsUsed: 0,
        billingCycleStart: now,
        // Advance cycle end by 1 month
        billingCycleEnd: new Date(new Date().setMonth(now.getMonth() + 1)),
      },
    });

    // Reset User Plans
    const userPlansReset = await db.userPlan.updateMany({
      where: {
        billingCycleEnd: {
          lte: now,
        },
      },
      data: {
        creditsUsed: 0,
        workflowRunsUsed: 0,
        billingCycleStart: now,
        billingCycleEnd: new Date(new Date().setMonth(now.getMonth() + 1)),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Billing cycles reset successfully",
      stats: {
        developerPlansReset: devPlansReset.count,
        userPlansReset: userPlansReset.count,
      }
    });
  } catch (error) {
    console.error("Cron Error resetting billing cycles:", error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
