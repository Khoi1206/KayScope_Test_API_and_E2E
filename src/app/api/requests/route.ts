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
import { createRequestBodySchema } from '@/lib/schemas'

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
    const raw = await req.json()
    const parsed = createRequestBodySchema.safeParse(raw)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
    const { collectionId, folderId, name, method, url, headers, params: queryParams, body: reqBody, auth, preRequestScript, postRequestScript } = parsed.data
    const colRepo = new MongoDBCollectionRepository()
    const col = await colRepo.findById(collectionId)
    if (!col) throw new NotFoundError('Collection')
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(col.workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    const repo = new MongoDBRequestRepository()
    const useCase = new CreateRequestUseCase(repo)
    const request = await useCase.execute({
      collectionId,
      folderId,
      name,
      method,
      url,
      headers,
      params: queryParams,
      body: reqBody,
      auth,
      preRequestScript,
      postRequestScript,
      createdBy: session.user.id,
    })
    logActivity({ workspaceId: col.workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'created', resourceType: 'request', resourceName: request.name, details: `${request.method} ${request.url || '(no url)'}` })
    return NextResponse.json({ request }, { status: 201 })
  })
}
