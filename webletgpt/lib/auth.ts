import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Resend from "next-auth/providers/resend"

import { authConfig } from "./auth.config"
import { prisma } from "./prisma"
import { sendVerificationRequest } from "./email"

// Generate random uppercase alphanumeric token instead of default hash
// to allow the user to type it in as an OTP code.
function generateVerificationToken() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      from: "WebletGPT <noreply@resend.dev>",
      sendVerificationRequest,
      generateVerificationToken,
    }),
    // GitHub and Google providers would be added here
  ],
  events: {
    // Fires after every successful sign-in (new and returning users)
    async signIn({ user }) {
      if (!user.id) return;
      const now = new Date();
      const nextMonth = new Date(new Date().setMonth(now.getMonth() + 1));

      // Create a free UserPlan if one doesn't exist yet
      await prisma.userPlan.upsert({
        where: { userId: user.id },
        update: {},  // returning user — don't overwrite their paid plan
        create: {
          userId: user.id,
          tier: "FREE_USER",
          creditsIncluded: 100,
          creditsUsed: 0,
          workflowRunsIncluded: 2,
          workflowRunsUsed: 0,
          billingCycleStart: now,
          billingCycleEnd: nextMonth,
        },
      });

      // Create a Starter DeveloperPlan if one doesn't exist yet
      await prisma.developerPlan.upsert({
        where: { userId: user.id },
        update: {},  // returning developer — don't overwrite their paid plan
        create: {
          userId: user.id,
          tier: "STARTER",
          creditsIncluded: 200,
          creditsUsed: 0,
          billingCycleStart: now,
          billingCycleEnd: nextMonth,
          autoReloadEnabled: false,
          autoReloadAmount: 2000,
          overageRate: 0.005,
        },
      });
    },
  },
})
