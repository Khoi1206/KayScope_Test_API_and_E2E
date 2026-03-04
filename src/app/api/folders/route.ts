import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { ValidationError, NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { MongoDBFolderRepository } from '@/modules/folder/infrastructure/repositories/mongodb-folder.repository'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { logActivity } from '@/lib/activity/log-activity'

export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const collectionId = req.nextUrl.searchParams.get('collectionId')
    if (!collectionId) throw new ValidationError('collectionId query param is required')
    const colRepo = new MongoDBCollectionRepository()
    const col = await colRepo.findById(collectionId)
    if (!col) throw new NotFoundError('Collection')
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(col.workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    const repo = new MongoDBFolderRepository()
    const folders = await repo.findByCollection(collectionId)
    return NextResponse.json({ folders })
  })
}

export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    if (!body.collectionId) throw new ValidationError('collectionId is required')
    if (!body.name?.trim()) throw new ValidationError('name is required')
    const repo = new MongoDBFolderRepository()
    const folder = await repo.create({
      collectionId: body.collectionId,
      parentFolderId: body.parentFolderId ?? undefined,
      name: body.name.trim(),
      createdBy: session.user.id,
    })
    const colRepo = new MongoDBCollectionRepository()
    const col = await colRepo.findById(body.collectionId)
    if (col) logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'created', resourceType: 'folder', resourceName: folder.name })
    return NextResponse.json({ folder }, { status: 201 })
  })
}
