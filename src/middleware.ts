import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

/**
 * Route protection middleware — uses NextAuth v4's withAuth wrapper.
 *
 * Routes in the matcher require authentication.
 * If not authenticated → redirect to /login (configured in authOptions.pages).
 *
 * Public routes (no protection needed):
 * - /login, /register — auth pages
 * - /api/auth/* — NextAuth handlers
 * - /_next/*, /favicon.ico — static assets
 */
export default withAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function middleware(_req) {
    // Add custom logic here if needed (e.g. role checks)
    return NextResponse.next()
  },
  {
    callbacks: {
      /**
       * authorized callback: return true to allow the request.
       * If false → redirect to authOptions.pages.signIn (/login).
       */
      authorized({ token }) {
        // token present = authenticated
        return !!token
      },
    },
  }
)

/**
 * Matcher — Apply middleware only to routes that require protection.
 *
 * Excludes:
 * - /login, /register (public auth pages)
 * - /api/auth/* (NextAuth API)
 * - Static files (_next, favicon...)
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/test-builder/:path*',
    '/test-builder',
    '/api/playwright/:path*',
    '/workspace/:path*',
    '/api/workspaces/:path*',
    '/api/collections/:path*',
    '/api/requests/:path*',
    '/api/environments/:path*',
    '/api/execute',
    '/api/history/:path*',
    '/api/history',
    '/api/export',
    '/api/folders',
    '/api/folders/:path*',
  ],
}
