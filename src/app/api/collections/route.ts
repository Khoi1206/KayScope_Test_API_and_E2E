import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { CreateCollectionUseCase } from '@/modules/collection/domain/usecases/create-collection.usecase'
import { GetCollectionsUseCase } from '@/modules/collection/domain/usecases/get-collections.usecase'
import { ValidationError, NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { logActivity } from '@/lib/activity/log-activity'
import { createCollectionBodySchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) throw new ValidationError('workspaceId query param is required')
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    const repo = new MongoDBCollectionRepository()
    const useCase = new GetCollectionsUseCase(repo)
    const collections = await useCase.execute(workspaceId)
    return NextResponse.json({ collections })
  })
}

export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const raw = await req.json()
    const parsed = createCollectionBodySchema.safeParse(raw)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
    const { workspaceId, name, description } = parsed.data
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')
    const repo = new MongoDBCollectionRepository()
    const useCase = new CreateCollectionUseCase(repo)
    const collection = await useCase.execute({
      workspaceId,
      name,
      description,
      createdBy: session.user.id,
    })
    logActivity({ workspaceId, userId: session.user.id, userName: session.user.name ?? 'User', action: 'created', resourceType: 'collection', resourceName: collection.name })
    return NextResponse.json({ collection }, { status: 201 })
  })
}
