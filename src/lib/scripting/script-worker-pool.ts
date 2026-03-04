/**
 * ScriptWorkerPool — Singleton Pattern
 *
 * Manages a pool of reusable Web Workers for script execution.
 * Instead of creating and terminating a Worker per script run,
 * workers are kept alive and recycled, reducing overhead for
 * rapid sequential script executions (e.g. pre + post scripts).
 *
 * Features:
 * - Lazy initialization (workers created on first use)
 * - Configurable pool size (default: 2)
 * - FIFO queue when all workers are busy
 * - Automatic timeout per task (10 s) with worker replacement
 * - Singleton access via ScriptWorkerPool.getInstance()
 * - dispose() for cleanup on app unmount
 */

import type { ScriptRunContext, ScriptRunResult } from './script-sandbox'

/** Maximum time a user script is allowed to run before the worker is killed. */
const SCRIPT_TIMEOUT_MS = 10_000

/** Maximum number of concurrent workers in the pool. */
const POOL_SIZE = 2

interface PooledWorker {
  worker: Worker
  busy: boolean
}

interface PendingTask {
  script: string
  context: ScriptRunContext
  resolve: (result: ScriptRunResult) => void
}

function makeTimeoutResult(context: ScriptRunContext): ScriptRunResult {
  return {
    envVars: { ...context.envVars },
    tempVars: { ...context.tempVars },
    logs: [],
    tests: [],
    error: 'Script execution timed out (10 s limit)',
  }
}

function makeErrorResult(context: ScriptRunContext, message: string): ScriptRunResult {
  return {
    envVars: { ...context.envVars },
    tempVars: { ...context.tempVars },
    logs: [],
    tests: [],
    error: message,
  }
}

export class ScriptWorkerPool {
  private static instance: ScriptWorkerPool | null = null

  private pool: PooledWorker[] = []
  private queue: PendingTask[] = []
  private inProgress = new Map<PooledWorker, PendingTask>()
  private disposed = false

  private constructor() {}

  /** Get the singleton instance. */
  static getInstance(): ScriptWorkerPool {
    if (!ScriptWorkerPool.instance) {
      ScriptWorkerPool.instance = new ScriptWorkerPool()
    }
    return ScriptWorkerPool.instance
  }

  /** Execute a script using a pooled worker. Queues if all workers are busy. */
  run(script: string, context: ScriptRunContext): Promise<ScriptRunResult> {
    if (this.disposed) {
      return Promise.resolve(makeErrorResult(context, 'Worker pool has been disposed'))
    }

    return new Promise<ScriptRunResult>((resolve) => {
      const idle = this.pool.find(pw => !pw.busy)
      if (idle) {
        this.executeOnWorker(idle, script, context, resolve)
      } else if (this.pool.length < POOL_SIZE) {
        const pw = this.createWorker()
        if (pw) {
          this.pool.push(pw)
          this.executeOnWorker(pw, script, context, resolve)
        } else {
          // Worker creation failed
          resolve(makeErrorResult(context, 'Failed to create script worker'))
        }
      } else {
        // All workers busy, queue the task
        this.queue.push({ script, context, resolve })
      }
    })
  }

  /** Terminate all workers and clear the queue. */
  dispose(): void {
    this.disposed = true
    for (const pw of this.pool) {
      pw.worker.terminate()
    }
    this.pool = []
    // Resolve in-progress tasks immediately
    this.inProgress.forEach((task) => {
      task.resolve(makeErrorResult(task.context, 'Worker pool disposed'))
    })
    this.inProgress.clear()
    // Resolve any queued tasks
    for (const task of this.queue) {
      task.resolve(makeErrorResult(task.context, 'Worker pool disposed'))
    }
    this.queue = []
    ScriptWorkerPool.instance = null
  }

  private createWorker(): PooledWorker | null {
    try {
      const worker = new Worker(
        new URL('./script-worker.ts', import.meta.url),
      )
      return { worker, busy: false }
    } catch {
      return null
    }
  }

  private replaceWorker(pw: PooledWorker): void {
    pw.worker.terminate()
    this.inProgress.delete(pw)
    // Don't create replacements for a disposed pool
    if (this.disposed) return
    const replacement = this.createWorker()
    if (replacement) {
      const idx = this.pool.indexOf(pw)
      if (idx !== -1) {
        this.pool[idx] = replacement
        this.drainQueue(replacement)
      }
    } else {
      // Can't create replacement — remove slot from pool
      this.pool = this.pool.filter(p => p !== pw)
    }
  }

  private executeOnWorker(
    pw: PooledWorker,
    script: string,
    context: ScriptRunContext,
    resolve: (result: ScriptRunResult) => void,
  ): void {
    pw.busy = true

    const timeout = setTimeout(() => {
      cleanup()
      resolve(makeTimeoutResult(context))
      // Replace the timed-out worker (it may be stuck in an infinite loop)
      this.replaceWorker(pw)
    }, SCRIPT_TIMEOUT_MS)

    const cleanup = () => {
      clearTimeout(timeout)
      pw.worker.onmessage = null
      pw.worker.onerror = null
    }

    pw.worker.onmessage = (e: MessageEvent<ScriptRunResult>) => {
      cleanup()
      this.inProgress.delete(pw)
      pw.busy = false
      resolve(e.data)
      this.drainQueue(pw)
    }

    pw.worker.onerror = (err) => {
      cleanup()
      resolve(makeErrorResult(context, err.message ?? 'Script worker error'))
      // Replace errored worker
      this.replaceWorker(pw)
    }

    this.inProgress.set(pw, { script, context, resolve })
    pw.worker.postMessage({ script, context })
  }

  /** If there are queued tasks and this worker is free, run the next one. */
  private drainQueue(pw: PooledWorker): void {
    if (pw.busy || this.queue.length === 0) return
    const next = this.queue.shift()!
    this.executeOnWorker(pw, next.script, next.context, next.resolve)
  }
}
