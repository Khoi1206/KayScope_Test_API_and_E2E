'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { runScript } from '@/lib/scripting/script-runner'
import { useDebounce } from './useDebounce'

import type {
  SavedRequest, Environment, EnvVar, Workspace,
  ExecResponse, HistoryEntry, HttpMethod, KV, ReqBody, ReqAuth,
  ScriptResult, TabSnapshot, RequestTabMeta,
} from '../components/types'
import {
  DEFAULT_HEADERS, EMPTY_BODY, EMPTY_AUTH, mkBlankSnapshot, TabFactory,
} from '../components/constants'
import { apiFetch } from '../components/utils'

/* ═══════════════════════════════════════════════════════════════
   Dependencies injected from AppShell
   ═══════════════════════════════════════════════════════════════ */

export interface UseRequestEditorDeps {
  currentWs: Workspace | null
  environments: Environment[]
  currentEnvId: string
  setEnvironments: Dispatch<SetStateAction<Environment[]>>
  setRequestsByCol: Dispatch<SetStateAction<Record<string, SavedRequest[]>>>
  sidebarSection: string | null
  loadHistory: () => void
}

/* ═══════════════════════════════════════════════════════════════
   Hook
   ═══════════════════════════════════════════════════════════════ */

export function useRequestEditor(deps: UseRequestEditorDeps) {
  const {
    currentWs, environments, currentEnvId,
    setEnvironments, setRequestsByCol,
    sidebarSection, loadHistory,
  } = deps

  /* ── Request editor state ── */
  const [activeReq, setActiveReq] = useState<SavedRequest | null>(null)
  const [isDraft, setIsDraft] = useState(false)
  const [draftColId, setDraftColId] = useState<string | null>(null)
  const [draftFolderId, setDraftFolderId] = useState<string | null>(null)
  const [reqName, setReqName] = useState('New Request')
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [params, setParams] = useState<KV[]>([])
  const [headers, setHeaders] = useState<KV[]>(DEFAULT_HEADERS)
  const [body, setBody] = useState<ReqBody>(EMPTY_BODY)
  const [auth, setAuth] = useState<ReqAuth>(EMPTY_AUTH)
  const [activeTab, setActiveTab] = useState<'Params' | 'Headers' | 'Body' | 'Authorization' | 'Pre-request' | 'Post-request'>('Params')

  /* ── Script state ── */
  const [preRequestScript, setPreRequestScript] = useState('')
  const [postRequestScript, setPostRequestScript] = useState('')
  const [tempVars, setTempVars] = useState<Record<string, string>>({})
  const [preScriptResult, setPreScriptResult] = useState<ScriptResult | null>(null)
  const [postScriptResult, setPostScriptResult] = useState<ScriptResult | null>(null)

  /* ── Request tabs ── */
  const [tabs, setTabs] = useState<RequestTabMeta[]>([])
  const [activeTabId, setActiveTabId] = useState('')

  /* ── Response state ── */
  const [response, setResponse] = useState<ExecResponse | null>(null)
  const [responseTab, setResponseTab] = useState<'Pretty' | 'Headers' | 'Cookies' | 'Timing' | 'Raw'>('Pretty')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [requestTiming, setRequestTiming] = useState<{
    dns: number; connect: number; tls: number; firstByte: number; download: number; total: number
  } | null>(null)

  /* ── Variable overrides (user-typed inline overrides from URL-bar tooltip) ── */
  const [varOverrides, setVarOverrides] = useState<Record<string, string>>({})

  /** Set or clear a single variable override. Passing '' removes it. */
  const setVarOverride = useCallback((name: string, value: string) => {
    setVarOverrides(prev =>
      value === ''
        ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== name))
        : { ...prev, [name]: value }
    )
  }, [])

  /* ── Save state ── */
  const [isSaving, setIsSaving] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveToColModal, setSaveToColModal] = useState(false)

  /* ── Refs ── */
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId
  const abortRef = useRef<AbortController | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const saveFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /* skipDirtyRef — set true in restoreSnapshot so the dirty effect skips that restore cycle */
  const skipDirtyRef = useRef(false)

  /* Cleanup saveFlash timer on unmount */
  useEffect(() => {
    return () => { if (saveFlashTimerRef.current) clearTimeout(saveFlashTimerRef.current) }
  }, [])

  /* ── Debounced URL → query param sync ──
     Parses query string from URL after 300ms of inactivity and
     syncs it into the params KV editor (Postman-like behavior). */
  const debouncedUrl = useDebounce(url, 300)
  const skipParamSyncRef = useRef(false)

  useEffect(() => {
    if (skipParamSyncRef.current) { skipParamSyncRef.current = false; return }
    try {
      const qIdx = debouncedUrl.indexOf('?')
      if (qIdx === -1) return
      const search = new URLSearchParams(debouncedUrl.slice(qIdx + 1))
      const parsed: KV[] = []
      search.forEach((value, key) => {
        parsed.push({ key, value, enabled: true, description: '' })
      })
      if (parsed.length > 0) setParams(parsed)
    } catch { /* invalid URL — ignore */ }
  }, [debouncedUrl])

  /* ══════════════════════════════════════════════════════════════
     SNAPSHOT / TAB MANAGEMENT
     ══════════════════════════════════════════════════════════════ */

  const captureSnapshot = (): TabSnapshot => ({
    activeReq, isDraft, draftColId, draftFolderId,
    reqName, method, url, params, headers, body, auth, activeTab,
    preRequestScript, postRequestScript, tempVars,
    preScriptResult, postScriptResult,
    response, responseTab, requestTiming, sendError, isSending,
    varOverrides,
  })

  const restoreSnapshot = (s: TabSnapshot) => {
    skipDirtyRef.current = true  // suppress dirty marking during restore
    setActiveReq(s.activeReq); setIsDraft(s.isDraft)
    setDraftColId(s.draftColId); setDraftFolderId(s.draftFolderId)
    setReqName(s.reqName); setMethod(s.method); setUrl(s.url)
    skipParamSyncRef.current = true  // skip param sync during snapshot restore
    setParams(s.params); setHeaders(s.headers); setBody(s.body); setAuth(s.auth)
    setActiveTab(s.activeTab)
    setPreRequestScript(s.preRequestScript); setPostRequestScript(s.postRequestScript)
    setTempVars(s.tempVars)
    setPreScriptResult(s.preScriptResult); setPostScriptResult(s.postScriptResult)
    setResponse(s.response); setResponseTab(s.responseTab)
    setRequestTiming(s.requestTiming); setSendError(s.sendError)
    setIsSending(s.isSending)
    setVarOverrides(s.varOverrides ?? {})
    setSaveError('')
  }

  /* ── Mark active tab dirty whenever user edits content fields ──
     skipDirtyRef is set during restoreSnapshot so tab switches / opens
     don't incorrectly mark a freshly-loaded tab as dirty. */
  useEffect(() => {
    if (skipDirtyRef.current) { skipDirtyRef.current = false; return }
    if (!activeTabId) return
    setTabs(prev => prev.map(t => t.id === activeTabId && !t.dirty ? { ...t, dirty: true } : t))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqName, method, url, params, headers, body, auth, preRequestScript, postRequestScript])

  const switchToTab = (id: string) => {
    if (id === activeTabId) return
    const target = tabs.find(t => t.id === id)
    if (!target) return
    const snapshot = captureSnapshot()
    setTabs(prev => prev.map(t => t.id === activeTabId
      ? { ...t, label: reqName, method, savedReqId: activeReq?.id ?? null, snapshot }
      : t
    ))
    restoreSnapshot(target.snapshot ?? mkBlankSnapshot())
    setActiveTabId(id)
  }

  const closeTab = (id: string) => {
    const filtered = tabs.filter(t => t.id !== id)
    if (filtered.length === 0) {
      setTabs([])
      setActiveTabId('')
      setActiveReq(null); setIsDraft(false); setDraftColId(null); setDraftFolderId(null)
      setReqName('New Request'); setMethod('GET'); setUrl('')
      setParams([]); setHeaders([...DEFAULT_HEADERS]); setBody({ ...EMPTY_BODY, formData: [] }); setAuth({ ...EMPTY_AUTH })
      setPreRequestScript(''); setPostRequestScript(''); setTempVars({})
      setVarOverrides({})
      setResponse(null); setSendError(null); setRequestTiming(null)
      setPreScriptResult(null); setPostScriptResult(null); setIsSending(false)
      return
    }
    if (id === activeTabId) {
      const oldIdx = tabs.findIndex(t => t.id === id)
      const newActive = filtered[Math.min(oldIdx, filtered.length - 1)]
      setActiveTabId(newActive.id)
      restoreSnapshot(newActive.snapshot ?? mkBlankSnapshot())
    }
    setTabs(filtered)
  }

  /* ── Shared helper: save current tab snapshot + append new tab ── */
  const addTabAndActivate = (meta: RequestTabMeta, snapshot: TabSnapshot) => {
    const currentSnapshot = captureSnapshot()
    setTabs(prev => [
      ...prev.map(t => t.id === activeTabId
        ? { ...t, label: reqName, method, savedReqId: activeReq?.id ?? null, snapshot: currentSnapshot }
        : t
      ),
      meta,
    ])
    setActiveTabId(meta.id)
    restoreSnapshot(snapshot)
  }

  /* ── Factory: blank tab ── */
  const newTab = () => {
    const { meta, snapshot } = TabFactory.blank()
    addTabAndActivate(meta, snapshot)
  }

  /* ── Factory: open saved request in a tab ── */
  const openInTab = (req: SavedRequest) => {
    const existing = tabs.find(t => t.savedReqId === req.id)
    if (existing) { switchToTab(existing.id); return }
    const { meta, snapshot } = TabFactory.fromRequest(req)
    addTabAndActivate(meta, snapshot)
  }

  /* ── Factory: open history entry in a draft tab ── */
  const openHistoryInTab = (h: HistoryEntry) => {
    const { meta, snapshot } = TabFactory.fromHistory(h)
    addTabAndActivate(meta, snapshot)
  }

  /* ── Handle requests removed (from collection/folder/request delete) ── */
  const handleRequestsRemoved = (shouldDemote: (req: SavedRequest) => boolean) => {
    if (activeReq && shouldDemote(activeReq)) {
      setActiveReq(null); setIsDraft(true); setDraftColId(null); setDraftFolderId(null)
    }
    setTabs(prev => prev.map(t => {
      let updated = t
      if (updated.id === activeTabId && activeReq && shouldDemote(activeReq)) {
        updated = { ...updated, savedReqId: null }
      }
      if (updated.snapshot?.activeReq && shouldDemote(updated.snapshot.activeReq)) {
        updated = { ...updated, savedReqId: null, snapshot: { ...updated.snapshot, activeReq: null, isDraft: true, draftColId: null, draftFolderId: null } }
      }
      return updated
    }))
  }

  /* ══════════════════════════════════════════════════════════════
     SAVE
     ══════════════════════════════════════════════════════════════ */

  const saveRequest = async (overrideColId?: string, overrideFolderId?: string | null) => {
    const resolvedColId = overrideColId ?? draftColId
    const resolvedFolderId = overrideFolderId !== undefined ? overrideFolderId : draftFolderId
    if (isDraft && !activeReq && !resolvedColId) {
      setSaveToColModal(true)
      return
    }
    setIsSaving(true); setSaveError('')
    const payload = { name: reqName, method, url, params, headers, body, auth, preRequestScript, postRequestScript }
    try {
      if (isDraft && resolvedColId) {
        const { request } = await apiFetch<{ request: SavedRequest }>('/api/requests', { method: 'POST', body: JSON.stringify({ ...payload, collectionId: resolvedColId, folderId: resolvedFolderId ?? undefined }) })
        setRequestsByCol(prev => ({ ...prev, [resolvedColId]: [...(prev[resolvedColId] ?? []), request] }))
        setActiveReq(request); setIsDraft(false); setDraftColId(null); setDraftFolderId(null)
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, savedReqId: request.id, label: request.name, method: request.method } : t))
      } else if (activeReq) {
        const { request } = await apiFetch<{ request: SavedRequest }>(`/api/requests/${activeReq.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setRequestsByCol(prev => ({ ...prev, [request.collectionId]: (prev[request.collectionId] ?? []).map(r => r.id === request.id ? request : r) }))
        setActiveReq(request)
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, label: request.name, method: request.method } : t))
      }
      setSaveFlash(true)
      if (saveFlashTimerRef.current) clearTimeout(saveFlashTimerRef.current)
      saveFlashTimerRef.current = setTimeout(() => { setSaveFlash(false); saveFlashTimerRef.current = null }, 1500)
      setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, dirty: false } : t))
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Failed to save request') }
    finally { setIsSaving(false) }
  }

  /* ══════════════════════════════════════════════════════════════
     SEND
     ══════════════════════════════════════════════════════════════ */

  const sendRequest = async () => {
    if (!url.trim()) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const sendTabId = activeTabId
    setSendError(null); setIsSending(true); setResponse(null); setRequestTiming(null)
    setPreScriptResult(null); setPostScriptResult(null)
    const currentEnvObj = environments.find(e => e.id === currentEnvId)
    let envVars: Record<string, string> = {}
    currentEnvObj?.variables.filter(v => v.enabled && v.key).forEach(v => { envVars[v.key] = v.value })
    let sessionTempVars = tempVars

    const applyEnvUpdate = (updated: Record<string, string>) => {
      if (!currentEnvObj) return
      setEnvironments(prev => prev.map(e => {
        if (e.id !== currentEnvObj.id) return e
        const disabledVars = e.variables.filter(v => !v.enabled && !(v.key in updated))
        const updatedVars: EnvVar[] = Object.entries(updated).map(([key, value]) => {
          const existing = e.variables.find(v => v.key === key)
          return { key, value, enabled: true, secret: existing?.secret ?? false }
        })
        return { ...e, variables: [...disabledVars, ...updatedVars] }
      }))
    }

    try {
      // 1. Pre-request script
      if (preRequestScript.trim()) {
        const result = await runScript(preRequestScript, {
          envVars,
          tempVars: sessionTempVars,
          request: {
            url,
            method,
            headers: Object.fromEntries(headers.filter(h => h.enabled && h.key).map(h => [h.key, h.value])),
          },
        })
        setPreScriptResult(result)
        envVars = result.envVars
        sessionTempVars = result.tempVars
        setTempVars(result.tempVars)
        applyEnvUpdate(result.envVars)
      }

      // 2. Execute HTTP request
      const raw = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method, url, params, headers, body, auth,
          environmentVariables: { ...envVars, ...sessionTempVars, ...varOverrides },
          requestId: activeReq?.id,
          workspaceId: currentWs?.id,
        }),
        signal: controller.signal,
      })
      const data = await raw.json()

      if (!raw.ok) {
        const errMsg = data?.error ?? raw.statusText
        const errResponse = {
          status: raw.status, statusText: raw.statusText, headers: {},
          body: JSON.stringify({ error: errMsg }, null, 2), durationMs: 0, size: 0,
        }
        if (activeTabIdRef.current !== sendTabId) {
          setTabs(prev => prev.map(t => {
            if (t.id !== sendTabId) return t
            const base = t.snapshot ?? mkBlankSnapshot()
            return { ...t, snapshot: { ...base, response: errResponse, responseTab: 'Pretty' as const, isSending: false, sendError: null } }
          }))
          return
        }
        setResponse(errResponse)
        setResponseTab('Pretty')
        return
      }

      const res = data as ExecResponse
      const timing = {
        dns: Math.round(res.durationMs * 0.05),
        connect: Math.round(res.durationMs * 0.1),
        tls: Math.round(res.durationMs * 0.1),
        firstByte: Math.round(res.durationMs * 0.55),
        download: Math.round(res.durationMs * 0.2),
        total: res.durationMs,
      }
      // Route response to correct destination (active state or tab snapshot)
      if (activeTabIdRef.current !== sendTabId) {
        setTabs(prev => prev.map(t => {
          if (t.id !== sendTabId) return t
          const base = t.snapshot ?? mkBlankSnapshot()
          return { ...t, snapshot: { ...base, response: res, responseTab: 'Pretty' as const, requestTiming: timing, isSending: false, sendError: null } }
        }))
      } else {
        setResponse(res); setResponseTab('Pretty')
        setRequestTiming(timing)
      }

      // 3. Post-request script (always runs — env updates must not be lost)
      if (postRequestScript.trim()) {
        const result = await runScript(postRequestScript, {
          envVars,
          tempVars: sessionTempVars,
          response: {
            status: res.status, statusText: res.statusText,
            headers: res.headers, body: res.body,
          },
        })
        sessionTempVars = result.tempVars
        applyEnvUpdate(result.envVars)
        if (activeTabIdRef.current === sendTabId) {
          setPostScriptResult(result)
          setTempVars(result.tempVars)
        } else {
          setTabs(prev => prev.map(t => {
            if (t.id !== sendTabId) return t
            const base = t.snapshot ?? mkBlankSnapshot()
            return { ...t, snapshot: { ...base, postScriptResult: result, tempVars: result.tempVars } }
          }))
        }
      }

      if (sidebarSection === 'history') loadHistory()
    } catch (e) {
      // Silently ignore aborted requests (superseded by a newer send)
      if (controller.signal.aborted) return
      const errMsg = e instanceof Error ? e.message : 'Request failed'
      if (activeTabIdRef.current !== sendTabId) {
        setTabs(prev => prev.map(t => {
          if (t.id !== sendTabId) return t
          const base = t.snapshot ?? mkBlankSnapshot()
          return { ...t, snapshot: { ...base, isSending: false, sendError: errMsg } }
        }))
      } else {
        setSendError(errMsg)
      }
    }
    finally { if (!controller.signal.aborted && activeTabIdRef.current === sendTabId) setIsSending(false) }
  }

  return {
    /* editor state */
    activeReq, setActiveReq,
    isDraft, setIsDraft,
    draftColId, setDraftColId,
    draftFolderId, setDraftFolderId,
    reqName, setReqName,
    method, setMethod,
    url, setUrl,
    params, setParams,
    headers, setHeaders,
    body, setBody,
    auth, setAuth,
    activeTab, setActiveTab,
    /* scripts */
    preRequestScript, setPreRequestScript,
    postRequestScript, setPostRequestScript,
    tempVars, setTempVars,
    varOverrides, setVarOverride,
    preScriptResult, postScriptResult,
    /* tabs */
    tabs, setTabs,
    activeTabId, setActiveTabId,
    tabBarRef,
    /* response */
    response, responseTab, setResponseTab,
    isSending, sendError, requestTiming,
    /* save */
    isSaving, saveFlash, saveError, setSaveError,
    saveToColModal, setSaveToColModal,
    /* actions */
    switchToTab, closeTab, newTab,
    openInTab, openHistoryInTab,
    handleRequestsRemoved,
    saveRequest, sendRequest,
  }
}
