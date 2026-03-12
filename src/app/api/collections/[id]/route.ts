import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { MongoDBRequestRepository } from '@/modules/request/infrastructure/repositories/mongodb-request.repository'
import { MongoDBFolderRepository } from '@/modules/folder/infrastructure/repositories/mongodb-folder.repository'
import { NotFoundError, ValidationError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { logActivity } from '@/lib/activity/log-activity'
import { updateCollectionBodySchema } from '@/lib/schemas'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    await requireSession()
    const repo = new MongoDBCollectionRepository()
    const col = await repo.findById(params.id)
    if (!col) throw new NotFoundError('Collection')
    return NextResponse.json({ collection: col })
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBCollectionRepository()
    const col = await repo.findById(params.id)
    if (!col) throw new NotFoundError('Collection')
    // Workspace owner or collection creator may rename
    const isAllowed = col.createdBy === session.user.id
    if (!isAllowed) {
      const { MongoDBWorkspaceRepository } = await import('@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository')
      const ws = await new MongoDBWorkspaceRepository().findById(col.workspaceId)
      if (!ws || ws.ownerId !== session.user.id) throw new UnauthorizedError('Forbidden')
    }
    const body = await req.json()
    const parsed = updateCollectionBodySchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
    const updated = await repo.update(params.id, parsed.data)
    logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'updated', resourceType: 'collection', resourceName: parsed.data.name ?? col.name })
    return NextResponse.json({ collection: updated })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBCollectionRepository()
    const col = await repo.findById(params.id)
    if (!col) throw new NotFoundError('Collection')
    // Workspace owner or collection creator may delete
    const isAllowed = col.createdBy === session.user.id
    if (!isAllowed) {
      const { MongoDBWorkspaceRepository } = await import('@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository')
      const ws = await new MongoDBWorkspaceRepository().findById(col.workspaceId)
      if (!ws || ws.ownerId !== session.user.id) throw new UnauthorizedError('Forbidden')
    }
    // Cascade: delete all requests and folders belonging to this collection
    const reqRepo = new MongoDBRequestRepository()
    const folderRepo = new MongoDBFolderRepository()
    await Promise.all([
      reqRepo.deleteByCollection(params.id),
      folderRepo.deleteByCollection(params.id),
    ])
    await repo.delete(params.id)
    logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'deleted', resourceType: 'collection', resourceName: col.name })
    return NextResponse.json({ deleted: true })
  })
}
