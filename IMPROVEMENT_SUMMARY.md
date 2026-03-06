# KayScope v1.1 — Improvement Summary

> **Date:** March 6, 2026
> **Stack:** Next.js 14.2.35 · NextAuth v4 · MongoDB 6.21.0 · Tailwind CSS 3.4.1 · Blockly 12.4.1 · Playwright 1.58.2

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Phase 1 — Foundation](#phase-1--foundation)
4. [Phase 2 — UI Redesign & Features](#phase-2--ui-redesign--features)
5. [Phase 3 — E2E Testing & Test Builder](#phase-3--e2e-testing--test-builder)
6. [Phase 4 — Full Audit & Bug Fixes](#phase-4--full-audit--bug-fixes)
7. [Phase 5 — Monolithic Refactor (Hooks)](#phase-5--monolithic-refactor-hooks)
8. [Phase 6 — Component Extraction](#phase-6--component-extraction)
9. [Phase 7 — Web Worker Script Sandboxing](#phase-7--web-worker-script-sandboxing)
10. [Phase 8 — Design Patterns (Factory & Singleton)](#phase-8--design-patterns-factory--singleton)
11. [Phase 9 — Performance & Resilience](#phase-9--performance--resilience)
12. [Phase 10 — Context & Strategy Patterns](#phase-10--context--strategy-patterns)
13. [Bug Check Rounds](#bug-check-rounds)
14. [Phase 11 — Postman-Style Variable Tooltip](#phase-11--postman-style-variable-tooltip)
15. [Performance Audit](#performance-audit)
16. [Phase 12 — Variable Override Input](#phase-12--variable-override-input)
17. [Bug Check Round 5](#bug-check-round-5)
18. [Logic Audit](#logic-audit)
19. [Final File Inventory](#final-file-inventory)
20. [Metrics & Results](#metrics--results)

---

## Project Overview

**KayScope** is a Postman-like API testing application with:

- Workspace-based team collaboration with invite system
- Collections, folders, and saved requests (full CRUD)
- HTTP execution engine (via `undici`) with TLS bypass support
- Environment variables with secret masking
- Request chaining & scripting (pre/post-request scripts with Postman-compatible `pm` API)
- Request history with full response replay
- Activity logs with real-time sync (SSE)
- Postman collection import/export
- Blockly-based visual E2E test builder with 18 custom Playwright blocks
- Dark theme Postman-style UI

---

## Architecture

### Clean Architecture (Domain-Driven)

```
src/modules/
├── auth/          (login, register, user repository)
├── workspace/     (workspace CRUD, member management)
├── collection/    (collection CRUD)
├── folder/        (folder CRUD, nested hierarchy)
├── request/       (saved request CRUD)
├── environment/   (environment variables CRUD)
├── history/       (request execution history)
└── activity/      (activity log tracking)
```

Each module follows: `domain/` (entities, repositories, usecases) → `infrastructure/` (MongoDB repos) → `presentation/`.

### API Routes (19 endpoints)

| Route | Purpose |
|-------|---------|
| `/api/auth/[...nextauth]` | NextAuth handler |
| `/api/auth/register` | User registration |
| `/api/workspaces` | Workspace list / create |
| `/api/workspaces/[id]` | Workspace update / delete |
| `/api/workspaces/[id]/members` | Member invite / list |
| `/api/workspaces/[id]/members/[userId]` | Remove member |
| `/api/workspaces/[id]/activity` | Activity log |
| `/api/workspaces/[id]/sync` | SSE real-time sync |
| `/api/collections` | Collection list / create |
| `/api/collections/[id]` | Collection update / delete |
| `/api/folders` | Folder list / create |
| `/api/folders/[id]` | Folder update / delete |
| `/api/requests` | Request list / create |
| `/api/requests/[id]` | Request update / delete |
| `/api/environments` | Environment list / create |
| `/api/environments/[id]` | Environment update / delete |
| `/api/execute` | HTTP request execution |
| `/api/export` | Collection import / export |
| `/api/history` | Request history |
| `/api/playwright/run` | Run Playwright tests |
| `/api/playwright/ui` | Playwright UI mode |

### Dashboard Component Architecture

```
AppShell (326 lines — orchestrator)
├── Navbar (164 lines)
├── SidebarPanel (419 lines)
│   ├── Icon strip (5 sections)
│   ├── Collections tree (context menu, folders, requests)
│   ├── Environments panel
│   ├── History panel
│   ├── Activity panel
│   └── Tests panel (→ TestsSidebarPanel)
├── RequestEditor (395 lines)
│   ├── Name bar + Save button
│   ├── URL bar + Method selector + Send button
│   ├── Variable tooltip ({{var}} hover with source badge + "Variables in request" list)
│   ├── Tab strip (Params, Headers, Body, Auth, Pre/Post scripts)
│   └── Script Console output
├── ResponsePanel (140 lines)
│   ├── Status bar (status, time, size)
│   └── Sub-tabs (Pretty, Raw, Headers, Cookies, Timing)
├── ErrorBoundary (75 lines — React class, wraps Sidebar / RequestEditor / Test Builder)
└── Tab bar (request tabs with snapshot system)
```

### Custom Hooks (8 files)

```
hooks/
├── index.ts              (7 lines — barrel export)
├── useWorkspaces.ts      (77 lines — workspace CRUD, dropdown, outside-click)
├── useEnvironments.ts    (68 lines — env CRUD, SSE reload, stale guard)
├── useHistoryActivity.ts (105 lines — history + activity, pagination, stale guards)
├── useLiveSync.ts        (58 lines — SSE EventSource, targeted refresh)
├── useCollectionTree.ts  (315 lines — collection/folder/request CRUD, lazy-load, import/export)
├── useDebounce.ts        (18 lines — generic debounce hook)
└── useRequestEditor.ts   (442 lines — editor state, tab snapshots, save/send, scripting)
```

### Global State

```
ToastContext.tsx   (65 lines — React Context, ToastProvider + useToastContext)
```

---

## Phase 1 — Foundation

**What was built:**

- Full project scaffolding with Next.js 14 App Router + strict TypeScript
- NextAuth v4 integration with CredentialsProvider, JWT strategy, 30-day sessions
- MongoDB connection with global caching for HMR
- Clean Architecture: 8 domain modules with entities, repositories, use cases
- All 19 API routes with proper error handling
- Custom error classes (AppError, ValidationError, AuthError)
- Activity logging system
- Middleware for route protection

---

## Phase 2 — UI Redesign & Features

**What was built:**

- Postman-style dark theme UI with Tailwind CSS
- AppShell sidebar tree with collections, folders, nested request hierarchy
- Full CRUD for workspaces, collections, folders, requests, environments
- HTTP execution engine using `undici` with environment variable substitution
- Environment variable editor with secret masking
- Invite Member modal for workspace collaboration
- Postman collection import/export (JSON format)
- Request history with response replay
- Activity logs panel with real-time updates
- Live sync via SSE (`ReadableStream`, 4s poll, 20s heartbeat)

---

## Phase 3 — E2E Testing & Test Builder

**What was built:**

- Playwright 1.58.2 installed and configured
- 20 E2E tests across 3 test files
- **Blockly-based visual test builder:**
  - 18 custom Playwright blocks (navigate, click, fill, assert, wait, screenshot, etc.)
  - `blocks.ts` — JSON block definitions
  - `generator.ts` — `chainToCode()` Playwright code generator
  - `toolbox.ts` — categorized block toolbox
  - `BlocklyEditor.tsx` — visual drag-and-drop editor
  - `CodePreview.tsx` — live generated code preview
  - `ResultsPanel.tsx` — test execution results display
  - `TestBuilderClient.tsx` — full test builder page
  - `TestsSidebarPanel.tsx` — sidebar integration
  - `TestBuilderPanel.tsx` — dashboard panel wrapper

---

## Phase 4 — Full Audit & Bug Fixes

### Audit Scope

Every source file in the project was read and analyzed. The audit found **22 issues** in `AppShell.tsx` (3 High, 9 Medium, 10 Low).

### Round 1 — Critical & High Priority (10 fixes)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | High | No request abort on re-send → race conditions | Added `AbortController` with abort-before-send |
| 2 | High | `new Function()` script runner could block UI (infinite loop) | Addressed fully in Phase 7 (Web Worker) |
| 3 | High | Env variable persistence lost on page reload | Fixed `saveEnvironment` to persist via API |
| 4 | Medium | Missing error boundary for script execution | Wrapped in try/catch with error state |
| 5 | Medium | Toast auto-dismiss timer never cleared | Added cleanup timeout |
| 6 | Medium | Collection context menu stays open after action | Added close-on-action |
| 7 | Medium | No loading state for HTTP execution | Added `isSending` state with spinner |
| 8 | Medium | Workspace dropdown didn't close on outside click | Added `useRef` + `mousedown` handler |
| 9 | Medium | Environment delete didn't reset `currentEnvId` | Added `setCurrentEnvId('none')` on delete |
| 10 | Low | Several unused imports and variables | Cleaned up all unused imports |

### Round 2 — Advisory Improvements (6 fixes)

| # | Improvement |
|---|-------------|
| 1 | Added `formatBytes()` utility for response size display |
| 2 | Added response body truncation (500KB) with Raw tab fallback |
| 3 | Added cookie parsing in response Cookies tab |
| 4 | Added timing breakdown visualization (DNS, TCP, TLS, TTFB, Download) |
| 5 | Added save flash feedback animation ("Saved!" green flash) |
| 6 | Added keyboard shortcut: Enter in URL bar to send request |

### Round 3 — State Management & Performance (5 fixes)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Stale closure in SSE handler | Moved callbacks to `useRef` pattern |
| 2 | Unnecessary re-renders from inline object props | Memoized with `useMemo`/`useCallback` |
| 3 | Collection data refetched on every expand toggle | Added guard ref (`fetchingColsRef`) |
| 4 | Folder tree recomputed on every render | Memoized with `useMemo` |
| 5 | History/activity auto-load firing on mount even when sidebar closed | Added sidebar section guard |

---

## Phase 5 — Monolithic Refactor (Hooks)

The original `AppShell.tsx` was **1,714 lines** — a monolithic component containing all state, effects, event handlers, and UI rendering.

### Round 4 — First Hook Extraction (1,714 → 1,314 lines)

Extracted **6 custom hooks** from AppShell:

| Hook | Lines | Responsibility |
|------|-------|---------------|
| `useWorkspaces` | 77 | Workspace CRUD, dropdown, outside-click |
| `useEnvironments` | 60 | Environment CRUD, SSE reload |
| `useHistoryActivity` | 76 | History + activity loading, auto-refresh, pagination |
| `useLiveSync` | 58 | SSE EventSource, targeted refresh dispatch |
| `useCollectionTree` | 299 | Collection/folder/request CRUD, lazy-load, import/export |
| `useToast` | 14 | Toast state + auto-dismiss |

**Key pattern:** Ref bridge to break circular dependency between hooks. `callbacksRef` pattern ensures stable closures.

### Round 5 — useRequestEditor + Components (1,314 → 697 lines)

| Extraction | Lines | What moved |
|------------|-------|-----------|
| `useRequestEditor` | 448 | All request editor state (~20 useState), tab snapshot system, save/send logic, script execution |
| `RequestEditor` | 219 | Name bar, URL bar, method selector, editor tab strip, all tab content panels |
| `ResponsePanel` | 140 | Response display, status bar, Pretty/Raw/Headers/Cookies/Timing tabs |

**Architecture innovation:** **Ref bridge pattern** — `setRequestsByColProxy` ref breaks the circular dependency where `useRequestEditor` needs `setRequestsByCol` from `useCollectionTree`, but `useCollectionTree` needs `openInTab`/`handleRequestsRemoved` from `useRequestEditor`.

---

## Phase 6 — Component Extraction

### Round 6 — Navbar + SidebarPanel (697 → 326 lines)

| Component | Lines | What moved |
|-----------|-------|-----------|
| `Navbar` | 164 | Workspace dropdown (CRUD actions), import button, live sync indicator, environment selector, user menu with sign out |
| `SidebarPanel` | 419 | Left icon strip (5 sections), all 5 sidebar content panels, context menu state/effect, tree rendering helpers (`toggleFolder`, `renderRequest`, `renderFolderNode`), status bar |

**Exported type:** `SidebarSection = 'collections' | 'environments' | 'history' | 'activity' | 'tests' | null`

### Bug Fix Round (6 bugs found and fixed)

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | Medium | Context menu clicks propagated to parent, toggling collection expand | Added `e.stopPropagation()` to all 5 context menu buttons |
| 2 | Low | Unused imports in `Navbar.tsx` (`useRef`, `useState`, `useEffect`) | Removed |
| 3 | Low | Unused imports in `useRequestEditor.ts` (`useCallback`, `RawBodyType`) | Removed |
| 4 | Low | `closeTab()` didn't reset scripts/tempVars when closing last tab | Added missing resets |
| 5 | Low | `deleteFolder` rollback didn't undo tab demotions on API failure | Moved `onRequestsRemoved` inside `try` block |
| 6 | Cosmetic | Triple redundant `setIsSending(false)` in `sendRequest()` | Removed from tab-switched paths; `finally` handles it |

---

## Phase 7 — Web Worker Script Sandboxing

### Problem

`script-runner.ts` (206 lines) executed user scripts via `new Function()` on the **main thread**:

- ❌ Blocks UI during script execution
- ❌ Infinite loops freeze the entire app
- ❌ Script has access to some outer scope variables
- ❌ No timeout protection

### Solution

Refactored into 3-file Worker architecture:

| File | Lines | Role |
|------|-------|------|
| `script-sandbox.ts` | 213 | Types, `makeExpect()` chai-style helper, `executeScript()` — pure sync logic |
| `script-worker.ts` | 22 | Web Worker entry — receives message, calls `executeScript`, posts result |
| `script-runner.ts` | 89 | Async `runScript()` — creates Worker, 10s timeout, auto-terminates |

### Security Improvements

| Before | After |
|--------|-------|
| Main thread execution | Dedicated Worker thread |
| No timeout | 10-second timeout with `worker.terminate()` |
| UI blocks on long scripts | Non-blocking (off main thread) |
| Access to some outer scope | Worker has NO access to DOM, window, document, fetch, cookies, localStorage |
| No fallback needed | Graceful inline fallback when Workers unavailable (SSR, CSP) |

### API Change

```typescript
// Before (synchronous)
const result = runScript(script, context)

// After (async, Worker-based)
const result = await runScript(script, context)
```

Both call sites in `useRequestEditor.ts` updated (already inside `async sendRequest()`).

---

## Phase 8 — Design Patterns (Factory & Singleton)

### Factory Pattern — TabFactory

**Problem:** Three tab creation paths (`newTab`, `openInTab`, `openHistoryInTab`) each duplicated ~20 lines of tab meta construction, body normalization, and header merging logic.

**Solution:** Centralized `TabFactory` object in `constants.ts` with three factory methods:

| Method | Purpose |
|--------|---------|
| `TabFactory.blank()` | Creates a new empty request tab |
| `TabFactory.fromRequest(req)` | Creates a tab from a saved request (handles header merging, body normalization) |
| `TabFactory.fromHistory(h)` | Creates a draft tab from a history entry with pre-populated response |

Each method returns `{ meta: RequestTabMeta; snapshot: TabSnapshot }`.

A shared `addTabAndActivate(meta, snapshot)` helper in `useRequestEditor` captures the current tab snapshot, appends the new tab, activates it, and restores the new snapshot — eliminating ~60 lines of duplicated code replaced with ~25 lines.

`prepareBody()` utility moved from `useRequestEditor.ts` to `constants.ts` alongside the factory.

### Singleton Pattern — ScriptWorkerPool

**Problem:** `script-runner.ts` created and terminated a new Web Worker for every script execution. For rapid sequential runs (pre + post scripts), this incurs unnecessary overhead.

**Solution:** `ScriptWorkerPool` singleton class in `script-worker-pool.ts`:

| Feature | Description |
|---------|-------------|
| Singleton | `ScriptWorkerPool.getInstance()` — one pool per app |
| Pool size | 2 workers max (configurable) |
| Worker reuse | Idle workers are recycled instead of terminated |
| FIFO queue | Tasks queued when all workers are busy |
| Timeout | 10s per task — timed-out worker is replaced automatically |
| Error recovery | Errored worker is terminated and replaced |
| Cleanup | `dispose()` terminates all workers and resolves queued tasks |

`script-runner.ts` simplified from 89→43 lines — the `runInWorker()` function was replaced with a single call to `ScriptWorkerPool.getInstance().run(script, context)`.

### Files Changed

| File | Change |
|------|--------|
| `constants.ts` | Added `TabFactory` + `prepareBody()` (33→~130 lines) |
| `useRequestEditor.ts` | Replaced 3 tab creation functions with factory calls (~60→~25 lines) |
| `script-worker-pool.ts` | **NEW** — ScriptWorkerPool singleton (160 lines) |
| `script-runner.ts` | Replaced inline Worker logic with pool call (89→43 lines) |

---

## Phase 9 — Performance & Resilience

### ErrorBoundary

A React class component (`ErrorBoundary.tsx`, 75 lines) wrapping the three main render zones.

| Zone | Wraps |
|------|-------|
| Sidebar | `SidebarPanel` |
| Request Editor | `RequestEditor` + `ResponsePanel` together |
| Test Builder | `TestBuilderPanel` |

Each boundary shows a recovery UI (crash message + **Try again** button) instead of a white screen. `componentDidCatch` logs to console with the zone label.

### React.memo on Heavy Components

`React.memo` applied to all four heavy pure-render components:

| Component | Why memoized |
|-----------|-------------|
| `Navbar` | Re-renders only when workspace/env list changes |
| `SidebarPanel` | Large tree — avoids re-render on every response update |
| `RequestEditor` | Isolated from response state |
| `ResponsePanel` | Isolated from editor state |

### useDebounce Hook

New `useDebounce<T>(value, delay)` hook (18 lines) used to debounce URL → query-param sync. Prevents `setParams` from firing on every keystroke — only runs 300 ms after typing stops.

---

## Phase 10 — Context & Strategy Patterns

### React Context Pattern — ToastContext

Replaced prop-drilled `showToast` callback with a proper React Context.

| File | Role |
|------|------|
| `ToastContext.tsx` | `ToastProvider` with `timerRef` race guard + `useToastContext` hook |
| `page.tsx` | Wraps `<AppShell>` in `<ToastProvider>` |
| `useCollectionTree.ts` | Calls `useToastContext()` directly — no prop needed |

`useToastContext()` throws a dev-time error if used outside `<ToastProvider>`.

### Strategy Pattern — Auth Resolution

`auth-strategy.ts` replaces an if/else chain in the execute route with a strategy registry.

| Strategy | Headers produced |
|----------|-----------------|
| `none` | `{}` |
| `bearer` | `Authorization: Bearer <token>` |
| `basic` | `Authorization: Basic <base64>` |
| `api-key` | `<customHeader>: <key>` |

`resolveAuthHeaders(auth, interpolateFn)` is the public API. All strategies are variable-interpolation aware.

---

## Bug Check Rounds

Four structured audit rounds after the main phases, fixing a total of **13 bugs** in `useRequestEditor.ts`, `useCollectionTree.ts`, `useHistoryActivity.ts`, `useEnvironments.ts`, and `ToastContext.tsx`.

### Round 1 (3 bugs)

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `ToastContext.tsx` | Race condition — rapid `showToast` calls leaked multiple auto-dismiss timers | Added `timerRef` to cancel previous timer before starting new one |
| 2 | `useRequestEditor.ts` | Abort race — `catch`/`finally` ran even for aborted requests, clobbering active-tab state | Guard with `if (controller.signal.aborted) return` |
| 3 | `useRequestEditor.ts` | `showToast` missing from `handleImportFile` dependency array | Added to deps |

### Round 2 (4 bugs)

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `useHistoryActivity.ts` | Double-click on "Load more" fired duplicate pagination requests | Added `loadingMoreHistRef` / `loadingMoreActRef` guards |
| 2 | `useEnvironments.ts` | Rapid workspace switch caused stale env response to overwrite new workspace's envs | Added `stale` flag in fetch effect |
| 3 | `useHistoryActivity.ts` | Auto-load effects had race condition on workspace switch | Rewrote as inline async + stale flag per effect |
| 4 | `constants.ts` | `prepareBody` returned shared `EMPTY_BODY` reference — mutations in one tab leaked into another | Always spread: `{ ...(raw ?? EMPTY_BODY), formData: [...] }` |

### Round 3 (2 bugs)

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `useCollectionTree.ts` | `deleteFolder` called `onRequestsRemoved` for requests from ANY collection, not just the deleted folder's collection | Scoped predicate: `req.collectionId === colId && !remainingIds.has(req.id)` |
| 2 | `useCollectionTree.ts` | Collection fetch on workspace switch had no stale guard — late response could overwrite new workspace's collections | Added `stale` flag in fetch effect |

### Round 4 (4 bugs)

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `useRequestEditor.ts` | `finally { setIsSending(false) }` fired on whichever tab was active, not the originating tab — Tab B's spinner died when Tab A finished | Guarded: `activeTabIdRef.current === sendTabId` |
| 2 | `useRequestEditor.ts` | On tab switch during request, success path did early `return` — post-request script was silently skipped (env-var updates + tests lost) | Removed early return; post-script always runs with tab-aware state routing |
| 3 | `useRequestEditor.ts` | `closeTab` (all-tabs-closed branch) left `draftColId`/`draftFolderId` stale | Added `setDraftColId(null); setDraftFolderId(null)` |
| 4 | `useRequestEditor.ts` | `captureSnapshot()` hardcoded `isSending: false` — switching away from a sending tab lost the spinner state | Changed to capture actual `isSending` value |

---

## Phase 11 — Postman-Style Variable Tooltip

### Feature

When the cursor moves inside a `{{variable}}` token in the URL bar, a popup appears below showing the resolved value, its source, and a list of all variables used in the URL.

### Popup States

| State | Triggered by |
|-------|-------------|
| **Single variable view** | Cursor positioned inside `{{varName}}` |
| **Variable list view** | Clicking "Variables in request →" |
| **Dismissed** | Click/tab outside the URL input |

### Source Badges

| Badge | Color | Meaning |
|-------|-------|---------|
| `E` Environment | Blue | Value set in the active environment |
| `V` Script Variable | Purple | Set by `pm.variables.set()` in a pre/post script |
| `?` Not set | Yellow | `{{var}}` found in URL but not defined anywhere |

### Implementation

| Item | Detail |
|------|--------|
| `getVarAtCursor(text, pos)` | Regex exec loop — finds which `{{token}}` the caret is inside |
| `extractVars(text)` | Deduped list of all `{{vars}}` in the URL |
| `resolveVar(name, envVars, tempVars)` | Returns `{ value, source }` — priority: env > temp > none |
| `blurTimerRef` | 150 ms blur guard so clicking inside the popup doesn't dismiss it |
| `envVars` in AppShell | `useMemo` from active environment's enabled variables |
| `tempVars` from `useRequestEditor` | Script-set variables passed down directly |

### Files Changed

| File | Change |
|------|--------|
| `RequestEditor.tsx` | Added `getVarAtCursor`, `extractVars`, `resolveVar` helpers; URL bar replaced with wrapper + popup UI; `envVars`/`tempVars` props added (219 → 395 lines) |
| `AppShell.tsx` | Added `useMemo` import; `resolvedEnvVars` memo; `tempVars` destructured; new props wired |

---

## Performance Audit

Six targeted memoization improvements applied after Phase 11, eliminating unnecessary re-renders.

| # | Location | Problem | Fix |
|---|----------|---------|-----|
| 1 | `AppShell.tsx` | `currentEnv` recomputed on every render | `useMemo` on `environments.find(e => e.id === currentEnvId)` |
| 2 | `AppShell.tsx` | `stableSetRequestsByCol` recreated on every render | `useCallback` wrapper |
| 3 | `RequestEditor.tsx` | `activeVarInfo` recomputed on every keystroke | `useMemo` on `[activeVar, envVars, tempVars, varOverrides]` |
| 4 | `SidebarPanel.tsx` | `SIDEBAR_ITEMS` array literal re-created each render | Hoisted to module scope as a constant |
| 5 | `SidebarPanel.tsx` | `ACTION_COLORS` object literal re-created each render | Hoisted to module scope as a constant |
| 6 | `SidebarPanel.tsx` | `toggleFolder` arrow function recreated each render | Wrapped in `useCallback([], [])` |

---

## Phase 12 — Variable Override Input

### Feature

An inline input field was added to the variable tooltip popup, allowing users to type a temporary override value for any `{{variable}}` without modifying the active environment.

### How It Works

- `varOverrides: Record<string, string>` state in `useRequestEditor` — highest-priority variable source
- `setVarOverride(name, value)` callback (stable, wrapped in `useCallback`) — passing `''` removes the key
- `resolveVar` extended with a fourth `overrides` parameter; returns source `'override'` (purple **O** badge)
- Override merged **last** in `sendRequest`: `{ ...envVars, ...sessionTempVars, ...varOverrides }`
- `onFocus={cancelBlur}` added to the popup container to prevent dismissal when clicking the override input

### Source Badge Added

| Badge | Color | Meaning |
|-------|-------|---------|
| `O` Override | Purple | Inline override typed by the user in the tooltip |

### Files Changed

| File | Change |
|------|--------|
| `useRequestEditor.ts` | Added `varOverrides` state + `setVarOverride` callback; merged into `sendRequest` |
| `RequestEditor.tsx` | Extended `resolveVar` with overrides param; added override input in tooltip; `onFocus={cancelBlur}` on popup |
| `AppShell.tsx` | Threaded `varOverrides` + `setVarOverride` down to `RequestEditor` |
| `types.ts` | `TabSnapshot` now includes `varOverrides: Record<string, string>` |

---

## Bug Check Round 5

Two bugs found and fixed.

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `mongodb-history.repository.ts` / `history/route.ts` | History "Load More" always returned the same first 50 rows — `skip` parameter was defined in the interface but ignored throughout the call chain | Added `skip` param to repository interface, implementation (`.skip(n).limit(m)`), and API route query-string parsing |
| 2 | `useRequestEditor.ts` | `varOverrides` not cleared when all tabs were closed — stale overrides bled into the next blank tab | Added `setVarOverrides({})` to the all-tabs-closed branch of `closeTab` |

---

## Logic Audit

Systematic correctness review of every route and hook. Six logic issues found and fixed.

| # | Location | Logic Issue | Fix |
|---|----------|------------|-----|
| 1 | `execute/route.ts` — `buildUrl` | Double query params — the raw URL bar string (e.g. `https://api.example.com?foo=bar`) was passed directly to `new URL()`, then the params-table entries were appended again, creating duplicates | Strip inline query string from resolved URL before constructing the `URL` object; params table is the single source of truth |
| 2 | `constants.ts` — `TabFactory.fromHistory` | History tabs stored the full executed URL (with query string) in `url` and left `params: []` — with fix #1 no longer re-parsing inline query, those params would be silently lost on re-send | Parse the history URL on tab creation; set `url` to base path and populate `params` array from the query string |
| 3 | `useEnvironments.ts` — `reloadEnvironments` | After an SSE-triggered reload the `currentEnvId` was never validated against the new list — if a teammate deleted the active environment, it would remain as the selected env and resolve to empty vars silently | After reloading, compare `currentEnvId` against the new list and reset to `'none'` if it no longer exists |
| 4 | `types.ts` + `useRequestEditor.ts` + `constants.ts` | `varOverrides` was workspace-global state — switching tabs did not save/restore per-tab overrides, so an override typed in Tab A bled into every other tab | Added `varOverrides: Record<string, string>` to `TabSnapshot`; included it in `captureSnapshot`, `restoreSnapshot`, `mkBlankSnapshot`, `TabFactory.fromRequest`, and `TabFactory.fromHistory` |
| 5 | `requests/[id]/route.ts`, `requests/route.ts` (POST), `folders/[id]/route.ts`, `folders/route.ts` (POST) | Mutation routes (`GET`/`PUT`/`DELETE` on requests; `PUT`/`DELETE` on folders; `POST` for creating requests and folders) only required a valid session — they never verified the caller was a workspace member | Added `assertMember` / `assertFolderMember` helpers that look up the collection's workspace and throw `UnauthorizedError` for non-members |
| 6 | `workspaces/route.ts` — POST | No server-side workspace name validation — only the client enforced ≥ 2 chars; calling the API directly could create blank-name workspaces | Trim incoming name and throw `ValidationError` if `< 2` characters |

---

## Final File Inventory

### Dashboard Components (6 files)

| File | Lines | Purpose |
|------|-------|---------|
| `AppShell.tsx` | 330 | Orchestrator — hooks, modals, ref bridge, layout |
| `Navbar.tsx` | 164 | Top navigation bar |
| `SidebarPanel.tsx` | 419 | Left sidebar with 5 sections |
| `RequestEditor.tsx` | 395 | Request editor with tabs + variable tooltip |
| `ResponsePanel.tsx` | 140 | Response display with sub-tabs |
| `ErrorBoundary.tsx` | 75 | React class error boundary (3 zones) |

### Custom Hooks (9 files)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 7 | Barrel export |
| `useWorkspaces.ts` | 77 | Workspace CRUD |
| `useEnvironments.ts` | 70 | Environment CRUD, stale guard, SSE stale-envId reset |
| `useHistoryActivity.ts` | 105 | History + activity, pagination guards |
| `useLiveSync.ts` | 58 | SSE real-time sync |
| `useCollectionTree.ts` | 315 | Collection tree, stale guard |
| `useDebounce.ts` | 18 | Generic debounce hook |
| `useRequestEditor.ts` | 460 | Request editor state, tab snapshots, var overrides |

### Global State

| File | Lines | Purpose |
|------|-------|---------|
| `ToastContext.tsx` | 65 | React Context — global toast notifications |

### Scripting Module (4 files)

| File | Lines | Purpose |
|------|-------|---------|
| `script-sandbox.ts` | 213 | Core execution logic + pm API |
| `script-worker-pool.ts` | 200 | Singleton Worker pool (reuse workers) |
| `script-runner.ts` | 43 | Async runner — delegates to pool + fallback |
| `script-worker.ts` | 22 | Worker entry point |

### Auth Module

| File | Lines | Purpose |
|------|-------|---------|
| `auth-strategy.ts` | 80 | Strategy Pattern — auth type → HTTP headers |

### Other Dashboard Components (10 files)

| File | Purpose |
|------|---------|
| `ConfirmModal.tsx` | Destructive action confirmation |
| `RenameModal.tsx` | Rename dialog |
| `EnvEditorModal.tsx` | Environment variable editor |
| `MembersModal.tsx` | Workspace member management |
| `SaveToCollectionModal.tsx` | Save draft to collection picker |
| `TestsSidebarPanel.tsx` | E2E tests sidebar |
| `TestBuilderPanel.tsx` | Test builder dashboard panel |
| `KVEditor.tsx` | Key-value pair editor |
| `SyntaxHighlight.tsx` | JSON syntax highlighting |
| `types.ts` | Client-side type definitions |
| `constants.ts` | Shared constants + TabFactory |
| `utils.ts` | Utility functions |

### Test Builder (9 files)

| File | Purpose |
|------|---------|
| `blocks.ts` | 18 custom Blockly block definitions |
| `generator.ts` | Playwright code generator |
| `toolbox.ts` | Block categorization |
| `BlocklyEditor.tsx` | Visual editor component |
| `CodePreview.tsx` | Generated code display |
| `ResultsPanel.tsx` | Test results display |
| `TestBuilderClient.tsx` | Full page client |
| `page.tsx` | Next.js page |
| `types.ts` | Builder types |

---

## Metrics & Results

### AppShell.tsx Size Reduction

```
Phase 5 Start:   1,714 lines  ███████████████████████████████████
Round 4:         1,314 lines  ██████████████████████████
Round 5:           697 lines  ██████████████
Round 6:           326 lines  ██████▌
Current:           330 lines  ██████▌   (stable — new features added to sub-components)
                               ─────────────────────────
                               81% total reduction from original
```

### Total Issues Fixed

| Category | Count |
|----------|-------|
| High severity audit issues | 3 |
| Medium severity audit issues | 9 |
| Low severity audit issues | 10 |
| Advisory improvements | 6 |
| State/performance fixes | 5 |
| Post-refactor bug fixes (Phase 6) | 6 |
| Bug Check Round 1 | 3 |
| Bug Check Round 2 | 4 |
| Bug Check Round 3 | 2 |
| Bug Check Round 4 | 4 |
| Performance audit improvements | 6 |
| Bug Check Round 5 | 2 |
| Logic audit fixes | 6 |
| **Total** | **66** |

### Feature Surface (Phase 11 & 12)

| Feature | Description |
|---------|-------------|
| Variable tooltip | Click inside `{{var}}` in URL bar → popup with resolved value |
| Source attribution | E (Environment), V (Script Variable), O (Override), ? (Not set) badges |
| Variable list | "Variables in request →" expands all `{{vars}}` in the URL |
| Live resolution | `envVars` recomputes on active environment change; `tempVars` updates after each script run |
| Variable override | Inline input in tooltip to type a temporary value — highest priority, per-tab, cleared when tab closes |

### Security Hardening

- ✅ 6 security headers in `next.config.mjs` (X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
- ✅ Request abort on re-send (AbortController)
- ✅ Script sandboxing via Web Worker (isolated thread, 10s timeout, no DOM access)
- ✅ Environment variable secret masking
- ✅ JWT strategy with 30-day sessions
- ✅ Server-side auth + workspace-membership checks on all API routes
- ✅ Server-side input validation on all write endpoints (including workspace name length)
- ✅ Custom error classes with safe error messages (no stack traces to client)
- ✅ URL query params de-duplicated at execution time (params table is single source of truth)

### TypeScript Compliance

Every round verified with `npx tsc --noEmit` — **0 errors** across all phases.

---

*Generated from KayScope v1.1 improvement sessions, March 2026.*
