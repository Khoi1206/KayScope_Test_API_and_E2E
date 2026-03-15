import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBTestRunRepository } from '@/modules/test-run/infrastructure/repositories/mongodb-test-run.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { ValidationError, NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'

export const dynamic = 'force-dynamic'

async function checkWorkspaceMembership(workspaceId: string, userId: string) {
  const wsRepo = new MongoDBWorkspaceRepository()
  const ws = await wsRepo.findById(workspaceId)
  if (!ws) throw new NotFoundError('Workspace')
  const isMember = ws.ownerId === userId || ws.members.some(m => m.userId === userId)
  if (!isMember) throw new UnauthorizedError('Access denied')
}

const testResultSchema = z.object({
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
})

const createTestRunSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  code: z.string(),
  blocklyState: z.unknown().optional(),
  result: testResultSchema,
  savedAt: z.string(),
})

export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) throw new ValidationError('workspaceId query param is required')
    await checkWorkspaceMembership(workspaceId, session.user.id)
    const repo = new MongoDBTestRunRepository()
    const runs = await repo.findByWorkspace(workspaceId)
    return NextResponse.json({ runs })
  })
}

export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const parsed = createTestRunSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid body')
    const { workspaceId, name, code, blocklyState, result, savedAt } = parsed.data
    await checkWorkspaceMembership(workspaceId, session.user.id)
    const repo = new MongoDBTestRunRepository()
    const run = await repo.create({
      workspaceId,
      userId: session.user.id,
      name,
      code,
      blocklyState: blocklyState as object | undefined,
      result: result as import('@/app/test-builder/types').RunResult,
      savedAt,
    })
    return NextResponse.json({ run }, { status: 201 })
  })
}
