/**
 * Client-side script runner with Web Worker sandboxing.
 *
 * Scripts execute in an isolated Worker thread, providing:
 * - Separate OS-level thread (no UI blocking)
 * - No access to DOM, window, document, cookies, localStorage
 * - Automatic timeout (10 s) with worker.terminate() — infinite-loop safe
 * - Falls back to inline `new Function()` when Workers are unavailable
 *
 * Uses ScriptWorkerPool (Singleton) to reuse Worker instances across
 * sequential script executions instead of creating/terminating per call.
 */

import { executeScript } from './script-sandbox'
import type { ScriptRunContext, ScriptRunResult } from './script-sandbox'
import { ScriptWorkerPool } from './script-worker-pool'

export type { ScriptLog, TestResult, ScriptRunContext, ScriptRunResult } from './script-sandbox'

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Execute a user script in an isolated Web Worker (via the singleton pool).
 * Returns a Promise that always resolves (errors are captured in `.error`).
 */
export async function runScript(
  script: string,
  context: ScriptRunContext,
): Promise<ScriptRunResult> {
  // Workers only exist on the client
  if (typeof Worker === 'undefined') {
    return executeScript(script, context)
  }
  try {
    return await ScriptWorkerPool.getInstance().run(script, context)
  } catch {
    // Pool/Worker creation failed (CSP, bundling issue, etc.) — inline fallback
    return executeScript(script, context)
  }
}
