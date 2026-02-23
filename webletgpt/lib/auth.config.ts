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
        if (user.name) token.name = user.name
      }
      
      // Handle the session update when role or name is changed
      if (trigger === "update") {
        if (session?.role) token.role = session.role
        if (session?.name) token.name = session.name
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as "USER" | "DEVELOPER" | "ADMIN"
        if (token.name) session.user.name = token.name as string
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
