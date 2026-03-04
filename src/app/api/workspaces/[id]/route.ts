import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { logActivity } from '@/lib/activity/log-activity'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBWorkspaceRepository()
    const ws = await repo.findById(params.id)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id ||
      ws.members.some((m) => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    return NextResponse.json({ workspace: ws })
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBWorkspaceRepository()
    const ws = await repo.findById(params.id)
    if (!ws) throw new NotFoundError('Workspace')
    if (ws.ownerId !== session.user.id) throw new UnauthorizedError('Only the owner can update this workspace')
    const body = await req.json()
    const updated = await repo.update(params.id, { name: body.name, description: body.description })
    logActivity({ workspaceId: params.id, userId: session.user.id, userName: session.user.name ?? 'User', action: 'updated', resourceType: 'workspace', resourceName: body.name ?? ws.name })
    return NextResponse.json({ workspace: updated })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBWorkspaceRepository()
    const ws = await repo.findById(params.id)
    if (!ws) throw new NotFoundError('Workspace')
    if (ws.ownerId !== session.user.id) throw new UnauthorizedError('Only the owner can delete this workspace')
    await repo.delete(params.id)
    logActivity({ workspaceId: params.id, userId: session.user.id, userName: session.user.name ?? 'User', action: 'deleted', resourceType: 'workspace', resourceName: ws.name })
    return NextResponse.json({ deleted: true })
  })
}
