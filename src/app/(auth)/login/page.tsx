import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { LoginForm } from '@/modules/auth/presentation/components/LoginForm'

/**
 * Login page — Server Component.
 * Redirects to dashboard if already authenticated.
 */
export default async function LoginPage() {
  const session = await getServerSession()

  // Already authenticated → redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }

  return <LoginForm />
}
