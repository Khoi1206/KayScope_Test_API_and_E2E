/**
 * Web Worker entry point for sandboxed script execution.
 *
 * Receives a { script, context } message, executes the script in an
 * isolated Function scope via executeScript(), and posts back the result.
 *
 * Running inside a Worker provides:
 * - Separate thread (no UI blocking)
 * - No access to DOM, window, document, cookies, localStorage
 * - Can be terminated externally on timeout (infinite-loop protection)
 */
import { executeScript } from './script-sandbox'
import type { ScriptRunContext } from './script-sandbox'

/* eslint-disable @typescript-eslint/no-explicit-any */
const workerSelf = self as any

workerSelf.onmessage = (e: MessageEvent<{ script: string; context: ScriptRunContext }>) => {
  const { script, context } = e.data
  const result = executeScript(script, context)
  workerSelf.postMessage(result)
}
