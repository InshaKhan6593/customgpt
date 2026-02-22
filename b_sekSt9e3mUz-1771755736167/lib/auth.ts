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
})
