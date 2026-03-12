'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RunResult } from '@/app/test-builder/types'
import { timeAgo } from './utils'

export interface SavedTestRun {
  id: string
  name: string
  code: string
  result: RunResult
  savedAt: string
}

const STORAGE_KEY = 'kayscope_e2e_runs'
const MAX_SAVED = 20

export function loadSavedRuns(): SavedTestRun[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SavedTestRun[]
  } catch {
    return []
  }
}

export function saveTestRun(run: SavedTestRun): void {
  if (typeof window === 'undefined') return
  const existing = loadSavedRuns()
  const next = [run, ...existing.filter((r) => r.id !== run.id)].slice(0, MAX_SAVED)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  // Notify other components via storage event (cross-tab)
  window.dispatchEvent(new Event('kayscope_runs_updated'))
}

export function TestsSidebarPanel() {
  const [runs, setRuns] = useState<SavedTestRun[]>([])
  const [running, setRunning] = useState<string | null>(null)  // id of the run in progress

  const refresh = useCallback(() => setRuns(loadSavedRuns()), [])

  useEffect(() => {
    refresh()
    window.addEventListener('kayscope_runs_updated', refresh)
    return () => window.removeEventListener('kayscope_runs_updated', refresh)
  }, [refresh])

  const handleRerun = async (run: SavedTestRun) => {
    setRunning(run.id)
    try {
      const res = await fetch('/api/playwright/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: run.code }),
      })
      const data = (await res.json()) as RunResult
      const updated: SavedTestRun = { ...run, result: data, savedAt: new Date().toISOString() }
      saveTestRun(updated)
    } catch {
      // silent — just update the UI
    } finally {
      setRunning(null)
    }
  }

  const handleDelete = (id: string) => {
    const next = loadSavedRuns().filter((r) => r.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('kayscope_runs_updated'))
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">E2E Tests</span>
      </div>

      {/* ── Hint row ── */}
      <div className="px-3 pb-2 shrink-0">
        <p className="text-[11px] text-gray-600 px-1">
          Build a test in the editor on the right, then click ▶ Run to save results here.
        </p>
      </div>

      {/* ── Runs list ── */}
      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-600">No tests saved yet.</p>
            <p className="text-[11px] text-gray-700 mt-1">
              Build a test in the editor to the right, then click ▶ Run Test.
            </p>
          </div>
        ) : (
          runs.map((run) => {
            const { result } = run
            const isPassing = result.success
            const isRunning = running === run.id
            return (
              <div
                key={run.id}
                className="group px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-800/30 transition"
              >
                {/* Name + timestamp */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs text-gray-200 font-medium leading-snug break-all">{run.name}</span>
                  <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(run.savedAt)}</span>
                </div>

                {/* Status summary */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isPassing
                        ? 'bg-green-900/50 text-green-400 border border-green-800/50'
                        : 'bg-red-900/50 text-red-400 border border-red-800/50'
                    }`}
                  >
                    {isPassing ? '✓' : '✗'} {isPassing ? 'passed' : 'failed'}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {result.summary.passed}/{result.summary.total} tests
                    {' · '}
                    {(result.summary.duration / 1000).toFixed(1)}s
                  </span>
                </div>

                {/* Failed test names */}
                {!isPassing && result.tests.filter((t) => t.status !== 'passed').length > 0 && (
                  <div className="mb-2 rounded bg-red-950/40 border border-red-900/30 px-2 py-1.5">
                    {result.tests
                      .filter((t) => t.status !== 'passed')
                      .map((t, i) => (
                        <p key={i} className="text-[10px] text-red-400 leading-snug truncate">
                          ✗ {t.testName}
                        </p>
                      ))}
                  </div>
                )}

                {/* Actions row */}
                <div className="flex items-center gap-1.5">
                  {/* Re-run */}
                  <button
                    onClick={() => handleRerun(run)}
                    disabled={!!running}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] bg-gray-800
                      text-gray-400 hover:bg-green-900/40 hover:text-green-300 disabled:opacity-40 transition"
                  >
                    {isRunning ? (
                      <>
                        <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                        running…
                      </>
                    ) : (
                      <>▶ Re-run</>
                    )}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(run.id)}
                    className="ml-auto rounded p-0.5 text-gray-700 hover:text-red-400 opacity-0
                      group-hover:opacity-100 transition"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
