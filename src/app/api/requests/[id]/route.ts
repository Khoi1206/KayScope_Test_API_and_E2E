import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBRequestRepository } from '@/modules/request/infrastructure/repositories/mongodb-request.repository'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { NotFoundError, ValidationError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { logActivity } from '@/lib/activity/log-activity'
import { updateRequestBodySchema } from '@/lib/schemas'

interface Params { params: { id: string } }

/** Resolves collection + workspace and asserts caller is a member. */
async function assertMember(collectionId: string, sessionUserId: string) {
  const colRepo = new MongoDBCollectionRepository()
  const col = await colRepo.findById(collectionId)
  if (!col) throw new NotFoundError('Collection')
  const wsRepo = new MongoDBWorkspaceRepository()
  const ws = await wsRepo.findById(col.workspaceId)
  if (!ws) throw new NotFoundError('Workspace')
  const isMember = ws.ownerId === sessionUserId || ws.members.some(m => m.userId === sessionUserId)
  if (!isMember) throw new UnauthorizedError('Access denied')
  return { col, ws }
}

export async function GET(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBRequestRepository()
    const req = await repo.findById(params.id)
    if (!req) throw new NotFoundError('Request')
    await assertMember(req.collectionId, session.user.id)
    return NextResponse.json({ request: req })
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const raw = await req.json()
    const parsed = updateRequestBodySchema.safeParse(raw)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
    const repo = new MongoDBRequestRepository()
    const existing = await repo.findById(params.id)
    if (!existing) throw new NotFoundError('Request')
    const { col } = await assertMember(existing.collectionId, session.user.id)
    const updated = await repo.update(params.id, parsed.data)
    logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'updated', resourceType: 'request', resourceName: parsed.data.name ?? existing.name, details: `${parsed.data.method ?? existing.method} ${parsed.data.url ?? existing.url}` })
    return NextResponse.json({ request: updated })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBRequestRepository()
    const existing = await repo.findById(params.id)
    if (!existing) throw new NotFoundError('Request')
    const { col } = await assertMember(existing.collectionId, session.user.id)
    await repo.delete(params.id)
    logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'deleted', resourceType: 'request', resourceName: existing.name })
    return NextResponse.json({ deleted: true })
  })
}
