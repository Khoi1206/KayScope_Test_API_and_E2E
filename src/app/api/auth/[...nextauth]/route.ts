import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'

/**
 * NextAuth v4 handler for App Router.
 * Handles all requests to /api/auth/* (signin, signout, session, csrf...)
 */
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
