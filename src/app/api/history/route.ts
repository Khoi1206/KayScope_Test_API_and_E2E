import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBHistoryRepository } from '@/modules/history/infrastructure/repositories/mongodb-history.repository'
import { MongoDBRequestRepository } from '@/modules/request/infrastructure/repositories/mongodb-request.repository'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { ValidationError, NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'

export const dynamic = 'force-dynamic'

async function checkWorkspaceMembership(workspaceId: string, userId: string) {
  const wsRepo = new MongoDBWorkspaceRepository()
  const ws = await wsRepo.findById(workspaceId)
  if (!ws) throw new NotFoundError('Workspace')
  const isMember = ws.ownerId === userId || ws.members.some(m => m.userId === userId)
  if (!isMember) throw new UnauthorizedError('Access denied')
}

export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()

    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    const requestId = req.nextUrl.searchParams.get('requestId')
    const limitStr = req.nextUrl.searchParams.get('limit')
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 200) : 50

    const repo = new MongoDBHistoryRepository()

    if (requestId) {
      const reqRepo = new MongoDBRequestRepository()
      const request = await reqRepo.findById(requestId)
      if (!request) throw new NotFoundError('Request')
      const colRepo = new MongoDBCollectionRepository()
      const col = await colRepo.findById(request.collectionId)
      if (!col) throw new NotFoundError('Collection')
      await checkWorkspaceMembership(col.workspaceId, session.user.id)
      const entries = await repo.findByRequest(requestId, limit)
      return NextResponse.json({ history: entries })
    }
    if (workspaceId) {
      await checkWorkspaceMembership(workspaceId, session.user.id)
      const entries = await repo.findByWorkspace(workspaceId, limit)
      return NextResponse.json({ history: entries })
    }

    throw new ValidationError('workspaceId or requestId query param is required')
  })
}
