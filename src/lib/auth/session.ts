import { getServerSession as nextAuthGetServerSession } from 'next-auth'
import { authOptions } from './auth.config'
import { UnauthenticatedError } from '@/lib/errors'
import type { Session } from 'next-auth'

/**
 * getServerSession — Wrapper around NextAuth v4's getServerSession.
 *
 * Use in Server Components and API Route Handlers:
 * ```ts
 * const session = await getServerSession()
 * ```
 *
 * ✅ v4 style — do NOT import { auth } from '@/auth'
 */
export async function getServerSession(): Promise<Session | null> {
  return nextAuthGetServerSession(authOptions)
}

/**
 * requireSession — Retrieves session and throws if the user is not authenticated.
 * Use in Server Actions or protected API routes.
 *
 * ```ts
 * const session = await requireSession()
 * const userId = session.user.id
 * ```
 */
export async function requireSession(): Promise<Session> {
  const session = await getServerSession()
  if (!session) {
    throw new UnauthenticatedError()
  }
  return session
}
