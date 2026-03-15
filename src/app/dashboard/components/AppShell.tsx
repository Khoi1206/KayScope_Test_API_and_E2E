'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'

import type { Workspace, SavedRequest } from './types'
import { METHOD_COLOR } from './constants'
import { ConfirmModal } from './ConfirmModal'
import { RenameModal } from './RenameModal'
import { EnvEditorModal } from './EnvEditorModal'
import { MembersModal } from './MembersModal'
import { ProfileModal } from './ProfileModal'
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
export function AppShell({ userName: initialUserName, userEmail: _userEmail, userId }: { userName: string; userEmail: string; userId: string }) {
  const [userName, setUserName] = useState(initialUserName)

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
    dbActivityCount,
    loadHistory, loadActivity,
    loadMoreHistory, loadMoreActivity,
  } = useHistoryActivity(currentWs, sidebarSection)

  /* ── Modal state ── */
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean; confirmLabel?: string; secondaryAction?: { label: string; onClick: () => void } } | null>(null)
  const [renameModal, setRenameModal] = useState<{ label: string; currentName: string; onSave: (name: string) => void; title?: string } | null>(null)
  const [membersModalWs, setMembersModalWs] = useState<Workspace | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [testBuilderKey, setTestBuilderKey] = useState(0)
  const [canGoBack, setCanGoBack] = useState(false)

  /* ── Import ref ── */
  const importFileRef = useRef<HTMLInputElement>(null)
  /* Persist Blockly workspace state across TestBuilderPanel unmounts */
  const testBlocklyStateRef = useRef<object | undefined>(undefined)
  /* Stack of previous Blockly states for back-navigation */
  const blocklyStateStackRef = useRef<object[]>([])

  const handleOpenTestRun = useCallback((run: import('./TestsSidebarPanel').SavedTestRun) => {
    if (run.blocklyState) {
      // Push current state (even if undefined = blank workspace) so Back always works
      blocklyStateStackRef.current.push(testBlocklyStateRef.current as object)
      setCanGoBack(true)
      testBlocklyStateRef.current = run.blocklyState
      setTestBuilderKey(k => k + 1)
    }
    setSidebarSection('tests')
  }, [setSidebarSection])

  const handleGoBackTestRun = useCallback(() => {
    const prev = blocklyStateStackRef.current.pop()
    testBlocklyStateRef.current = prev
    setCanGoBack(blocklyStateStackRef.current.length > 0)
    setTestBuilderKey(k => k + 1)
  }, [])

  /* Clear back-stack on workspace switch so stale states don't bleed across workspaces */
  useEffect(() => {
    blocklyStateStackRef.current = []
    testBlocklyStateRef.current = undefined
    setCanGoBack(false)
  }, [currentWs?.id])

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

  /* Current environment object — shared by resolvedEnvVars and the render below */
  const currentEnv = useMemo(
    () => environments.find(e => e.id === currentEnvId) ?? null,
    [environments, currentEnvId]
  )

  /* Resolved environment variables — passed to RequestEditor for variable tooltip */
  const resolvedEnvVars = useMemo(() => {
    const vars: Record<string, string> = {}
    currentEnv?.variables
      .filter(v => v.enabled && v.key)
      .forEach(v => { vars[v.key] = v.value })
    return vars
  }, [currentEnv])

  /* ══════════════════════════════════════════════════════════════
     COLLECTION TREE + LIVE SYNC HOOKS
     ══════════════════════════════════════════════════════════════ */

  const {
    collections,
    setRequestsByCol,
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

  /* Close a tab — shows confirm if it has unsaved changes */
  const handleTabClose = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return
    if (tab.dirty) {
      const label = tab.id === activeTabId ? reqName : tab.label
      setConfirmModal({
        title: 'Unsaved Changes',
        message: `"${label}" has unsaved changes.`,
        confirmLabel: "Don't Save",
        onConfirm: () => { setConfirmModal(null); closeTab(tabId) },
        destructive: false,
        secondaryAction: {
          label: 'Save Changes',
          onClick: async () => {
            setConfirmModal(null)
            if (tabId !== activeTabId) { switchToTab(tabId); return }
            await saveRequest()
            closeTab(tabId)
          },
        },
      })
      return
    }
    closeTab(tabId)
  }, [tabs, activeTabId, reqName, closeTab, switchToTab, saveRequest, setConfirmModal])

  /* Stable wrappers so RequestEditor (which is memo'd) doesn't re-render
     when AppShell re-renders due to unrelated state (modals, live sync, etc.) */
  const saveRequestRef = useRef(saveRequest)
  saveRequestRef.current = saveRequest
  const stableSaveRequest = useCallback(() => saveRequestRef.current(), [])

  const sendRequestRef = useRef(sendRequest)
  sendRequestRef.current = sendRequest
  const stableSendRequest = useCallback(() => sendRequestRef.current(), [])

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

  return (
    <div className="flex flex-col h-screen bg-th-bg text-th-text overflow-hidden">
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
      {showProfileModal && (
        <ProfileModal
          initialName={userName}
          onClose={() => setShowProfileModal(false)}
          onNameChange={n => setUserName(n)}
        />
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
        onOpenProfile={() => setShowProfileModal(true)}
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
          dbActivityCount={dbActivityCount}
          setConfirmModal={setConfirmModal} setRenameModal={setRenameModal}
          currentEnvName={currentEnv?.name}
          onOpenTestRun={handleOpenTestRun}
        />
        </ErrorBoundary>

        {/* ══ Main content ══ */}
        <main className="flex flex-col flex-1 overflow-hidden">

          {/* TestBuilderPanel: only mounted when active, state persisted via ref */}
          {sidebarSection === 'tests' && (
            <ErrorBoundary label="Test Builder">
              <TestBuilderPanel
                key={testBuilderKey}
                initialBlocklyState={testBlocklyStateRef.current}
                onBlocklyStateChange={s => { testBlocklyStateRef.current = s }}
                workspaceId={currentWs?.id}
                canGoBack={canGoBack}
                onGoBack={handleGoBackTestRun}
              />
            </ErrorBoundary>
          )}

          {sidebarSection !== 'tests' && (<>
          {/* ── Request tab bar ── */}
          <div className="flex items-center border-b border-th-border bg-th-tabbar shrink-0">
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
                  className={`group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-th-border/80 shrink-0 max-w-[200px] min-w-[80px] transition ${
                    isActive
                      ? 'bg-th-nav border-t-[2px] border-t-orange-500'
                      : 'text-th-text-3 hover:bg-th-input/50 hover:text-th-text-2 border-t-[2px] border-t-transparent'
                  }`}
                >
                  <span className={`text-[10px] font-bold shrink-0 ${METHOD_COLOR[displayMethod]}`}>{displayMethod.slice(0, 3)}</span>
                  <span className={`truncate flex-1 min-w-0 ${isActive ? 'text-gray-200' : ''}`}>{displayLabel}</span>
                  {tab.dirty ? (
                    <>
                      {/* Dot: visible at rest; hidden on hover */}
                      <span className="group-hover:hidden shrink-0 w-1.5 h-1.5 rounded-full bg-orange-400 ml-0.5" />
                      {/* X: visible on hover, replaces dot */}
                      <button
                        onClick={e => { e.stopPropagation(); handleTabClose(tab.id) }}
                        className="hidden group-hover:block shrink-0 text-gray-600 hover:text-red-400 transition ml-0.5 p-0.5 rounded"
                        title="Close tab (unsaved changes)"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); handleTabClose(tab.id) }}
                      className="shrink-0 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 p-0.5 rounded"
                      title="Close tab"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
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
                saveRequest={stableSaveRequest} sendRequest={stableSendRequest}
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
