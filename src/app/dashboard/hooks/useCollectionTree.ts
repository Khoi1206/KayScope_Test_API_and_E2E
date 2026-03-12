'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Workspace, Collection, Folder, SavedRequest, FolderNode } from '../components/types'
import { DEFAULT_HEADERS, EMPTY_BODY, EMPTY_AUTH } from '../components/constants'
import { apiFetch, buildFolderTree } from '../components/utils'
import { useToastContext } from '../components/ToastContext'

interface CollectionTreeCallbacks {
  /** Open a saved request in the editor tab system */
  onOpenInTab: (req: SavedRequest) => void
  /**
   * Called when requests are removed (collection/folder delete).
   * `shouldDemote` returns true for requests that were deleted.
   */
  onRequestsRemoved: (shouldDemote: (req: SavedRequest) => boolean) => void
}

export function useCollectionTree(
  currentWs: Workspace | null,
  importFileRef: React.RefObject<HTMLInputElement | null>,
  callbacks: CollectionTreeCallbacks,
) {
  const { showToast } = useToastContext()
  const [collections, setCollections] = useState<Collection[]>([])
  const [requestsByCol, setRequestsByCol] = useState<Record<string, SavedRequest[]>>({})
  const [foldersByCol, setFoldersByCol] = useState<Record<string, Folder[]>>({})
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [loadingCols, setLoadingCols] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [showColCreate, setShowColCreate] = useState(false)
  const [colCreateError, setColCreateError] = useState('')

  /* Guard: prevent duplicate collection fetches */
  const fetchingColsRef = useRef(new Set<string>())
  /* Refs to read maps without re-creating callbacks */
  const requestsByColRef = useRef(requestsByCol)
  requestsByColRef.current = requestsByCol
  const foldersByColRef = useRef(foldersByCol)
  foldersByColRef.current = foldersByCol
  /* Keep callbacks in ref to avoid stale closures */
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  /* Load collections when workspace changes (stale guard prevents race on rapid ws switch) */
  useEffect(() => {
    if (!currentWs) { setCollections([]); setRequestsByCol({}); setFoldersByCol({}); setExpandedCols(new Set()); setExpandedFolders(new Set()); return }
    let stale = false
    setLoadingCols(true)
    setCollections([]); setRequestsByCol({}); setFoldersByCol({}); setExpandedCols(new Set()); setExpandedFolders(new Set())
    setShowColCreate(false); setNewColName('')
    apiFetch<{ collections: Collection[] }>(`/api/collections?workspaceId=${currentWs.id}`)
      .then(({ collections: cols }) => { if (!stale) setCollections(cols) })
      .catch(console.error)
      .finally(() => { if (!stale) setLoadingCols(false) })
    return () => { stale = true }
  }, [currentWs])

  /* Pre-compute folder trees for all expanded collections */
  const folderTrees = useMemo(() => {
    const result: Record<string, { rootRequests: SavedRequest[]; rootFolders: FolderNode[] }> = {}
    for (const colId of Array.from(expandedCols)) {
      result[colId] = buildFolderTree(foldersByCol[colId] ?? [], requestsByCol[colId] ?? [])
    }
    return result
  }, [expandedCols, foldersByCol, requestsByCol])

  /* Toggle collection expand (lazy load requests) */
  const toggleCollection = useCallback(async (colId: string) => {
    setExpandedCols(prev => {
      const next = new Set(prev)
      if (next.has(colId)) { next.delete(colId) } else { next.add(colId) }
      return next
    })
    if (!requestsByColRef.current[colId] && !fetchingColsRef.current.has(colId)) {
      fetchingColsRef.current.add(colId)
      try {
        const [{ requests }, { folders }] = await Promise.all([
          apiFetch<{ requests: SavedRequest[] }>(`/api/requests?collectionId=${colId}`),
          apiFetch<{ folders: Folder[] }>(`/api/folders?collectionId=${colId}`),
        ])
        setRequestsByCol(prev => ({ ...prev, [colId]: requests }))
        setFoldersByCol(prev => ({ ...prev, [colId]: folders }))
      } catch (e) { console.error(e) }
      finally { fetchingColsRef.current.delete(colId) }
    }
  }, [])

  /* Load folders for a collection on-demand (used by SaveToCollectionModal) */
  const loadFoldersForCollection = useCallback(async (colId: string) => {
    if (foldersByColRef.current[colId] || fetchingColsRef.current.has(colId)) return
    fetchingColsRef.current.add(colId)
    try {
      const [{ requests }, { folders }] = await Promise.all([
        apiFetch<{ requests: SavedRequest[] }>(`/api/requests?collectionId=${colId}`),
        apiFetch<{ folders: Folder[] }>(`/api/folders?collectionId=${colId}`),
      ])
      setRequestsByCol(prev => ({ ...prev, [colId]: requests }))
      setFoldersByCol(prev => ({ ...prev, [colId]: folders }))
    } finally { fetchingColsRef.current.delete(colId) }
  }, [])

  /* ── Create collection ── */
  const createCollection = useCallback(async () => {
    const name = newColName.trim()
    if (!currentWs) return
    if (name.length < 1) { setColCreateError('Name is required'); return }
    setColCreateError('')
    try {
      const { collection } = await apiFetch<{ collection: Collection }>('/api/collections', { method: 'POST', body: JSON.stringify({ name, workspaceId: currentWs.id }) })
      setCollections(prev => [...prev, collection])
      setNewColName(''); setShowColCreate(false); setColCreateError('')
    } catch (e) { setColCreateError(e instanceof Error ? e.message : 'Failed to create collection') }
  }, [currentWs, newColName])

  /** Throws on failure — caller handles modal dismiss */
  const renameCollection = useCallback(async (col: Collection, newName: string) => {
    const { collection } = await apiFetch<{ collection: Collection }>(`/api/collections/${col.id}`, { method: 'PUT', body: JSON.stringify({ name: newName }) })
    setCollections(prev => prev.map(c => c.id === col.id ? collection : c))
  }, [])

  /** Throws on failure — caller handles modal dismiss */
  const deleteCollection = useCallback(async (col: Collection) => {
    await apiFetch(`/api/collections/${col.id}`, { method: 'DELETE' })
    setCollections(prev => prev.filter(c => c.id !== col.id))
    setRequestsByCol(prev => { const n = { ...prev }; delete n[col.id]; return n })
    setFoldersByCol(prev => { const n = { ...prev }; delete n[col.id]; return n })
    setExpandedCols(prev => { const n = new Set(prev); n.delete(col.id); return n })
    // Notify parent to demote tabs belonging to this collection
    callbacksRef.current.onRequestsRemoved(req => req.collectionId === col.id)
  }, [])

  /* ── Create folder ── */
  const createFolder = useCallback(async (colId: string, name: string, parentFolderId?: string) => {
    try {
      // Ensure collection data is loaded
      if (!requestsByColRef.current[colId]) {
        const [{ requests }, { folders }] = await Promise.all([
          apiFetch<{ requests: SavedRequest[] }>(`/api/requests?collectionId=${colId}`),
          apiFetch<{ folders: Folder[] }>(`/api/folders?collectionId=${colId}`),
        ])
        setRequestsByCol(prev => ({ ...prev, [colId]: requests }))
        setFoldersByCol(prev => ({ ...prev, [colId]: folders }))
      }
      const { folder } = await apiFetch<{ folder: Folder }>('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ collectionId: colId, parentFolderId, name }),
      })
      setFoldersByCol(prev => ({ ...prev, [colId]: [...(prev[colId] ?? []), folder] }))
      setExpandedCols(prev => { const n = new Set(prev); n.add(colId); return n })
      setExpandedFolders(prev => { const n = new Set(prev); n.add(`${colId}::${folder.id}`); return n })
    } catch (e) { console.error(e) }
  }, [])

  /** Throws on failure — caller handles modal dismiss */
  const renameFolder = useCallback(async (colId: string, folderId: string, newName: string) => {
    const { folder } = await apiFetch<{ folder: Folder }>(`/api/folders/${folderId}`, {
      method: 'PUT', body: JSON.stringify({ name: newName }),
    })
    setFoldersByCol(prev => ({ ...prev, [colId]: (prev[colId] ?? []).map(f => f.id === folderId ? { ...f, name: folder.name } : f) }))
  }, [])

  /* ── Delete folder (cascade handled server-side) ── */
  const deleteFolder = useCallback(async (colId: string, folderId: string) => {
    const allFolders = foldersByColRef.current[colId] ?? []
    const deletedFolderIds = new Set<string>()
    const collectDescendants = (id: string) => {
      deletedFolderIds.add(id)
      allFolders.filter(f => f.parentFolderId === id).forEach(f => collectDescendants(f.id))
    }
    collectDescendants(folderId)

    // Save previous state for rollback
    const prevFolders = foldersByColRef.current[colId] ?? []
    const prevRequests = requestsByColRef.current[colId] ?? []

    // Optimistic UI update
    const remainingRequests = prevRequests.filter(r => !r.folderId || !deletedFolderIds.has(r.folderId))
    const remainingIds = new Set(remainingRequests.map(r => r.id))
    setFoldersByCol(prev => ({ ...prev, [colId]: allFolders.filter(f => !deletedFolderIds.has(f.id)) }))
    setRequestsByCol(prev => ({ ...prev, [colId]: remainingRequests }))
    // Clean up expanded state for deleted folder keys (folder IDs are unique ObjectIds, no rollback needed)
    setExpandedFolders(prev => {
      const next = new Set(prev)
      deletedFolderIds.forEach(id => next.delete(`${colId}::${id}`))
      return next
    })

    // Fire DELETE — rollback on failure, demote tabs only on success
    try {
      await apiFetch(`/api/folders/${folderId}`, { method: 'DELETE' })
      // Demote affected tabs only after confirmed server-side delete
      callbacksRef.current.onRequestsRemoved(req => req.collectionId === colId && !remainingIds.has(req.id))
    } catch (e) {
      console.error(e)
      setFoldersByCol(prev => ({ ...prev, [colId]: prevFolders }))
      setRequestsByCol(prev => ({ ...prev, [colId]: prevRequests }))
    }
  }, [])

  /* ── Create request immediately ── */
  const createRequestImmediately = useCallback(async (colId: string, folderId?: string) => {
    try {
      if (!requestsByColRef.current[colId]) {
        const [{ requests }, { folders }] = await Promise.all([
          apiFetch<{ requests: SavedRequest[] }>(`/api/requests?collectionId=${colId}`),
          apiFetch<{ folders: Folder[] }>(`/api/folders?collectionId=${colId}`),
        ])
        setRequestsByCol(prev => ({ ...prev, [colId]: requests }))
        setFoldersByCol(prev => ({ ...prev, [colId]: folders }))
      }
      const { request } = await apiFetch<{ request: SavedRequest }>('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          collectionId: colId, folderId: folderId || undefined,
          name: 'New Request', method: 'GET', url: '',
          headers: DEFAULT_HEADERS, params: [], body: EMPTY_BODY, auth: EMPTY_AUTH,
        }),
      })
      setRequestsByCol(prev => ({ ...prev, [colId]: [...(prev[colId] ?? []), request] }))
      setExpandedCols(prev => { const n = new Set(prev); n.add(colId); return n })
      if (folderId) {
        setExpandedFolders(prev => { const n = new Set(prev); n.add(`${colId}::${folderId}`); return n })
      }
      callbacksRef.current.onOpenInTab(request)
    } catch (e) { console.error(e) }
  }, [])

  /** Throws on failure — caller handles modal dismiss */
  const deleteRequest = useCallback(async (req: SavedRequest) => {
    await apiFetch(`/api/requests/${req.id}`, { method: 'DELETE' })
    setRequestsByCol(prev => ({ ...prev, [req.collectionId]: (prev[req.collectionId] ?? []).filter(r => r.id !== req.id) }))
    callbacksRef.current.onRequestsRemoved(r => r.id === req.id)
  }, [])

  /* ── Export collection ── */
  const exportCollection = useCallback(async (col: Collection) => {
    try {
      const data = await apiFetch<Record<string, unknown>>(`/api/export?collectionId=${col.id}`)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${col.name.replace(/\s+/g, '_')}.kayscope.json`
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { console.error(e) }
  }, [])

  /* ── Import collection ── */
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentWs) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await apiFetch<{ collection: Collection; importedRequests: number }>('/api/export', {
        method: 'POST', body: JSON.stringify({ workspaceId: currentWs.id, data })
      })
      setCollections(prev => [...prev, result.collection])
      showToast(`Imported ${result.importedRequests} request(s) into "${result.collection.name}"`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error')
    }
    if (importFileRef.current) importFileRef.current.value = ''
  }, [currentWs, importFileRef, showToast])

  /* ── SSE reload helpers ── */
  const reloadCollections = useCallback(async () => {
    if (!currentWs) return
    try {
      const { collections: cols } = await apiFetch<{ collections: Collection[] }>(`/api/collections?workspaceId=${currentWs.id}`)
      setCollections(cols)
    } catch { /* ignore */ }
  }, [currentWs])

  const reloadExpandedCollectionData = useCallback(async () => {
    const colIds = Array.from(expandedCols)
    if (!colIds.length) return
    await Promise.all(colIds.map(async (colId) => {
      try {
        const [{ requests }, { folders }] = await Promise.all([
          apiFetch<{ requests: SavedRequest[] }>(`/api/requests?collectionId=${colId}`),
          apiFetch<{ folders: Folder[] }>(`/api/folders?collectionId=${colId}`),
        ])
        setRequestsByCol(prev => ({ ...prev, [colId]: requests }))
        setFoldersByCol(prev => ({ ...prev, [colId]: folders }))
      } catch { /* ignore */ }
    }))
  }, [expandedCols])

  return {
    collections, setCollections,
    requestsByCol, setRequestsByCol,
    foldersByCol, setFoldersByCol,
    expandedCols, setExpandedCols,
    expandedFolders, setExpandedFolders,
    loadingCols,
    newColName, setNewColName,
    showColCreate, setShowColCreate,
    colCreateError, setColCreateError,
    folderTrees,
    toggleCollection, loadFoldersForCollection,
    createCollection, renameCollection, deleteCollection,
    createFolder, renameFolder, deleteFolder,
    createRequestImmediately, deleteRequest,
    exportCollection, handleImportFile,
    reloadCollections, reloadExpandedCollectionData,
  }
}
