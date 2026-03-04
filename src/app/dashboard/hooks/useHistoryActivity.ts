'use client'

import { useState, useEffect, useCallback } from 'react'
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

  /* Auto-load when sidebar tab switches */
  useEffect(() => {
    if (sidebarSection === 'history') loadHistory()
  }, [sidebarSection, loadHistory])

  useEffect(() => {
    if (sidebarSection === 'activity') loadActivity()
  }, [sidebarSection, loadActivity])

  /* Reset activity logs when workspace changes */
  useEffect(() => {
    if (sidebarSection === 'activity') setActivityLogs([])
  }, [currentWs, sidebarSection])

  /** Load more history entries (pagination) */
  const loadMoreHistory = useCallback(async () => {
    if (!currentWs) return
    try {
      const { history: more } = await apiFetch<{ history: HistoryEntry[] }>(`/api/history?workspaceId=${currentWs.id}&limit=50&skip=${history.length}`)
      if (more.length > 0) setHistory(prev => [...prev, ...more])
    } catch { /* ignore */ }
  }, [currentWs, history.length])

  /** Load more activity entries (pagination) */
  const loadMoreActivity = useCallback(async () => {
    if (!currentWs) return
    try {
      const { logs: more } = await apiFetch<{ logs: ActivityLogEntry[] }>(`/api/workspaces/${currentWs.id}/activity?limit=50&skip=${activityLogs.length}`)
      if (more.length > 0) setActivityLogs(prev => [...prev, ...more])
    } catch { /* ignore */ }
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
