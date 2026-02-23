import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

// In Next.js 16, proxy.ts handles route interception at the edge (replacing middleware.ts)
// Auth.js Edge compatibility allows reading the session without hitting the DB.

const publicRoutes = ['/login', '/auth/error', '/api/auth', '/marketplace', '/pricing', '/api/marketplace']
const marketplaceFallback = '/marketplace' 

export default async function proxy(request: NextRequest) {
  const session = await auth()
  const path = request.nextUrl.pathname

  // 1. Allow public routes
  if (publicRoutes.some(route => path.startsWith(route))) {
    return NextResponse.next()
  }

  // 2. Protect authenticated routes
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', encodeURI(request.url))
    return NextResponse.redirect(loginUrl)
  }

  const userRole = session.user.role

  // 3. Enforce Role-Based Access Control
  
  // Dashboard routes require DEVELOPER or higher
  if (path.startsWith('/dashboard')) {
    if (userRole === 'USER') {
      // NOTE: For demonstration in v0 frontend, redirecting to root if marketplace doesn't exist yet
      const redirectUrl = new URL(marketplaceFallback, request.url)
      redirectUrl.searchParams.set('error', 'upgrade_required')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Admin routes require ADMIN role
  if (path.startsWith('/admin')) {
    if (userRole !== 'ADMIN') {
      const redirectUrl = new URL(userRole === 'DEVELOPER' ? '/dashboard' : marketplaceFallback, request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Apply to all routes except static files, images, favicon, etc.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
