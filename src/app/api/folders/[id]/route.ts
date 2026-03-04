import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { NotFoundError } from '@/lib/errors/ValidationError'
import { MongoDBFolderRepository } from '@/modules/folder/infrastructure/repositories/mongodb-folder.repository'
import { MongoDBRequestRepository } from '@/modules/request/infrastructure/repositories/mongodb-request.repository'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { logActivity } from '@/lib/activity/log-activity'

interface Params { params: { id: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const repo = new MongoDBFolderRepository()
    const folder = await repo.findById(params.id)
    if (!folder) throw new NotFoundError('Folder')
    const updated = await repo.update(params.id, { name: body.name })
    const colRepo = new MongoDBCollectionRepository()
    const col = await colRepo.findById(folder.collectionId)
    if (col) logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'updated', resourceType: 'folder', resourceName: body.name ?? folder.name })
    return NextResponse.json({ folder: updated })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBFolderRepository()
    const folder = await repo.findById(params.id)
    if (!folder) throw new NotFoundError('Folder')

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

    const colRepo = new MongoDBCollectionRepository()
    const col = await colRepo.findById(folder.collectionId)
    if (col) logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'deleted', resourceType: 'folder', resourceName: folder.name })
    return NextResponse.json({ deleted: true })
  })
}
