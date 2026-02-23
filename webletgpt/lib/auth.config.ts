import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  providers: [], // Configured in auth.ts to avoid edge-compatibility issues with Prisma Adapter
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Basic check, more granular checks happens in proxy.ts
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      // Handle the session update when role is upgraded
      if (trigger === "update" && session?.role) {
        token.role = session.role
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as "USER" | "DEVELOPER" | "ADMIN"
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // If there's a callback URL, honour it
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith("/")) return `${baseUrl}${url}`
      return baseUrl
    },
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig
