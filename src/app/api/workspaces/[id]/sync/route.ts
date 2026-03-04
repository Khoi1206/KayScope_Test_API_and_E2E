import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import { MongoDBActivityRepository } from '@/modules/activity/infrastructure/repositories/mongodb-activity.repository'

export const dynamic = 'force-dynamic'

const POLL_INTERVAL_MS = 4000
const HEARTBEAT_INTERVAL_MS = 20000

interface Params { params: { id: string } }

/**
 * GET /api/workspaces/[id]/sync
 *
 * Server-Sent Events stream. Polls MongoDB every 4 s for new activity logs
 * and pushes them to connected clients. Clients use this to detect when
 * teammates make changes and re-fetch the relevant data.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify workspace access
  const wsRepo = new MongoDBWorkspaceRepository()
  const ws = await wsRepo.findById(params.id)
  if (!ws) return new Response('Not Found', { status: 404 })

  const isMember = ws.ownerId === session.user.id ||
    ws.members.some(m => m.userId === session.user.id)
  if (!isMember) return new Response('Forbidden', { status: 403 })

  const activityRepo = new MongoDBActivityRepository()
  const encoder = new TextEncoder()
  let lastChecked = new Date()
  let closed = false
  // Declared here so cancel() can clear them
  let pollTimer: ReturnType<typeof setInterval> | undefined
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { closed = true }
      }

      // Send initial connected event
      send('connected', { workspaceId: params.id, userId: session.user.id })

      // Poll loop
      pollTimer = setInterval(async () => {
        if (closed) return
        try {
          const since = lastChecked
          lastChecked = new Date()
          const logs = await activityRepo.findByWorkspaceSince(params.id, since)
          for (const log of logs) {
            send('activity', {
              id: log.id,
              action: log.action,
              resourceType: log.resourceType,
              resourceName: log.resourceName,
              userName: log.userName,
              userId: log.userId,
              details: log.details,
              createdAt: log.createdAt,
            })
          }
        } catch { /* swallow poll errors — connection stays alive */ }
      }, POLL_INTERVAL_MS)

      // Heartbeat to keep proxies / load balancers from closing idle connections
      heartbeatTimer = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch { closed = true }
      }, HEARTBEAT_INTERVAL_MS)
    },
    cancel() {
      closed = true
      clearInterval(pollTimer)
      clearInterval(heartbeatTimer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
