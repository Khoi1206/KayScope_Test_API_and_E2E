'use client'

import { memo, type Dispatch, type SetStateAction, type RefObject } from 'react'
import { signOut } from 'next-auth/react'

import type { Workspace, Environment } from './types'

/* ── Props ── */
export interface NavbarProps {
  /* Workspace */
  workspaces: Workspace[]
  currentWs: Workspace | null
  setCurrentWs: Dispatch<SetStateAction<Workspace | null>>
  loadingWs: boolean
  createWorkspace: () => void
  renameWorkspace: (ws: Workspace, name: string) => Promise<void>
  deleteWorkspace: (ws: Workspace) => Promise<void>
  showWsDropdown: boolean
  setShowWsDropdown: Dispatch<SetStateAction<boolean>>
  newWsName: string
  setNewWsName: Dispatch<SetStateAction<string>>
  showWsCreate: boolean
  setShowWsCreate: Dispatch<SetStateAction<boolean>>
  wsCreateError: string
  setWsCreateError: Dispatch<SetStateAction<string>>
  wsDropdownRef: RefObject<HTMLDivElement>

  /* Import */
  importFileRef: RefObject<HTMLInputElement>

  /* Live sync */
  liveConnected: boolean

  /* Environments */
  environments: Environment[]
  currentEnvId: string
  setCurrentEnvId: Dispatch<SetStateAction<string>>

  /* Modal openers */
  setMembersModalWs: Dispatch<SetStateAction<Workspace | null>>
  setRenameModal: Dispatch<SetStateAction<{ label: string; currentName: string; onSave: (name: string) => void; title?: string } | null>>
  setConfirmModal: Dispatch<SetStateAction<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>>

  /* User */
  userName: string
}

/* ══════════════════════════════════════════════════════════════
   Navbar — top navigation bar
   ══════════════════════════════════════════════════════════════ */
export const Navbar = memo(function Navbar({
  workspaces, currentWs, setCurrentWs, loadingWs,
  createWorkspace, renameWorkspace, deleteWorkspace,
  showWsDropdown, setShowWsDropdown,
  newWsName, setNewWsName,
  showWsCreate, setShowWsCreate,
  wsCreateError, setWsCreateError,
  wsDropdownRef,
  importFileRef,
  liveConnected,
  environments, currentEnvId, setCurrentEnvId,
  setMembersModalWs, setRenameModal, setConfirmModal,
  userName,
}: NavbarProps) {
  return (
    <nav className="flex items-center h-10 bg-[#1c1c1c] border-b border-gray-800/80 shrink-0 px-2 gap-0.5">
      {/* Logo */}
      <span className="font-bold text-orange-500 text-sm tracking-tight px-2 shrink-0">KayScope</span>
      <div className="w-px h-5 bg-gray-700 mx-1 shrink-0" />

      {/* Workspace dropdown */}
      <div className="relative" ref={wsDropdownRef}>
        <button onClick={() => setShowWsDropdown(v => !v)} className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700/60 px-2.5 py-1.5 rounded transition">
          <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className="max-w-[130px] truncate">{loadingWs ? 'Loading…' : (currentWs?.name ?? 'Workspaces')}</span>
          <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {showWsDropdown && (
          <div className="absolute top-9 left-0 z-50 w-72 bg-[#252525] border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700/50">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Workspaces</p>
            </div>
            <div className="py-1 max-h-48 overflow-y-auto">
              {workspaces.map(ws => (
                <div key={ws.id} className="group flex items-center hover:bg-gray-700/50 transition">
                  <button onClick={() => { setCurrentWs(ws); setShowWsDropdown(false) }} className={`flex items-center gap-2 flex-1 text-left px-3 py-2 text-xs ${ws.id === currentWs?.id ? 'text-orange-400 font-medium' : 'text-gray-300'}`}>
                    <svg className="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    {ws.name}
                  </button>
                  <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={(e) => { e.stopPropagation(); setShowWsDropdown(false); setMembersModalWs(ws) }}
                      className="p-1 text-gray-600 hover:text-purple-400 transition rounded" title="Members">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowWsDropdown(false); setRenameModal({ label: 'Workspace', currentName: ws.name, onSave: async (n) => { try { await renameWorkspace(ws, n); setRenameModal(null) } catch (er) { console.error(er) } } }) }}
                      className="p-1 text-gray-600 hover:text-blue-400 transition rounded" title="Rename">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowWsDropdown(false); setConfirmModal({ title: 'Delete Workspace', message: `Delete "${ws.name}" and all its collections, requests, and environments?`, onConfirm: async () => { try { await deleteWorkspace(ws); setConfirmModal(null) } catch (er) { console.error(er) } }, destructive: true }) }}
                      className="p-1 text-gray-600 hover:text-red-400 transition rounded" title="Delete">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-700 p-2">
              {showWsCreate ? (
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    <input autoFocus value={newWsName} onChange={e => { setNewWsName(e.target.value); setWsCreateError('') }} onKeyDown={e => e.key === 'Enter' && createWorkspace()} placeholder="Min. 2 characters"
                      className={`flex-1 bg-gray-800 text-gray-200 text-xs px-2 py-1.5 rounded border focus:outline-none ${wsCreateError ? 'border-red-500' : 'border-gray-600 focus:border-orange-500'}`} />
                    <button onClick={createWorkspace} className="px-2 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded transition">Add</button>
                    <button onClick={() => { setShowWsCreate(false); setWsCreateError('') }} className="px-2 py-1.5 text-gray-400 hover:text-gray-200 text-xs transition">{'\u2715'}</button>
                  </div>
                  {wsCreateError && <p className="text-[10px] text-red-400 px-1">{wsCreateError}</p>}
                </div>
              ) : (
                <button onClick={() => setShowWsCreate(true)} className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 px-2 py-1.5 rounded hover:bg-gray-700 transition">
                  <span className="text-orange-500 text-base leading-none">+</span> New Workspace
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Import button */}
      <button onClick={() => importFileRef.current?.click()} disabled={!currentWs} className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 transition" title="Import collection (Postman / KayScope JSON)">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
      </button>

      <div className="flex-1" />

      {/* Live indicator */}
      {currentWs && (
        liveConnected ? (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 px-1" title="Live sync active">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="hidden sm:inline">Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-yellow-500 px-1" title="Sync disconnected — reconnecting…">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )
      )}

      {/* Environment selector */}
      <select value={currentEnvId} onChange={e => setCurrentEnvId(e.target.value)} className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:border-orange-500">
        <option value="none">No Environment</option>
        {environments.map(env => (<option key={env.id} value={env.id}>{env.name}</option>))}
      </select>

      {/* User menu */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white">{userName?.[0]?.toUpperCase() ?? 'U'}</div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-xs text-gray-400 hover:text-gray-200 transition px-2 py-1 rounded hover:bg-gray-800">Sign out</button>
      </div>
    </nav>
  )
})
