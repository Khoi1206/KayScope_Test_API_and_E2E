import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { ValidationError } from '@/lib/errors/ValidationError'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { MongoDBUserRepository } from '@/modules/auth/infrastructure/repositories/mongodb-user.repository'
import { logActivity } from '@/lib/activity/log-activity'

interface Params { params: { id: string; userId: string } }

/** DELETE /api/workspaces/[id]/members/[userId] — remove a member */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(params.id)
    if (!ws) throw new NotFoundError('Workspace')
    if (ws.ownerId !== session.user.id) throw new UnauthorizedError('Only the owner can remove members')
    if (params.userId === ws.ownerId) throw new ValidationError('Cannot remove the owner')
    if (!ws.members.some(m => m.userId === params.userId)) throw new NotFoundError('Member')

    const userRepo = new MongoDBUserRepository()
    const removedUser = await userRepo.findById(params.userId)
    const updated = await wsRepo.removeMember(params.id, params.userId)
    logActivity({ workspaceId: params.id, userId: session.user.id, userName: session.user.name ?? 'User', action: 'removed', resourceType: 'member', resourceName: removedUser?.name ?? params.userId })
    return NextResponse.json({ workspace: updated })
  })
}
