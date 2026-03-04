import { MongoDBActivityRepository } from '@/modules/activity/infrastructure/repositories/mongodb-activity.repository'
import type { ActivityAction, ActivityResourceType } from '@/modules/activity/domain/entities/activity.entity'

/**
 * Fire-and-forget activity logger. Call from API route handlers after mutations.
 * Failures are swallowed so they never break the primary operation.
 */
export async function logActivity(opts: {
  workspaceId: string
  userId: string
  userName: string
  action: ActivityAction
  resourceType: ActivityResourceType
  resourceName: string
  details?: string
}): Promise<void> {
  try {
    const repo = new MongoDBActivityRepository()
    await repo.create(opts)
  } catch {
    // silently swallow — activity logging must never break primary ops
  }
}
