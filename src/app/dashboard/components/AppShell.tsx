'use client'

import { useState, useRef, useMemo, useCallback } from 'react'

import type { Workspace, SavedRequest } from './types'
import { METHOD_COLOR } from './constants'
import { ConfirmModal } from './ConfirmModal'
import { RenameModal } from './RenameModal'
import { EnvEditorModal } from './EnvEditorModal'
import { MembersModal } from './MembersModal'
import { SaveToCollectionModal } from './SaveToCollectionModal'
import { TestBuilderPanel } from './TestBuilderPanel'
import { ResponsePanel } from './ResponsePanel'
import { RequestEditor } from './RequestEditor'
import { Navbar } from './Navbar'
import { SidebarPanel } from './SidebarPanel'
import type { SidebarSection } from './SidebarPanel'
import { ErrorBoundary } from './ErrorBoundary'
import {
  useWorkspaces, useEnvironments, useHistoryActivity,
  useLiveSync, useCollectionTree, useRequestEditor,
} from '../hooks'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AppShell({ userName, userEmail: _userEmail, userId }: { userName: string; userEmail: string; userId: string }) {

  /* ══════════════════════════════════════════════════════════════
     CUSTOM HOOKS — workspace, env, history, toast, collections
     ══════════════════════════════════════════════════════════════ */

  const {
    workspaces, setWorkspaces, currentWs, setCurrentWs,
    showWsDropdown, setShowWsDropdown,
    newWsName, setNewWsName,
    showWsCreate, setShowWsCreate,
    wsCreateError, setWsCreateError,
    loadingWs, wsDropdownRef,
    createWorkspace, renameWorkspace, deleteWorkspace,
  } = useWorkspaces()

  /* ── Sidebar section (referenced by multiple hooks) ── */
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>('collections')

  const {
    environments, setEnvironments,
    currentEnvId, setCurrentEnvId,
    envEditorTarget, setEnvEditorTarget,
    saveEnvironment, deleteEnvironment, reloadEnvironments,
  } = useEnvironments(currentWs)

  const {
    history,
    loadingHistory,
    activityLogs, setActivityLogs,
    loadingActivity,
    loadHistory, loadActivity,
    loadMoreHistory, loadMoreActivity,
  } = useHistoryActivity(currentWs, sidebarSection)

  /* ── Modal state ── */
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>(null)
  const [renameModal, setRenameModal] = useState<{ label: string; currentName: string; onSave: (name: string) => void; title?: string } | null>(null)
  const [membersModalWs, setMembersModalWs] = useState<Workspace | null>(null)

  /* ── Import ref ── */
  const importFileRef = useRef<HTMLInputElement>(null)

  /* ══════════════════════════════════════════════════════════════
     REQUEST EDITOR HOOK (uses ref bridge for setRequestsByCol)
     ══════════════════════════════════════════════════════════════ */

  /* Ref bridge: useRequestEditor needs setRequestsByCol from useCollectionTree,
     but useCollectionTree needs openInTab/handleRequestsRemoved from useRequestEditor.
     We break the cycle with a stable proxy function that delegates through a ref. */
  const setRequestsByColProxy = useRef<React.Dispatch<React.SetStateAction<Record<string, SavedRequest[]>>>>(() => {})

  const stableSetRequestsByCol = useCallback(
    (...args: Parameters<typeof setRequestsByColProxy.current>) => {
      setRequestsByColProxy.current(...args)
    },
    []
  )

  const editor = useRequestEditor({
    currentWs,
    environments,
    currentEnvId,
    setEnvironments,
    setRequestsByCol: stableSetRequestsByCol,
    sidebarSection,
    loadHistory,
  })

  /* Destructure editor values for convenient access */
  const {
    activeReq, isDraft, reqName, method, url,
    params, setParams, headers, setHeaders, body, setBody, auth, setAuth,
    activeTab, setActiveTab,
    preRequestScript, setPreRequestScript, postRequestScript, setPostRequestScript,
    preScriptResult, postScriptResult,
    tempVars,
    tabs, activeTabId, tabBarRef,
    response, responseTab, setResponseTab, isSending, sendError, requestTiming,
    isSaving, saveFlash, saveError, setSaveError, saveToColModal, setSaveToColModal,
    switchToTab, closeTab, newTab, openInTab, openHistoryInTab,
    handleRequestsRemoved, saveRequest, sendRequest,
    varOverrides, setVarOverride,
  } = editor

  /* Resolved environment variables — passed to RequestEditor for variable tooltip */
  const resolvedEnvVars = useMemo(() => {
    const vars: Record<string, string> = {}
    environments.find(e => e.id === currentEnvId)?.variables
      .filter(v => v.enabled && v.key)
      .forEach(v => { vars[v.key] = v.value })
    return vars
  }, [environments, currentEnvId])

  /* ══════════════════════════════════════════════════════════════
     COLLECTION TREE + LIVE SYNC HOOKS
     ══════════════════════════════════════════════════════════════ */

  const {
    collections,
    requestsByCol, setRequestsByCol,
    foldersByCol,
    expandedCols, expandedFolders, setExpandedFolders,
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
  } = useCollectionTree(currentWs, importFileRef, {
    onOpenInTab: openInTab,
    onRequestsRemoved: handleRequestsRemoved,
  })

  /* Wire up the ref bridge now that both hooks are initialized */
  setRequestsByColProxy.current = setRequestsByCol

  const { liveConnected } = useLiveSync(currentWs?.id, userId, {
    reloadCollections,
    reloadEnvironments,
    reloadExpandedCollectionData,
    setWorkspaces,
    setActivityLogs,
  })

  /* ─────────────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────────────── */

  const currentEnv = useMemo(
    () => environments.find(e => e.id === currentEnvId) ?? null,
    [environments, currentEnvId]
  )

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-gray-100 overflow-hidden">
      {/* Hidden file input for import */}
      <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

      {/* ── Modals ── */}
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
      {renameModal && <RenameModal {...renameModal} onCancel={() => setRenameModal(null)} />}
      {envEditorTarget !== null && (
        <EnvEditorModal
          env={envEditorTarget === 'new' ? null : envEditorTarget}
          onSave={saveEnvironment}
          onCancel={() => setEnvEditorTarget(null)}
        />
      )}
      {membersModalWs && (
        <MembersModal ws={membersModalWs} currentUserId={userId} onClose={() => setMembersModalWs(null)} />
      )}
      {saveToColModal && (
        <SaveToCollectionModal
          collections={collections}
          foldersByCol={foldersByCol}
          loadFolders={loadFoldersForCollection}
          onSave={(colId, folderId) => { setSaveToColModal(false); saveRequest(colId, folderId) }}
          onCancel={() => setSaveToColModal(false)}
        />
      )}

      {/* ══ Navbar ══ */}
      <Navbar
        workspaces={workspaces} currentWs={currentWs} setCurrentWs={setCurrentWs} loadingWs={loadingWs}
        createWorkspace={createWorkspace} renameWorkspace={renameWorkspace} deleteWorkspace={deleteWorkspace}
        showWsDropdown={showWsDropdown} setShowWsDropdown={setShowWsDropdown}
        newWsName={newWsName} setNewWsName={setNewWsName}
        showWsCreate={showWsCreate} setShowWsCreate={setShowWsCreate}
        wsCreateError={wsCreateError} setWsCreateError={setWsCreateError}
        wsDropdownRef={wsDropdownRef}
        importFileRef={importFileRef}
        liveConnected={liveConnected}
        environments={environments} currentEnvId={currentEnvId} setCurrentEnvId={setCurrentEnvId}
        setMembersModalWs={setMembersModalWs} setRenameModal={setRenameModal} setConfirmModal={setConfirmModal}
        userName={userName}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ══ Left icon strip + Sidebar ══ */}
        <ErrorBoundary label="Sidebar">
        <SidebarPanel
          sidebarSection={sidebarSection} setSidebarSection={setSidebarSection}
          currentWs={currentWs} loadingWs={loadingWs} setShowWsDropdown={setShowWsDropdown}
          collections={collections} loadingCols={loadingCols}
          expandedCols={expandedCols} expandedFolders={expandedFolders} setExpandedFolders={setExpandedFolders}
          folderTrees={folderTrees} showColCreate={showColCreate} setShowColCreate={setShowColCreate}
          newColName={newColName} setNewColName={setNewColName}
          colCreateError={colCreateError} setColCreateError={setColCreateError}
          toggleCollection={toggleCollection} createCollection={createCollection}
          renameCollection={renameCollection} deleteCollection={deleteCollection}
          createFolder={createFolder} renameFolder={renameFolder} deleteFolder={deleteFolder}
          createRequestImmediately={createRequestImmediately} deleteRequest={deleteRequest}
          exportCollection={exportCollection} importFileRef={importFileRef}
          openInTab={openInTab} activeReq={activeReq} isDraft={isDraft}
          environments={environments} currentEnvId={currentEnvId} setCurrentEnvId={setCurrentEnvId}
          setEnvEditorTarget={setEnvEditorTarget} deleteEnvironment={deleteEnvironment}
          history={history} loadingHistory={loadingHistory}
          openHistoryInTab={openHistoryInTab} loadMoreHistory={loadMoreHistory}
          activityLogs={activityLogs} loadingActivity={loadingActivity}
          loadActivity={loadActivity} loadMoreActivity={loadMoreActivity}
          setConfirmModal={setConfirmModal} setRenameModal={setRenameModal}
          currentEnvName={currentEnv?.name}
        />
        </ErrorBoundary>

        {/* ══ Main content ══ */}
        <main className="flex flex-col flex-1 overflow-hidden">

          {sidebarSection === 'tests' ? <ErrorBoundary label="Test Builder"><TestBuilderPanel /></ErrorBoundary> : (<>
          {/* ── Request tab bar ── */}
          <div className="flex items-center border-b border-gray-800 bg-[#111111] shrink-0">
            {tabs.length > 3 && (
              <button onClick={() => tabBarRef.current?.scrollBy({ left: -150, behavior: 'smooth' })} className="px-1.5 py-2 text-gray-600 hover:text-gray-300 shrink-0 transition" title="Scroll left">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <div ref={tabBarRef} className="flex items-center flex-1 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {tabs.map(tab => {
              const isActive = tab.id === activeTabId
              const displayMethod = isActive ? method : tab.method
              const displayLabel = isActive ? reqName : tab.label
              return (
                <div
                  key={tab.id}
                  onClick={() => switchToTab(tab.id)}
                  className={`group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-gray-800/80 shrink-0 max-w-[200px] min-w-[80px] transition ${
                    isActive
                      ? 'bg-[#1c1c1c] border-t-[2px] border-t-orange-500'
                      : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300 border-t-[2px] border-t-transparent'
                  }`}
                >
                  <span className={`text-[10px] font-bold shrink-0 ${METHOD_COLOR[displayMethod]}`}>{displayMethod.slice(0, 3)}</span>
                  <span className={`truncate flex-1 min-w-0 ${isActive ? 'text-gray-200' : ''}`}>{displayLabel}</span>
                  <button
                    onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                    className="shrink-0 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 p-0.5 rounded"
                    title="Close tab"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
            <button
              onClick={newTab}
              className="px-3 py-2 text-gray-600 hover:text-gray-300 shrink-0 transition"
              title="New tab"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            </div>
            {tabs.length > 3 && (
              <button onClick={() => tabBarRef.current?.scrollBy({ left: 150, behavior: 'smooth' })} className="px-1.5 py-2 text-gray-600 hover:text-gray-300 shrink-0 transition" title="Scroll right">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
          </div>

          {/* Nothing selected / all tabs closed */}
          {(activeTabId === '' || (!activeReq && !isDraft)) && (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-600">
              <svg className="w-12 h-12 mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Select or create a request to get started</p>
            </div>
          )}

          {/* Request editor */}
          {activeTabId !== '' && (activeReq || isDraft) && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <ErrorBoundary label="Request Editor">
              <RequestEditor
                reqName={reqName} setReqName={editor.setReqName}
                method={method} setMethod={editor.setMethod}
                url={url} setUrl={editor.setUrl}
                saveRequest={() => saveRequest()} sendRequest={sendRequest}
                isSaving={isSaving} saveFlash={saveFlash}
                saveError={saveError} setSaveError={setSaveError}
                isSending={isSending}
                activeTab={activeTab} setActiveTab={setActiveTab}
                params={params} setParams={setParams}
                headers={headers} setHeaders={setHeaders}
                body={body} setBody={setBody}
                auth={auth} setAuth={setAuth}
                preRequestScript={preRequestScript} setPreRequestScript={setPreRequestScript}
                postRequestScript={postRequestScript} setPostRequestScript={setPostRequestScript}
                preScriptResult={preScriptResult} postScriptResult={postScriptResult}
                envVars={resolvedEnvVars} tempVars={tempVars}
                varOverrides={varOverrides} onSetVarOverride={setVarOverride}
              />
              <ResponsePanel
                response={response}
                responseTab={responseTab}
                setResponseTab={setResponseTab}
                isSending={isSending}
                sendError={sendError}
                requestTiming={requestTiming}
              />
              </ErrorBoundary>
            </div>
          )}
          </>)}
        </main>
      </div>
    </div>
  )
}
