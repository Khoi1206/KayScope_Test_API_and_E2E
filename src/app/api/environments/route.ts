import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBEnvironmentRepository } from '@/modules/environment/infrastructure/repositories/mongodb-environment.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { CreateEnvironmentUseCase } from '@/modules/environment/domain/usecases/create-environment.usecase'
import { GetEnvironmentsUseCase } from '@/modules/environment/domain/usecases/get-environments.usecase'
import { ValidationError, NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { logActivity } from '@/lib/activity/log-activity'
import { createEnvironmentBodySchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) throw new ValidationError('workspaceId query param is required')
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    const repo = new MongoDBEnvironmentRepository()
    const useCase = new GetEnvironmentsUseCase(repo)
    const envs = await useCase.execute(workspaceId)
    return NextResponse.json({ environments: envs })
  })
}

export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const raw = await req.json()
    const parsed = createEnvironmentBodySchema.safeParse(raw)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
    const { workspaceId, name, variables } = parsed.data
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    const repo = new MongoDBEnvironmentRepository()
    const useCase = new CreateEnvironmentUseCase(repo)
    const env = await useCase.execute({
      workspaceId,
      name,
      variables,
      createdBy: session.user.id,
    })
    logActivity({ workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'created', resourceType: 'environment', resourceName: env.name })
    return NextResponse.json({ environment: env }, { status: 201 })
  })
}
