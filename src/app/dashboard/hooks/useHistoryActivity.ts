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
  const loadingMoreHistRef = useRef(false)
  const loadingMoreActRef = useRef(false)

  const loadHistory = useCallback(async () => {
    if (!currentWs) return
    setLoadingHistory(true)
    try {
      const { history: h } = await apiFetch<{ history: HistoryEntry[] }>(`/api/history?workspaceId=${currentWs.id}&limit=50`)
      setHistory(h)
    } catch { /* ignore */ }
    finally { setLoadingHistory(false) }
  }, [currentWs])

  const loadActivity = useCallback(async () => {
    if (!currentWs) return
    setLoadingActivity(true)
    try {
      const { logs } = await apiFetch<{ logs: ActivityLogEntry[] }>(`/api/workspaces/${currentWs.id}/activity?limit=50`)
      setActivityLogs(logs)
    } catch { /* ignore */ }
    finally { setLoadingActivity(false) }
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
        if (!stale) setActivityLogs(logs)
      } catch { /* ignore */ }
      finally { if (!stale) setLoadingActivity(false) }
    })()
    return () => { stale = true }
  }, [sidebarSection, currentWs])

  /* Reset activity logs when workspace changes */
  useEffect(() => {
    if (sidebarSection === 'activity') setActivityLogs([])
  }, [currentWs, sidebarSection])

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

  /** Load more activity entries (pagination, guarded against double-click) */
  const loadMoreActivity = useCallback(async () => {
    if (!currentWs || loadingMoreActRef.current) return
    loadingMoreActRef.current = true
    try {
      const { logs: more } = await apiFetch<{ logs: ActivityLogEntry[] }>(`/api/workspaces/${currentWs.id}/activity?limit=50&skip=${activityLogs.length}`)
      if (more.length > 0) setActivityLogs(prev => [...prev, ...more])
    } catch { /* ignore */ }
    finally { loadingMoreActRef.current = false }
  }, [currentWs, activityLogs.length])

  return {
    history, setHistory,
    loadingHistory,
    activityLogs, setActivityLogs,
    loadingActivity,
    loadHistory, loadActivity,
    loadMoreHistory, loadMoreActivity,
  }
}
