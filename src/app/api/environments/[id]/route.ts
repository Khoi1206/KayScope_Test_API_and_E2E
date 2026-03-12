import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBEnvironmentRepository } from '@/modules/environment/infrastructure/repositories/mongodb-environment.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { NotFoundError, ValidationError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { logActivity } from '@/lib/activity/log-activity'
import { updateEnvironmentBodySchema } from '@/lib/schemas'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBEnvironmentRepository()
    const env = await repo.findById(params.id)
    if (!env) throw new NotFoundError('Environment')
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(env.workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    return NextResponse.json({ environment: env })
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBEnvironmentRepository()
    const env = await repo.findById(params.id)
    if (!env) throw new NotFoundError('Environment')
    const isAllowed = env.createdBy === session.user.id
    if (!isAllowed) {
      const { MongoDBWorkspaceRepository } = await import('@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository')
      const ws = await new MongoDBWorkspaceRepository().findById(env.workspaceId)
      if (!ws || ws.ownerId !== session.user.id) throw new UnauthorizedError('Forbidden')
    }
    const body = await req.json()
    const parsed = updateEnvironmentBodySchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
    const updated = await repo.update(params.id, parsed.data)
    logActivity({ workspaceId: env.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'updated', resourceType: 'environment', resourceName: parsed.data.name ?? env.name })
    return NextResponse.json({ environment: updated })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBEnvironmentRepository()
    const env = await repo.findById(params.id)
    if (!env) throw new NotFoundError('Environment')
    const isAllowed = env.createdBy === session.user.id
    if (!isAllowed) {
      const { MongoDBWorkspaceRepository } = await import('@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository')
      const ws = await new MongoDBWorkspaceRepository().findById(env.workspaceId)
      if (!ws || ws.ownerId !== session.user.id) throw new UnauthorizedError('Forbidden')
    }
    await repo.delete(params.id)
    logActivity({ workspaceId: env.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'deleted', resourceType: 'environment', resourceName: env.name })
    return NextResponse.json({ deleted: true })
  })
}
