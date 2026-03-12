import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { NotFoundError, ValidationError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { MongoDBFolderRepository } from '@/modules/folder/infrastructure/repositories/mongodb-folder.repository'
import { MongoDBRequestRepository } from '@/modules/request/infrastructure/repositories/mongodb-request.repository'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { logActivity } from '@/lib/activity/log-activity'
import { updateFolderBodySchema } from '@/lib/schemas'

interface Params { params: { id: string } }

/** Resolves a folder's workspace and asserts the caller is a member. */
async function assertFolderMember(collectionId: string, sessionUserId: string) {
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

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const parsed = updateFolderBodySchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
    const repo = new MongoDBFolderRepository()
    const folder = await repo.findById(params.id)
    if (!folder) throw new NotFoundError('Folder')
    const { col } = await assertFolderMember(folder.collectionId, session.user.id)
    const updated = await repo.update(params.id, { name: parsed.data.name })
    logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'updated', resourceType: 'folder', resourceName: parsed.data.name })
    return NextResponse.json({ folder: updated })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBFolderRepository()
    const folder = await repo.findById(params.id)
    if (!folder) throw new NotFoundError('Folder')
    const { col } = await assertFolderMember(folder.collectionId, session.user.id)

    // Collect this folder and all its descendants
    const allFolders = await repo.findByCollection(folder.collectionId)
    const toDelete = [params.id]
    const findChildren = (parentId: string) => {
      for (const f of allFolders) {
        if (f.parentFolderId === parentId) {
          toDelete.push(f.id)
          findChildren(f.id)
        }
      }
    }
    findChildren(params.id)

    // Delete all requests inside every folder being removed
    const reqRepo = new MongoDBRequestRepository()
    await Promise.all(toDelete.map(fid => reqRepo.deleteByFolder(fid)))

    // Delete all folder documents
    await Promise.all(toDelete.map(fid => repo.delete(fid)))

    logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'deleted', resourceType: 'folder', resourceName: folder.name })
    return NextResponse.json({ deleted: true })
  })
}
