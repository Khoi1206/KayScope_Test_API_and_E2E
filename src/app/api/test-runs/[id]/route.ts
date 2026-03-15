import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBTestRunRepository } from '@/modules/test-run/infrastructure/repositories/mongodb-test-run.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { ValidationError, NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'

export const dynamic = 'force-dynamic'

async function assertRunOwnership(id: string, userId: string) {
  const repo = new MongoDBTestRunRepository()
  const run = await repo.findById(id)
  if (!run) throw new NotFoundError('Test run')
  const wsRepo = new MongoDBWorkspaceRepository()
  const ws = await wsRepo.findById(run.workspaceId)
  if (!ws) throw new NotFoundError('Workspace')
  const isMember = ws.ownerId === userId || ws.members.some(m => m.userId === userId)
  if (!isMember) throw new UnauthorizedError('Access denied')
  return run
}

const updateTestRunSchema = z.object({
  result: z.object({
    success: z.boolean(),
    summary: z.object({
      total: z.number(),
      passed: z.number(),
      failed: z.number(),
      skipped: z.number(),
      duration: z.number(),
    }),
    tests: z.array(z.object({
      testName: z.string(),
      status: z.string(),
      duration: z.number(),
      error: z.string().optional(),
    })),
    rawOutput: z.string(),
    generatedCode: z.string(),
  }),
  savedAt: z.string(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(async () => {
    const session = await requireSession()
    await assertRunOwnership(params.id, session.user.id)
    const body = await req.json()
    const parsed = updateTestRunSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid body')
    const repo = new MongoDBTestRunRepository()
    const updated = await repo.update(params.id, parsed.data as import('@/modules/test-run/domain/entities/test-run.entity').UpdateTestRunDTO)
    return NextResponse.json({ run: updated })
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(async () => {
    const session = await requireSession()
    await assertRunOwnership(params.id, session.user.id)
    const repo = new MongoDBTestRunRepository()
    await repo.delete(params.id)
    return NextResponse.json({ ok: true })
  })
}
