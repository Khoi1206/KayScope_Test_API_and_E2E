import { Workspace, CreateWorkspaceDTO, UpdateWorkspaceDTO } from '../entities/workspace.entity'

export interface IWorkspaceRepository {
  findById(id: string): Promise<Workspace | null>
  findByOwner(ownerId: string): Promise<Workspace[]>
  findByMember(userId: string): Promise<Workspace[]>
  create(dto: CreateWorkspaceDTO): Promise<Workspace>
  update(id: string, dto: UpdateWorkspaceDTO): Promise<Workspace | null>
  addMember(workspaceId: string, userId: string, role: string): Promise<Workspace | null>
  removeMember(workspaceId: string, userId: string): Promise<Workspace | null>
  delete(id: string): Promise<boolean>
}
