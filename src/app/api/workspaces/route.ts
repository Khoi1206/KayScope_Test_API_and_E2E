import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { CreateWorkspaceUseCase } from '@/modules/workspace/domain/usecases/create-workspace.usecase'
import { GetWorkspacesUseCase } from '@/modules/workspace/domain/usecases/get-workspaces.usecase'
import { ValidationError } from '@/lib/errors/ValidationError'
import { logActivity } from '@/lib/activity/log-activity'

export async function GET() {
  return withApiHandler(async () => {
    const session = await requireSession()
    const repo = new MongoDBWorkspaceRepository()
    const useCase = new GetWorkspacesUseCase(repo)
    const workspaces = await useCase.execute(session.user.id)
    return NextResponse.json({ workspaces })
  })
}

export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const name = (body.name as string | undefined)?.trim()
    if (!name || name.length < 2) throw new ValidationError('Workspace name must be at least 2 characters')
    const repo = new MongoDBWorkspaceRepository()
    const useCase = new CreateWorkspaceUseCase(repo)
    const workspace = await useCase.execute({
      name,
      description: body.description,
      ownerId: session.user.id,
    })
    logActivity({ workspaceId: workspace.id, userId: session.user.id, userName: session.user.name ?? 'User', action: 'created', resourceType: 'workspace', resourceName: workspace.name })
    return NextResponse.json({ workspace }, { status: 201 })
  })
}
