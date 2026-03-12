'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Workspace, HistoryEntry, ActivityLogEntry } from '../components/types'
import { apiFetch } from '../components/utils'

export function useHistoryActivity(
  currentWs: Workspace | null,
  sidebarSection: string | null,
) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  // Tracks only the count of items fetched from the server (not SSE-pushed items)
  // so that loadMoreActivity uses the correct skip value and the "Load more" button
  // is only shown when the last DB page was full (i.e. exactly 50 items).
  const [dbActivityCount, setDbActivityCount] = useState(0)
  const loadingMoreHistRef = useRef(false)
  const loadingMoreActRef = useRef(false)
  // Stable ref for dbActivityCount so loadMoreActivity doesn't recreate on each page load
  const dbActivityCountRef = useRef(0)
  // Keep ref in sync for use in loadMoreActivity
  useEffect(() => { dbActivityCountRef.current = dbActivityCount }, [dbActivityCount])
  // Ref to the current workspace ID — used as a stale guard in the standalone loadHistory
  // callback (which can be called after sendRequest and is not protected by a cleanup fn).
  const currentWsIdRef = useRef<string | null>(currentWs?.id ?? null)
  useEffect(() => { currentWsIdRef.current = currentWs?.id ?? null }, [currentWs])

  const loadHistory = useCallback(async () => {
    if (!currentWs) return
    const wsId = currentWs.id
    setLoadingHistory(true)
    try {
      const { history: h } = await apiFetch<{ history: HistoryEntry[] }>(`/api/history?workspaceId=${wsId}&limit=50`)
      // Guard: discard if workspace switched while the request was in-flight
      if (currentWsIdRef.current === wsId) setHistory(h)
    } catch { /* ignore */ }
    finally { if (currentWsIdRef.current === wsId) setLoadingHistory(false) }
  }, [currentWs])

  const loadActivity = useCallback(async () => {
    if (!currentWs) return
    const wsId = currentWs.id
    setLoadingActivity(true)
    try {
      const { logs } = await apiFetch<{ logs: ActivityLogEntry[] }>(`/api/workspaces/${wsId}/activity?limit=50`)
      if (currentWsIdRef.current === wsId) {
        setActivityLogs(logs)
        setDbActivityCount(logs.length)
      }
    } catch { /* ignore */ }
    finally { if (currentWsIdRef.current === wsId) setLoadingActivity(false) }
  }, [currentWs])

  /* Auto-load when sidebar tab switches (stale guard prevents race on rapid ws switch) */
  useEffect(() => {
    if (sidebarSection !== 'history') return
    let stale = false
    ;(async () => {
      if (!currentWs) return
      setLoadingHistory(true)
      try {
        const { history: h } = await apiFetch<{ history: HistoryEntry[] }>(`/api/history?workspaceId=${currentWs.id}&limit=50`)
        if (!stale) setHistory(h)
      } catch { /* ignore */ }
      finally { if (!stale) setLoadingHistory(false) }
    })()
    return () => { stale = true }
  }, [sidebarSection, currentWs])

  useEffect(() => {
    if (sidebarSection !== 'activity') return
    let stale = false
    ;(async () => {
      if (!currentWs) return
      setLoadingActivity(true)
      try {
        const { logs } = await apiFetch<{ logs: ActivityLogEntry[] }>(`/api/workspaces/${currentWs.id}/activity?limit=50`)
        if (!stale) { setActivityLogs(logs); setDbActivityCount(logs.length) }
      } catch { /* ignore */ }
      finally { if (!stale) setLoadingActivity(false) }
    })()
    return () => { stale = true }
  }, [sidebarSection, currentWs])

  /* Reset activity logs when workspace changes (regardless of which tab is active) */
  useEffect(() => {
    setActivityLogs([]); setDbActivityCount(0)
  }, [currentWs])

  /** Load more history entries (pagination, guarded against double-click) */
  const loadMoreHistory = useCallback(async () => {
    if (!currentWs || loadingMoreHistRef.current) return
    loadingMoreHistRef.current = true
    try {
      const { history: more } = await apiFetch<{ history: HistoryEntry[] }>(`/api/history?workspaceId=${currentWs.id}&limit=50&skip=${history.length}`)
      if (more.length > 0) setHistory(prev => [...prev, ...more])
    } catch { /* ignore */ }
    finally { loadingMoreHistRef.current = false }
  }, [currentWs, history.length])

  /** Load more activity entries (pagination, guarded against double-click).
   *  Uses dbActivityCountRef (not activityLogs.length) as skip so SSE-pushed items
   *  don't offset the pagination cursor. */
  const loadMoreActivity = useCallback(async () => {
    if (!currentWs || loadingMoreActRef.current) return
    loadingMoreActRef.current = true
    try {
      const { logs: more } = await apiFetch<{ logs: ActivityLogEntry[] }>(`/api/workspaces/${currentWs.id}/activity?limit=50&skip=${dbActivityCountRef.current}`)
      if (more.length > 0) {
        setActivityLogs(prev => [...prev, ...more])
        setDbActivityCount(c => c + more.length)
      }
    } catch { /* ignore */ }
    finally { loadingMoreActRef.current = false }
  }, [currentWs])

  return {
    history, setHistory,
    loadingHistory,
    activityLogs, setActivityLogs,
    loadingActivity,
    dbActivityCount,
    loadHistory, loadActivity,
    loadMoreHistory, loadMoreActivity,
  }
}
