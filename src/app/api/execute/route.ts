import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { withApiHandler } from '@/lib/api/api-handler'
import { ValidationError } from '@/lib/errors/ValidationError'
import type { ExecuteRequestDTO, ExecuteResponse, KeyValuePair } from '@/modules/request/domain/entities/request.entity'
import { MongoDBHistoryRepository } from '@/modules/history/infrastructure/repositories/mongodb-history.repository'
import { resolveAuthHeaders } from '@/lib/auth/auth-strategy'
import { Agent, fetch as undiciFetch, FormData as UndiciFormData } from 'undici'

// Reusable agent that skips TLS certificate verification
// (same behaviour as Postman / browser dev-tools)
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } })

/** Interpolate {{variable}} placeholders from environment variables map. */
function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/** Build the final URL with query params merged in.
 *  The inline query string is stripped from rawUrl so the params table is
 *  the single source of truth — prevents duplicates when the URL bar still
 *  contains ?... that was previously synced into the params KV editor. */
function buildUrl(
  rawUrl: string,
  params: KeyValuePair[],
  vars: Record<string, string>
): URL {
  const resolved = interpolate(rawUrl.trim(), vars)
  const qIdx = resolved.indexOf('?')
  const baseResolved = qIdx === -1 ? resolved : resolved.slice(0, qIdx)
  const url = new URL(baseResolved.startsWith('http') ? baseResolved : `https://${baseResolved}`)
  for (const p of params) {
    if (p.enabled && p.key) {
      url.searchParams.append(interpolate(p.key, vars), interpolate(p.value, vars))
    }
  }
  return url
}

/** Convert enabled KeyValuePairs into a Headers object. */
function buildHeaders(
  rawHeaders: KeyValuePair[],
  vars: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of rawHeaders) {
    if (h.enabled && h.key) {
      out[interpolate(h.key, vars)] = interpolate(h.value, vars)
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const session = await requireSession()

    const dto: ExecuteRequestDTO & { requestId?: string; workspaceId?: string } = await req.json()
    if (!dto.url) throw new ValidationError('URL is required')
    if (!dto.method) throw new ValidationError('Method is required')

    const envVars = dto.environmentVariables ?? {}
    const params = dto.params ?? []
    const headers = dto.headers ?? []

    // Build URL
    let targetUrl: URL
    try {
      targetUrl = buildUrl(dto.url, params, envVars)
    } catch {
      throw new ValidationError(`Invalid URL: ${dto.url}`)
    }

    // Build headers
    const headersObj = buildHeaders(headers, envVars)

    // Apply auth via strategy pattern
    const auth = dto.auth ?? { type: 'none' }
    const authHeaders = resolveAuthHeaders(auth, (s) => interpolate(s, envVars))
    Object.assign(headersObj, authHeaders)

    // Note: default headers (User-Agent, Accept, etc.) are now set in the UI headers tab.
    // They arrive here as regular user headers — no need to inject server-side defaults.

    // Content-Type map for raw sub-types
    const RAW_CONTENT_TYPE: Record<string, string> = {
      text: 'text/plain',
      json: 'application/json',
      javascript: 'application/javascript',
      html: 'text/html',
      xml: 'application/xml',
    }

    // Build body
    let fetchBody: BodyInit | undefined = undefined
    let formDataBody: UndiciFormData | undefined = undefined  // separate var for undici FormData
    const bodyConfig = dto.body ?? { type: 'none', content: '' }

    if (bodyConfig.type === 'form-data' && bodyConfig.formData?.length) {
      // Multipart form-data — let undici set the Content-Type with boundary
      const fd = new UndiciFormData()
      for (const kv of bodyConfig.formData) {
        if (kv.enabled && kv.key) {
          fd.append(interpolate(kv.key, envVars), interpolate(kv.value, envVars))
        }
      }
      // Remove Content-Type so undici auto-sets multipart boundary
      delete headersObj['Content-Type']
      delete headersObj['content-type']
      formDataBody = fd
    } else if (bodyConfig.type === 'x-www-form-urlencoded' && bodyConfig.formData?.length) {
      // URL-encoded form — build from key-value pairs
      const sp = new URLSearchParams()
      for (const kv of bodyConfig.formData) {
        if (kv.enabled && kv.key) {
          sp.append(interpolate(kv.key, envVars), interpolate(kv.value, envVars))
        }
      }
      headersObj['Content-Type'] = headersObj['Content-Type'] ?? 'application/x-www-form-urlencoded'
      fetchBody = sp.toString()
    } else if (bodyConfig.type === 'raw' && bodyConfig.content) {
      // Raw body with sub-type-based Content-Type
      const rawType = bodyConfig.rawType ?? 'json'
      headersObj['Content-Type'] = headersObj['Content-Type'] ?? (RAW_CONTENT_TYPE[rawType] || 'text/plain')
      fetchBody = interpolate(bodyConfig.content, envVars)
    } else if (bodyConfig.type === 'json' && bodyConfig.content) {
      // Legacy: saved requests that still have type='json'
      headersObj['Content-Type'] = headersObj['Content-Type'] ?? 'application/json'
      fetchBody = interpolate(bodyConfig.content, envVars)
    }

    // Execute using undici fetch with TLS-tolerant agent
    const startMs = Date.now()
    let responseStatus: number
    let responseStatusText: string
    let responseText: string
    const responseHeaders: Record<string, string> = {}

    try {
      const undiciResp = await undiciFetch(targetUrl.toString(), {
        method: dto.method,
        headers: headersObj,
        body: ['GET', 'HEAD'].includes(dto.method) ? undefined : (formDataBody ?? fetchBody),
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        dispatcher: insecureAgent,
      })

      responseStatus = undiciResp.status
      responseStatusText = undiciResp.statusText
      responseText = await undiciResp.text()

      // Collect response headers
      undiciResp.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

    } catch (fetchErr) {
      // Network / DNS / TLS / timeout errors
      const durationMs = Date.now() - startMs
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error('[execute] Fetch error:', errMsg)
      const result: ExecuteResponse = {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: JSON.stringify({ error: errMsg }, null, 2),
        durationMs,
        size: 0,
      }
      return NextResponse.json(result)
    }
    const durationMs = Date.now() - startMs

    const result: ExecuteResponse = {
      status: responseStatus,
      statusText: responseStatusText,
      headers: responseHeaders,
      body: responseText,
      durationMs,
      size: new TextEncoder().encode(responseText).length,
    }

    // Persist to history (fire and forget — don't block the response)
    if (dto.workspaceId) {
      const historyRepo = new MongoDBHistoryRepository()
      historyRepo.create({
        requestId: dto.requestId,
        workspaceId: dto.workspaceId,
        userId: session.user.id,
        method: dto.method,
        url: targetUrl.toString(),
        requestHeaders: headersObj,
        requestBody: typeof fetchBody === 'string' ? fetchBody : formDataBody ? '[form-data]' : undefined,
        status: result.status,
        statusText: result.statusText,
        responseHeaders,
        responseBody: responseText.slice(0, 50_000), // cap stored body at 50KB
        durationMs,
        size: result.size,
      }).catch(() => {}) // silent — history failure should never break execution
    }

    return NextResponse.json(result)
  })
}
