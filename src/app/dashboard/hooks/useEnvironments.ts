'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Workspace, Environment, EnvVar } from '../components/types'
import { apiFetch } from '../components/utils'

export function useEnvironments(currentWs: Workspace | null) {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [currentEnvId, setCurrentEnvId] = useState<string>('none')
  const [envEditorTarget, setEnvEditorTarget] = useState<Environment | null | 'new'>(null)

  /* Load environments when workspace changes */
  useEffect(() => {
    if (!currentWs) { setEnvironments([]); setCurrentEnvId('none'); return }
    apiFetch<{ environments: Environment[] }>(`/api/environments?workspaceId=${currentWs.id}`)
      .then(({ environments: envs }) => { setEnvironments(envs); setCurrentEnvId('none') })
      .catch(console.error)
  }, [currentWs])

  const saveEnvironment = useCallback(async (name: string, vars: EnvVar[]) => {
    if (!currentWs) return
    try {
      if (envEditorTarget === 'new') {
        const { environment } = await apiFetch<{ environment: Environment }>('/api/environments', {
          method: 'POST', body: JSON.stringify({ workspaceId: currentWs.id, name, variables: vars })
        })
        setEnvironments(prev => [...prev, environment])
      } else if (envEditorTarget && typeof envEditorTarget === 'object') {
        const { environment } = await apiFetch<{ environment: Environment }>(`/api/environments/${envEditorTarget.id}`, {
          method: 'PUT', body: JSON.stringify({ name, variables: vars })
        })
        setEnvironments(prev => prev.map(e => e.id === environment.id ? environment : e))
      }
      setEnvEditorTarget(null)
    } catch (e) { console.error(e) }
  }, [currentWs, envEditorTarget])

  /** Throws on failure — caller handles modal dismiss */
  const deleteEnvironment = useCallback(async (env: Environment) => {
    await apiFetch(`/api/environments/${env.id}`, { method: 'DELETE' })
    setEnvironments(prev => prev.filter(e => e.id !== env.id))
    setCurrentEnvId(prev => prev === env.id ? 'none' : prev)
  }, [])

  /** Used by SSE to refresh environment list */
  const reloadEnvironments = useCallback(async () => {
    if (!currentWs) return
    try {
      const { environments: envs } = await apiFetch<{ environments: Environment[] }>(`/api/environments?workspaceId=${currentWs.id}`)
      setEnvironments(envs)
    } catch { /* ignore */ }
  }, [currentWs])

  return {
    environments, setEnvironments,
    currentEnvId, setCurrentEnvId,
    envEditorTarget, setEnvEditorTarget,
    saveEnvironment, deleteEnvironment, reloadEnvironments,
  }
}
