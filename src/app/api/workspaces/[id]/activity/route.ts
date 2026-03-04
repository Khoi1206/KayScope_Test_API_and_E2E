import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { MongoDBActivityRepository } from '@/modules/activity/infrastructure/repositories/mongodb-activity.repository'

interface Params { params: { id: string } }

/** GET /api/workspaces/[id]/activity?limit=50&skip=0 */
export async function GET(req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(params.id)
    if (!ws) throw new NotFoundError('Workspace')

    const isMember = ws.ownerId === session.user.id ||
      ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const skip = parseInt(url.searchParams.get('skip') ?? '0')

    const activityRepo = new MongoDBActivityRepository()
    const [logs, total] = await Promise.all([
      activityRepo.findByWorkspace(params.id, limit, skip),
      activityRepo.countByWorkspace(params.id),
    ])

    return NextResponse.json({ logs, total, limit, skip })
  })
}
