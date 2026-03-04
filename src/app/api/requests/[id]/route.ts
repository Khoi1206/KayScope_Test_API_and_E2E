import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBRequestRepository } from '@/modules/request/infrastructure/repositories/mongodb-request.repository'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { NotFoundError } from '@/lib/errors/ValidationError'
import { logActivity } from '@/lib/activity/log-activity'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    await requireSession()
    const repo = new MongoDBRequestRepository()
    const req = await repo.findById(params.id)
    if (!req) throw new NotFoundError('Request')
    return NextResponse.json({ request: req })
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const repo = new MongoDBRequestRepository()
    const existing = await repo.findById(params.id)
    if (!existing) throw new NotFoundError('Request')
    const updated = await repo.update(params.id, {
      name: body.name,
      folderId: body.folderId,
      method: body.method,
      url: body.url,
      headers: body.headers,
      params: body.params,
      body: body.body,
      auth: body.auth,
      preRequestScript: body.preRequestScript,
      postRequestScript: body.postRequestScript,
    })
    const colRepo = new MongoDBCollectionRepository()
    const col = await colRepo.findById(existing.collectionId)
    if (col) logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'updated', resourceType: 'request', resourceName: body.name ?? existing.name, details: `${body.method ?? existing.method} ${body.url ?? existing.url}` })
    return NextResponse.json({ request: updated })
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBRequestRepository()
    const existing = await repo.findById(params.id)
    if (!existing) throw new NotFoundError('Request')
    await repo.delete(params.id)
    const colRepo = new MongoDBCollectionRepository()
    const col = await colRepo.findById(existing.collectionId)
    if (col) logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'deleted', resourceType: 'request', resourceName: existing.name })
    return NextResponse.json({ deleted: true })
  })
}
