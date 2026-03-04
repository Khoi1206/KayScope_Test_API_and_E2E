'use server'

import { AppError } from '@/lib/errors'

export interface ActionState {
  success: boolean
  message?: string
  fields?: Record<string, string>
}

/**
 * registerAction — Server Action for handling the registration form.
 * Calls the API route instead of the use case directly
 * to leverage Next.js middleware and the HTTP layer.
 */
export async function registerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // Validate confirm password at the presentation layer
  if (password !== confirmPassword) {
    return {
      success: false,
      fields: { confirmPassword: 'Passwords do not match' },
    }
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        message: data.message,
        fields: data.fields,
      }
    }

    return {
      success: true,
      message: 'Registration successful! Redirecting...',
    }
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, message: error.message }
    }
    console.error('[registerAction]', error)
    return { success: false, message: 'An unexpected error occurred, please try again' }
  }
}