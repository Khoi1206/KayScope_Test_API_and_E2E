import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { ValidationError, NotFoundError } from '@/lib/errors/ValidationError'
import { UnauthorizedError } from '@/lib/errors/AuthError'
import { MongoDBCollectionRepository } from '@/modules/collection/infrastructure/repositories/mongodb-collection.repository'
import { MongoDBRequestRepository } from '@/modules/request/infrastructure/repositories/mongodb-request.repository'
import { MongoDBFolderRepository } from '@/modules/folder/infrastructure/repositories/mongodb-folder.repository'
import { MongoDBWorkspaceRepository } from '@/modules/workspace/infrastructure/repositories/mongodb-workspace.repository'
import type { HttpMethod, RequestBody, RequestAuth } from '@/modules/request/domain/entities/request.entity'

/**
 * GET /api/export?collectionId=xxx
 * Exports a collection and all its requests as JSON.
 */
export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()

    const collectionId = req.nextUrl.searchParams.get('collectionId')
    if (!collectionId) throw new ValidationError('collectionId query param is required')

    const colRepo = new MongoDBCollectionRepository()
    const reqRepo = new MongoDBRequestRepository()
    const folderRepo = new MongoDBFolderRepository()

    const collection = await colRepo.findById(collectionId)
    if (!collection) throw new NotFoundError('Collection')
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(collection.workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')

    const [requests, folders] = await Promise.all([
      reqRepo.findByCollection(collectionId),
      folderRepo.findByCollection(collectionId),
    ])

    const exportData = {
      _type: 'kayscope_collection',
      _version: '1.1',
      exportedAt: new Date().toISOString(),
      collection: {
        name: collection.name,
        description: collection.description ?? '',
      },
      folders: folders.map(f => ({
        id: f.id,
        parentFolderId: f.parentFolderId ?? null,
        name: f.name,
      })),
      requests: requests.map(r => ({
        name: r.name,
        folderId: r.folderId ?? null,
        method: r.method,
        url: r.url,
        headers: r.headers,
        params: r.params,
        body: r.body,
        auth: r.auth,
      })),
    }

    return NextResponse.json(exportData)
  })
}

/**
 * POST /api/export (import)
 * Imports a KayScope or Postman collection into a workspace.
 */
export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const workspaceId = body.workspaceId as string
    if (!workspaceId) throw new ValidationError('workspaceId is required')
    const wsRepo = new MongoDBWorkspaceRepository()
    const ws = await wsRepo.findById(workspaceId)
    if (!ws) throw new NotFoundError('Workspace')
    const isMember = ws.ownerId === session.user.id || ws.members.some(m => m.userId === session.user.id)
    if (!isMember) throw new UnauthorizedError('Access denied')

    const data = body.data
    if (!data) throw new ValidationError('data is required')

    const colRepo = new MongoDBCollectionRepository()
    const reqRepo = new MongoDBRequestRepository()
    const folderRepo = new MongoDBFolderRepository()

    // Detect format
    if (data._type === 'kayscope_collection') {
      return await importKayScope(data, workspaceId, session.user.id, colRepo, reqRepo, folderRepo)
    }

    // Try Postman v2.1 format
    if (data.info && data.item) {
      return await importPostman(data, workspaceId, session.user.id, colRepo, reqRepo, folderRepo)
    }

    throw new ValidationError('Unsupported import format. Supports KayScope and Postman v2.1 exports.')
  })
}

async function importKayScope(
  data: Record<string, unknown>,
  workspaceId: string,
  userId: string,
  colRepo: MongoDBCollectionRepository,
  reqRepo: MongoDBRequestRepository,
  folderRepo: MongoDBFolderRepository,
) {
  const colData = data.collection as { name: string; description?: string }
  const collection = await colRepo.create({
    workspaceId,
    name: colData.name || 'Imported Collection',
    description: colData.description,
    createdBy: userId,
  })

  // Recreate folders, mapping exported IDs → new MongoDB IDs
  const folderIdMap: Record<string, string> = {}
  const rawFolders = (data.folders ?? []) as Array<{ id: string; parentFolderId?: string | null; name: string }>

  // Topologically sort folders so parents always come before children,
  // regardless of the order MongoDB returned them in the original export.
  const foldersData: typeof rawFolders = []
  const addedFolderIds = new Set<string>()
  const bfsQueue = rawFolders.filter(f => !f.parentFolderId)
  while (bfsQueue.length > 0) {
    const f = bfsQueue.shift()!
    if (addedFolderIds.has(f.id)) continue
    foldersData.push(f)
    addedFolderIds.add(f.id)
    for (const child of rawFolders) {
      if (child.parentFolderId === f.id && !addedFolderIds.has(child.id)) {
        bfsQueue.push(child)
      }
    }
  }
  // Append any orphaned/circular-reference folders as root folders
  for (const f of rawFolders) {
    if (!addedFolderIds.has(f.id)) foldersData.push(f)
  }

  for (const f of foldersData) {
    const newParentId = f.parentFolderId ? folderIdMap[f.parentFolderId] : undefined
    const folder = await folderRepo.create({
      collectionId: collection.id,
      parentFolderId: newParentId,
      name: f.name,
      createdBy: userId,
    })
    folderIdMap[f.id] = folder.id
  }

  const requests = (data.requests ?? []) as Array<Record<string, unknown>>
  let imported = 0
  for (const r of requests) {
    const exportedFolderId = r.folderId as string | null | undefined
    await reqRepo.create({
      collectionId: collection.id,
      folderId: exportedFolderId ? folderIdMap[exportedFolderId] : undefined,
      name: (r.name as string) || 'Imported Request',
      method: ((r.method as string) || 'GET').toUpperCase() as HttpMethod,
      url: (r.url as string) || '',
      headers: (r.headers as Array<{ key: string; value: string; enabled: boolean; description?: string }>) ?? [],
      params: (r.params as Array<{ key: string; value: string; enabled: boolean; description?: string }>) ?? [],
      body: (r.body as RequestBody) ?? { type: 'none', content: '' },
      auth: (r.auth as RequestAuth) ?? { type: 'none' },
      createdBy: userId,
    })
    imported++
  }

  return NextResponse.json({
    collection,
    importedRequests: imported,
  }, { status: 201 })
}

async function importPostman(
  data: Record<string, unknown>,
  workspaceId: string,
  userId: string,
  colRepo: MongoDBCollectionRepository,
  reqRepo: MongoDBRequestRepository,
  folderRepo: MongoDBFolderRepository,
) {
  const info = data.info as { name?: string; description?: string }
  const collection = await colRepo.create({
    workspaceId,
    name: info.name || 'Postman Import',
    description: typeof info.description === 'string' ? info.description : '',
    createdBy: userId,
  })

  const items = (data.item ?? []) as Array<Record<string, unknown>>
  let imported = 0

  interface RequestEntry {
    name: string
    folderId: string | undefined
    request: Record<string, unknown>
  }

  // Recursively collect requests, creating Folder entities for each Postman folder
  async function collectRequests(
    items: Array<Record<string, unknown>>,
    parentFolderId: string | undefined,
  ): Promise<RequestEntry[]> {
    const result: RequestEntry[] = []
    for (const item of items) {
      if (item.request) {
        result.push({
          name: (item.name as string) || 'Request',
          folderId: parentFolderId,
          request: item.request as Record<string, unknown>,
        })
      }
      if (Array.isArray(item.item)) {
        const folder = await folderRepo.create({
          collectionId: collection.id,
          parentFolderId,
          name: (item.name as string) || 'Folder',
          createdBy: userId,
        })
        result.push(...await collectRequests(item.item as Array<Record<string, unknown>>, folder.id))
      }
    }
    return result
  }

  const allRequests = await collectRequests(items, undefined)

  for (const { name, folderId, request } of allRequests) {
    const method = (typeof request.method === 'string' ? request.method : 'GET').toUpperCase()

    // URL — can be string or object
    let url = ''
    if (typeof request.url === 'string') {
      url = request.url
    } else if (request.url && typeof request.url === 'object') {
      const urlObj = request.url as { raw?: string }
      url = urlObj.raw ?? ''
    }

    // Headers
    const rawHeaders = (request.header ?? []) as Array<{ key: string; value: string; disabled?: boolean; description?: string }>
    const headers = rawHeaders.map(h => ({
      key: h.key,
      value: h.value,
      enabled: !h.disabled,
      description: h.description ?? '',
    }))

    // Query params
    const urlQueryParams = (typeof request.url === 'object' && request.url !== null)
      ? ((request.url as { query?: Array<{ key: string; value: string; disabled?: boolean; description?: string }> }).query ?? [])
      : []
    const params = urlQueryParams.map(q => ({
      key: q.key,
      value: q.value ?? '',
      enabled: !q.disabled,
      description: q.description ?? '',
    }))

    // Body
    let bodyOut: RequestBody = { type: 'none', content: '' }
    const rawBody = request.body as {
      mode?: string; raw?: string;
      options?: { raw?: { language?: string } };
      urlencoded?: Array<{ key: string; value: string; disabled?: boolean; description?: string }>;
      formdata?: Array<{ key: string; value: string; disabled?: boolean; description?: string }>;
    } | undefined
    if (rawBody?.mode === 'raw' && rawBody.raw) {
      const lang = rawBody.options?.raw?.language ?? 'text'
      bodyOut = { type: 'raw', content: rawBody.raw, rawType: lang as RequestBody['rawType'] }
    } else if (rawBody?.mode === 'urlencoded') {
      const kvPairs = (rawBody.urlencoded ?? []).map(kv => ({
        key: kv.key, value: kv.value, enabled: !kv.disabled, description: kv.description ?? '',
      }))
      bodyOut = { type: 'x-www-form-urlencoded', content: '', formData: kvPairs }
    } else if (rawBody?.mode === 'formdata') {
      const kvPairs = (rawBody.formdata ?? []).map(kv => ({
        key: kv.key, value: kv.value ?? '', enabled: !kv.disabled, description: kv.description ?? '',
      }))
      bodyOut = { type: 'form-data', content: '', formData: kvPairs }
    }

    // Auth
    let authOut: RequestAuth = { type: 'none' }
    const rawAuth = request.auth as { type?: string; bearer?: Array<{ key: string; value: string }>; basic?: Array<{ key: string; value: string }> } | undefined
    if (rawAuth?.type === 'bearer') {
      const tokenEntry = rawAuth.bearer?.find(b => b.key === 'token')
      authOut = { type: 'bearer', token: tokenEntry?.value ?? '' }
    } else if (rawAuth?.type === 'basic') {
      const usr = rawAuth.basic?.find(b => b.key === 'username')
      const pwd = rawAuth.basic?.find(b => b.key === 'password')
      authOut = { type: 'basic', username: usr?.value ?? '', password: pwd?.value ?? '' }
    }

    await reqRepo.create({
      collectionId: collection.id,
      folderId,
      name,
      method: method as HttpMethod,
      url,
      headers,
      params,
      body: bodyOut,
      auth: authOut,
      createdBy: userId,
    })
    imported++
  }

  return NextResponse.json({
    collection,
    importedRequests: imported,
  }, { status: 201 })
}
