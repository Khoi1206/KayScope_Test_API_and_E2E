import { NextResponse } from 'next/server'
import { AppError } from '../errors/AppError'

/** Wraps a route handler and converts AppError / unknown errors into JSON responses. */
export async function withApiHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler()
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[API error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
