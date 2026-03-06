import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBRequestRepository } from '@/modules/request/infrastructure/repositories/mongodb-request.repository'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { CreateRequestUseCase } from '@/modules/request/domain/usecases/create-request.usecase'
import { GetRequestsUseCase } from '@/modules/request/domain/usecases/get-requests.usecase'
import { ValidationError, NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
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
    const repo = new MongoDBRequestRepository()
    const useCase = new GetRequestsUseCase(repo)
    const requests = await useCase.execute(collectionId)
    return NextResponse.json({ requests })
  })
}

export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const colRepo = new MongoDBCollectionRepository()
    const col = await colRepo.findById(body.collectionId)
    if (!col) throw new NotFoundError('Collection')
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(col.workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    const repo = new MongoDBRequestRepository()
    const useCase = new CreateRequestUseCase(repo)
    const request = await useCase.execute({
      collectionId: body.collectionId,
      folderId: body.folderId,
      name: body.name,
      method: body.method ?? 'GET',
      url: body.url ?? '',
      headers: body.headers,
      params: body.params,
      body: body.body,
      auth: body.auth,
      preRequestScript: body.preRequestScript,
      postRequestScript: body.postRequestScript,
      createdBy: session.user.id,
    })
    logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'created', resourceType: 'request', resourceName: request.name, details: `${request.method} ${request.url || '(no url)'}` })
    return NextResponse.json({ request }, { status: 201 })
  })
}
