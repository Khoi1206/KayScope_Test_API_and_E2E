'use client'

import { SessionProvider } from 'next-auth/react'

/**
 * Providers — Wraps the entire app with required context providers.
 * Must be a Client Component because SessionProvider uses React context.
 *
 * Extracted into its own file so layout.tsx remains a Server Component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
