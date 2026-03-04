import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { RegisterForm } from '@/modules/auth/presentation/components/RegisterForm'

/**
 * Register page — Server Component.
 * Redirects to dashboard if already authenticated.
 */
export default async function RegisterPage() {
  const session = await getServerSession()

  if (session) {
    redirect('/dashboard')
  }

  return <RegisterForm />
}
