'use client'

import { memo, useState, useRef, useEffect, useCallback, type Dispatch, type SetStateAction, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type {
  Workspace, Collection, SavedRequest, FolderNode, FolderTreeResult,
  HttpMethod, Environment, HistoryEntry, ActivityLogEntry,
} from './types'
import { METHOD_COLOR } from './constants'
import { statusColor, statusBg, timeAgo } from './utils'
import { TestsSidebarPanel } from './TestsSidebarPanel'

/* ── Sidebar section type ── */
export type SidebarSection = 'collections' | 'environments' | 'history' | 'activity' | 'tests' | null

/* ── Props ── */
export interface SidebarPanelProps {
  sidebarSection: SidebarSection
  setSidebarSection: Dispatch<SetStateAction<SidebarSection>>
  currentWs: Workspace | null
  loadingWs: boolean
  setShowWsDropdown: Dispatch<SetStateAction<boolean>>

  /* Collections */
  collections: Collection[]
  loadingCols: boolean
  expandedCols: Set<string>
  expandedFolders: Set<string>
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>
  folderTrees: Record<string, FolderTreeResult>
  showColCreate: boolean
  setShowColCreate: Dispatch<SetStateAction<boolean>>
  newColName: string
  setNewColName: Dispatch<SetStateAction<string>>
  colCreateError: string
  setColCreateError: Dispatch<SetStateAction<string>>
  toggleCollection: (id: string) => void
  createCollection: () => void
  renameCollection: (col: Collection, name: string) => Promise<void>
  deleteCollection: (col: Collection) => Promise<void>
  createFolder: (colId: string, name: string) => void
  renameFolder: (colId: string, folderId: string, name: string) => Promise<void>
  deleteFolder: (colId: string, folderId: string) => void
  createRequestImmediately: (colId: string, folderId?: string) => void
  deleteRequest: (req: SavedRequest) => Promise<void>
  exportCollection: (col: Collection) => void
  importFileRef: RefObject<HTMLInputElement>

  /* Request opening / active highlight */
  openInTab: (req: SavedRequest) => void
  activeReq: SavedRequest | null
  isDraft: boolean

  /* Environments */
  environments: Environment[]
  currentEnvId: string
  setCurrentEnvId: Dispatch<SetStateAction<string>>
  setEnvEditorTarget: Dispatch<SetStateAction<Environment | 'new' | null>>
  deleteEnvironment: (env: Environment) => Promise<void>

  /* History */
  history: HistoryEntry[]
  loadingHistory: boolean
  openHistoryInTab: (h: HistoryEntry) => void
  loadMoreHistory: () => void

  /* Activity */
  activityLogs: ActivityLogEntry[]
  loadingActivity: boolean
  loadActivity: () => void
  loadMoreActivity: () => void
  /** Count of activity entries fetched from the server (excludes SSE-pushed items) */
  dbActivityCount: number

  /* Modal openers */
  setConfirmModal: Dispatch<SetStateAction<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>>
  setRenameModal: Dispatch<SetStateAction<{ label: string; currentName: string; onSave: (name: string) => void; title?: string } | null>>

  /* Status bar */
  currentEnvName: string | undefined
}

/* ── Activity action colour map (module-level — never recreated) ── */
const ACTION_COLORS: Record<string, string> = {
  created: 'text-green-400', updated: 'text-blue-400', deleted: 'text-red-400',
  invited: 'text-purple-400', removed: 'text-orange-400', executed: 'text-cyan-400',
  imported: 'text-yellow-400', exported: 'text-yellow-400',
}

/* ── Sidebar navigation items (static — no props/state dependency) ── */
const SIDEBAR_ITEMS = [
  { id: 'collections' as const, title: 'Collections', label: 'Collection', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
  { id: 'environments' as const, title: 'Environments', label: 'Environment', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { id: 'history' as const, title: 'History', label: 'History', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: 'activity' as const, title: 'Activity', label: 'Activity', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
  { id: 'tests' as const, title: 'E2E Tests', label: 'Tests', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg> },
] as const

/* ══════════════════════════════════════════════════════════════
   SidebarPanel — left icon strip + sidebar content panels
   ══════════════════════════════════════════════════════════════ */
export const SidebarPanel = memo(function SidebarPanel({
  sidebarSection, setSidebarSection,
  currentWs, loadingWs, setShowWsDropdown,
  collections, loadingCols, expandedCols, expandedFolders, setExpandedFolders,
  folderTrees, showColCreate, setShowColCreate,
  newColName, setNewColName, colCreateError, setColCreateError,
  toggleCollection, createCollection, renameCollection, deleteCollection,
  createFolder, renameFolder, deleteFolder,
  createRequestImmediately, deleteRequest, exportCollection, importFileRef,
  openInTab, activeReq, isDraft,
  environments, currentEnvId, setCurrentEnvId, setEnvEditorTarget, deleteEnvironment,
  history, loadingHistory, openHistoryInTab, loadMoreHistory,
  activityLogs, loadingActivity, loadActivity, loadMoreActivity, dbActivityCount,
  setConfirmModal, setRenameModal,
  currentEnvName,
}: SidebarPanelProps) {

  /* ── Context menu (owned here, not lifted to parent) ── */
  const [colCtxMenu, setColCtxMenu] = useState<{ colId: string; x: number; y: number } | null>(null)
  const colCtxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colCtxRef.current && !colCtxRef.current.contains(e.target as Node)) setColCtxMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── Tree helpers ── */
  const toggleFolder = useCallback((key: string) => setExpandedFolders(prev => {
    const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next
  }), [setExpandedFolders])

  const renderRequest = (req: SavedRequest) => (
    <div key={req.id} onClick={() => openInTab(req)}
      className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg mx-2 cursor-pointer hover:bg-gray-800/60 ${activeReq?.id === req.id && !isDraft ? 'bg-gray-800' : ''}`}>
      <span className={`text-[10px] font-bold w-11 shrink-0 ${METHOD_COLOR[req.method]}`}>{req.method}</span>
      <span className="text-xs text-gray-400 truncate flex-1">{req.name}</span>
      <button onClick={e => { e.stopPropagation(); setConfirmModal({ title: 'Delete Request', message: `Delete "${req.name}"?`, onConfirm: async () => { try { await deleteRequest(req) } catch (er) { console.error(er) } setConfirmModal(null) }, destructive: true }) }}
        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )

  const renderFolderNode = (colId: string, node: FolderNode, depth: number): JSX.Element => {
    const folderKey = `${colId}::${node.folder.id}`
    const isOpen = expandedFolders.has(folderKey)
    return (
      <div key={node.folder.id}>
        <div className="group flex items-center gap-1.5 px-3 py-2 hover:bg-gray-800/60 rounded-lg mx-2 cursor-pointer" onClick={() => toggleFolder(folderKey)}>
          <svg className={`w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <svg className="w-4 h-4 text-yellow-600/70 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
          <span className="text-xs text-gray-400 truncate flex-1">{node.folder.name}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
            <button onClick={e => { e.stopPropagation(); createRequestImmediately(colId, node.folder.id) }}
              className="text-gray-600 hover:text-orange-400 transition p-0.5 shrink-0" title="Add request">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); setRenameModal({ label: 'Folder', currentName: node.folder.name, onSave: async (n) => { try { await renameFolder(colId, node.folder.id, n); setRenameModal(null) } catch (er) { console.error(er) } } }) }}
              className="text-gray-600 hover:text-blue-400 transition p-0.5 shrink-0" title="Rename folder">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); setConfirmModal({ title: 'Delete Folder', message: `Delete "${node.folder.name}" and all its requests? This cannot be undone.`, onConfirm: () => { deleteFolder(colId, node.folder.id); setConfirmModal(null) }, destructive: true }) }}
              className="text-gray-600 hover:text-red-400 transition p-0.5 shrink-0" title="Delete folder">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
        {isOpen && (
          <div className="ml-4 border-l border-gray-800/60 pl-1">
            {node.children.map(child => renderFolderNode(colId, child, depth + 1))}
            {node.requests.map(req => renderRequest(req))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ══ Left icon strip ══ */}
      <div className="w-16 flex flex-col items-center pt-3 pb-3 gap-1 bg-[#1c1c1c] border-r border-gray-800/80 shrink-0">
        {SIDEBAR_ITEMS.map(item => (
          <button key={item.id} onClick={() => setSidebarSection(prev => prev === item.id ? null : item.id)} title={item.title}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl gap-1 transition ${
              sidebarSection === item.id ? 'bg-gray-700/70 text-orange-400' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-700/40'
            }`}>
            {item.icon}
            <span className="text-[8px] font-medium leading-none">{item.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        {/* Import */}
        <button onClick={() => importFileRef.current?.click()} disabled={!currentWs} title="Import collection (Postman / KayScope JSON)"
          className="w-12 h-12 flex items-center justify-center rounded-xl text-gray-600 hover:text-gray-300 hover:bg-gray-700/40 disabled:opacity-30 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        </button>
      </div>

      {/* ══ Sidebar panel ══ */}
      {sidebarSection !== null && (
      <aside className="w-72 flex flex-col bg-[#141414] border-r border-gray-800 shrink-0">

        {/* ── Collections section ── */}
        {sidebarSection === 'collections' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Collections</span>
              <button onClick={() => currentWs && setShowColCreate(v => !v)} disabled={!currentWs}
                className={`transition ${currentWs ? 'text-gray-500 hover:text-orange-400' : 'text-gray-700 cursor-not-allowed'}`} title={currentWs ? 'New collection' : 'Select a workspace first'}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>

            {showColCreate && currentWs && (
              <div className="px-3 pb-2 flex flex-col gap-1 shrink-0">
                <div className="flex gap-1">
                  <input autoFocus value={newColName} onChange={e => { setNewColName(e.target.value); setColCreateError('') }} onKeyDown={e => e.key === 'Enter' && createCollection()} placeholder="Collection name"
                    className={`flex-1 bg-gray-800 text-gray-200 text-xs px-2 py-1.5 rounded border focus:outline-none ${colCreateError ? 'border-red-500' : 'border-gray-600 focus:border-orange-500'}`} />
                  <button onClick={createCollection} disabled={!newColName.trim()} className="px-2 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded transition">Add</button>
                  <button onClick={() => { setShowColCreate(false); setNewColName(''); setColCreateError('') }} className="px-2 py-1.5 text-gray-400 hover:text-gray-200 text-xs transition">{'\u2715'}</button>
                </div>
                {colCreateError && <p className="text-[10px] text-red-400">{colCreateError}</p>}
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1">
              {loadingCols && <p className="text-xs text-gray-600 px-4 py-3">Loading</p>}
              {!loadingCols && collections.length === 0 && currentWs && <p className="text-xs text-gray-600 px-4 py-3">No collections yet.</p>}
              {!currentWs && !loadingWs && (
                <div className="px-4 py-4">
                  <p className="text-xs text-gray-500 mb-3">No workspace selected.</p>
                  <button onClick={() => setShowWsDropdown(true)} className="w-full text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded transition">+ Create or select workspace</button>
                </div>
              )}
              {collections.map(col => (
                <div key={col.id}>
                  <div className="group flex items-center gap-1.5 px-3 py-2.5 hover:bg-gray-800/60 rounded-lg mx-2 cursor-pointer" onClick={() => toggleCollection(col.id)}>
                    <svg className={`w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform ${expandedCols.has(col.id) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    <span className="text-sm text-gray-300 font-medium truncate flex-1">{col.name}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={e => { e.stopPropagation(); createRequestImmediately(col.id) }} className="text-gray-500 hover:text-orange-400 transition p-1" title="New request">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); const rect = (e.target as HTMLElement).closest('button')!.getBoundingClientRect(); const menuW = 192, menuH = 220; setColCtxMenu({ colId: col.id, x: Math.min(rect.right, window.innerWidth - menuW - 8), y: Math.min(rect.bottom, window.innerHeight - menuH - 8) }) }} className="text-gray-500 hover:text-gray-300 transition p-1" title="More actions">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="4" cy="10" r="2" /><circle cx="10" cy="10" r="2" /><circle cx="16" cy="10" r="2" /></svg>
                      </button>
                    </div>

                    {/* Context menu */}
                    {colCtxMenu?.colId === col.id && (
                      <div ref={colCtxRef} className="fixed z-[80] w-48 bg-[#252525] border border-gray-700 rounded-lg shadow-xl py-1 text-xs" style={{ left: colCtxMenu.x, top: colCtxMenu.y }}>
                        <button onClick={e => { e.stopPropagation(); createRequestImmediately(col.id); if (!expandedCols.has(col.id)) toggleCollection(col.id); setColCtxMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-700 transition text-left">
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Add Request
                        </button>
                        <button onClick={e => { e.stopPropagation(); setColCtxMenu(null); setRenameModal({ label: 'Folder', currentName: '', title: 'New Folder', onSave: (name) => { createFolder(col.id, name.trim()); setRenameModal(null) } }) }} className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-700 transition text-left">
                          <svg className="w-3.5 h-3.5 text-yellow-600/70" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                          Add Folder
                        </button>
                        <div className="border-t border-gray-700 my-1" />
                        <button onClick={e => { e.stopPropagation(); exportCollection(col); setColCtxMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-700 transition text-left">
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Export
                        </button>
                        <button onClick={e => { e.stopPropagation(); setRenameModal({ label: 'Collection', currentName: col.name, onSave: async (n) => { try { await renameCollection(col, n); setRenameModal(null) } catch (er) { console.error(er) } } }); setColCtxMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-700 transition text-left">
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Rename
                        </button>
                        <div className="border-t border-gray-700 my-1" />
                        <button onClick={e => { e.stopPropagation(); setConfirmModal({ title: 'Delete Collection', message: `Delete "${col.name}" and all its folders and requests? This cannot be undone.`, onConfirm: async () => { try { await deleteCollection(col) } catch (er) { console.error(er) } setConfirmModal(null) }, destructive: true }); setColCtxMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-gray-700 transition text-left">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {expandedCols.has(col.id) && (() => {
                    const { rootRequests, rootFolders } = folderTrees[col.id] ?? { rootRequests: [], rootFolders: [] }
                    const isEmpty = rootFolders.length === 0 && rootRequests.length === 0
                    return (
                      <div className="ml-5 border-l border-gray-800 pl-1">
                        {rootFolders.map(node => renderFolderNode(col.id, node, 0))}
                        {rootRequests.map(req => renderRequest(req))}
                        {isEmpty && <p className="text-[11px] text-gray-600 px-3 py-1.5">No requests.</p>}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Environments section ── */}
        {sidebarSection === 'environments' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Environments</span>
              <button onClick={() => setEnvEditorTarget('new')} disabled={!currentWs} className={`transition ${currentWs ? 'text-gray-500 hover:text-orange-400' : 'text-gray-700 cursor-not-allowed'}`} title="New environment">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pt-0">
              {environments.length === 0 ? (
                <p className="text-xs text-gray-600 py-3 px-1">No environments yet.</p>
              ) : environments.map(env => (
                <div key={env.id} className={`group flex items-center px-3 py-2.5 rounded-lg mb-1.5 cursor-pointer hover:bg-gray-800 transition ${env.id === currentEnvId ? 'bg-gray-800 border border-orange-500/30' : 'border border-transparent'}`}>
                  <div className="flex-1 min-w-0" onClick={() => setCurrentEnvId(env.id === currentEnvId ? 'none' : env.id)}>
                    <p className="text-sm font-medium text-gray-300">{env.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{env.variables.filter(v => v.enabled).length} active variable(s)</p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={(e) => { e.stopPropagation(); setEnvEditorTarget(env) }} className="p-1 text-gray-500 hover:text-blue-400 transition" title="Edit">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmModal({ title: 'Delete Environment', message: `Delete "${env.name}"?`, onConfirm: async () => { try { await deleteEnvironment(env); setConfirmModal(null) } catch (er) { console.error(er) } }, destructive: true }) }}
                      className="p-1 text-gray-500 hover:text-red-400 transition" title="Delete">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── History section ── */}
        {sidebarSection === 'history' && (
          <HistoryList
            history={history}
            loadingHistory={loadingHistory}
            openHistoryInTab={openHistoryInTab}
            loadMoreHistory={loadMoreHistory}
          />
        )}

        {/* ── Activity section ── */}
        {sidebarSection === 'activity' && (
          <ActivityList
            activityLogs={activityLogs}
            loadingActivity={loadingActivity}
            currentWs={currentWs}
            loadActivity={loadActivity}
            loadMoreActivity={loadMoreActivity}
            dbActivityCount={dbActivityCount}
          />
        )}

        {/* ── E2E Tests section ── */}
        {sidebarSection === 'tests' && <TestsSidebarPanel />}

        {/* Status bar */}
        <div className="border-t border-gray-800 px-3 py-1.5 shrink-0">
          <p className="text-[10px] text-gray-600 truncate">{currentWs?.name ?? ''}{currentEnvName ? ` · ${currentEnvName}` : ''}</p>
        </div>
      </aside>
      )}
    </>
  )
})

/* ══════════════════════════════════════════════════════════════
   HistoryList — virtualized history panel
   ══════════════════════════════════════════════════════════════ */
const HISTORY_ITEM_HEIGHT = 56 // px — matches px-4 py-2.5 + two text lines

function HistoryList({ history, loadingHistory, openHistoryInTab, loadMoreHistory }: {
  history: HistoryEntry[]
  loadingHistory: boolean
  openHistoryInTab: (h: HistoryEntry) => void
  loadMoreHistory: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const showLoadMore = !loadingHistory && history.length > 0 && history.length % 50 === 0
  // Add 1 virtual item for the "Load more" button when it's visible
  const itemCount = history.length + (showLoadMore ? 1 : 0)

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => HISTORY_ITEM_HEIGHT,
    overscan: 8,
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">History</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loadingHistory && <p className="text-xs text-gray-600 px-4 py-3">Loading...</p>}
        {!loadingHistory && history.length === 0 && (
          <p className="text-xs text-gray-600 px-4 py-3">No history yet. Send a request to see it here.</p>
        )}
        {history.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vItem => {
              // Last virtual item is the "Load more" button
              if (vItem.index === history.length) {
                return (
                  <div key="load-more" style={{ position: 'absolute', top: vItem.start, left: 0, right: 0, height: vItem.size }}>
                    <button
                      onClick={loadMoreHistory}
                      className="w-full text-xs text-orange-400 hover:text-orange-300 py-3 hover:bg-gray-800/40 transition"
                    >
                      Load more
                    </button>
                  </div>
                )
              }
              const h = history[vItem.index]
              return (
                <div
                  key={h.id}
                  style={{ position: 'absolute', top: vItem.start, left: 0, right: 0, height: vItem.size }}
                  className="group px-4 py-2.5 hover:bg-gray-800/60 cursor-pointer border-b border-gray-800/40"
                  onClick={() => openHistoryInTab(h)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${METHOD_COLOR[h.method as HttpMethod] ?? 'text-gray-400'}`}>{h.method}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBg(h.status)} ${statusColor(h.status)}`}>{h.status}</span>
                    <span className="text-[10px] text-gray-600">{h.durationMs}ms</span>
                    <span className="text-[10px] text-gray-700 ml-auto">{timeAgo(h.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5 font-mono">{h.url}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ActivityList — virtualized activity log panel
   ══════════════════════════════════════════════════════════════ */
const ACTIVITY_ITEM_HEIGHT = 68 // px — matches py-2.5 + 3 text lines

function ActivityList({ activityLogs, loadingActivity, currentWs, loadActivity, loadMoreActivity, dbActivityCount }: {
  activityLogs: ActivityLogEntry[]
  loadingActivity: boolean
  currentWs: Workspace | null
  loadActivity: () => void
  loadMoreActivity: () => void
  dbActivityCount: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const showLoadMore = !loadingActivity && activityLogs.length > 0 && dbActivityCount % 50 === 0
  const itemCount = activityLogs.length + (showLoadMore ? 1 : 0)

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ACTIVITY_ITEM_HEIGHT,
    overscan: 8,
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Activity</span>
        <button onClick={loadActivity} title="Refresh" className="text-gray-600 hover:text-gray-300 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loadingActivity && <p className="text-xs text-gray-600 px-4 py-3 text-center">Loading…</p>}
        {!loadingActivity && !currentWs && <p className="text-xs text-gray-600 px-4 py-3">Select a workspace first.</p>}
        {!loadingActivity && currentWs && activityLogs.length === 0 && <p className="text-xs text-gray-600 px-4 py-3">No activity yet.</p>}
        {activityLogs.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vItem => {
              if (vItem.index === activityLogs.length) {
                return (
                  <div key="load-more" style={{ position: 'absolute', top: vItem.start, left: 0, right: 0, height: vItem.size }}>
                    <button
                      onClick={loadMoreActivity}
                      className="w-full text-xs text-orange-400 hover:text-orange-300 py-3 hover:bg-gray-800/40 transition"
                    >
                      Load more
                    </button>
                  </div>
                )
              }
              const log = activityLogs[vItem.index]
              const color = ACTION_COLORS[log.action] ?? 'text-gray-400'
              return (
                <div
                  key={log.id}
                  style={{ position: 'absolute', top: vItem.start, left: 0, right: 0, height: vItem.size }}
                  className="px-4 py-2.5 border-b border-gray-800/40 hover:bg-gray-800/30 transition"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-300 shrink-0 mt-0.5">
                      {log.userName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-300 leading-snug">
                        <span className="font-medium">{log.userName}</span>
                        {' '}<span className={`font-medium ${color}`}>{log.action}</span>
                        {' '}<span className="text-gray-500">{log.resourceType}</span>
                        {' '}<span className="text-gray-200 font-medium truncate">&ldquo;{log.resourceName}&rdquo;</span>
                      </p>
                      {log.details && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{log.details}</p>}
                      <p className="text-[10px] text-gray-700 mt-0.5">{timeAgo(log.createdAt)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
