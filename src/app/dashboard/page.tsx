import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/ToastContext'

/**
 * Dashboard — Server Component.
 * Validates session server-side then renders the full client-side app shell.
 */
export default async function DashboardPage() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <ToastProvider>
      <AppShell
        userName={session.user.name ?? 'User'}
        userEmail={session.user.email ?? ''}
        userId={session.user.id ?? ''}
      />
    </ToastProvider>
  )
}
