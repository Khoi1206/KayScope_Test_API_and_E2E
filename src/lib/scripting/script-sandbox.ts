/**
 * Core script execution logic — shared between the Web Worker and inline fallback.
 *
 * Runs untrusted JavaScript in a `new Function()` scope with only the
 * provided `pm` and `console` objects injected. No access to window,
 * document, fetch, or other globals.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ScriptLog {
  level: 'log' | 'warn' | 'error'
  message: string
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface ScriptRunContext {
  /** Flattened environment variable map (key → value). Readable and writable. */
  envVars: Record<string, string>
  /** Per-session temp variables (pm.variables). Readable and writable. */
  tempVars: Record<string, string>
  /** Available in pre-request scripts. */
  request?: {
    url: string
    method: string
    headers: Record<string, string>
  }
  /** Available in post-request scripts. */
  response?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
  }
}

export interface ScriptRunResult {
  /** Full updated env vars map to apply back to session. */
  envVars: Record<string, string>
  /** Full updated temp vars map. */
  tempVars: Record<string, string>
  logs: ScriptLog[]
  tests: TestResult[]
  /** Top-level execution error (syntax error, uncaught throw, etc.). */
  error?: string
}

// ── Minimal Chai-style expect helper ────────────────────────────────────────

function makeExpect(actual: unknown) {
  const fail = (msg: string) => { throw new Error(msg) }

  const assertions = {
    equal(expected: unknown) {
      if (actual !== expected) fail(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`)
    },
    eql(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        fail(`Expected ${JSON.stringify(actual)} to deep equal ${JSON.stringify(expected)}`)
    },
    include(value: unknown) {
      if (typeof actual === 'string') {
        if (!actual.includes(String(value))) fail(`Expected "${actual}" to include "${value}"`)
      } else if (Array.isArray(actual)) {
        if (!actual.includes(value)) fail(`Expected array to include ${JSON.stringify(value)}`)
      }
    },
    match(re: RegExp) {
      if (typeof actual !== 'string' || !re.test(actual))
        fail(`Expected "${actual}" to match ${re}`)
    },
    ok() {
      if (!actual) fail(`Expected ${JSON.stringify(actual)} to be truthy`)
    },
    below(n: number) {
      if ((actual as number) >= n) fail(`Expected ${actual} to be below ${n}`)
    },
    above(n: number) {
      if ((actual as number) <= n) fail(`Expected ${actual} to be above ${n}`)
    },
    a(type: string) {
      // eslint-disable-next-line valid-typeof
      if (typeof actual !== type) fail(`Expected ${JSON.stringify(actual)} to be a ${type}`)
    },
  }

  // Support: pm.expect(val).to.equal(200)  and  pm.expect(val).to.be.ok()  etc.
  return {
    to: {
      ...assertions,
      be: { ...assertions },
      have: {
        status(code: number) {
          const s = (actual as { status?: number })?.status
          if (s !== code) fail(`Expected status ${s} to equal ${code}`)
        },
      },
      not: {
        equal(expected: unknown) {
          if (actual === expected) fail(`Expected ${JSON.stringify(actual)} to not equal ${JSON.stringify(expected)}`)
        },
        include(value: unknown) {
          if (typeof actual === 'string' && actual.includes(String(value)))
            fail(`Expected "${actual}" to not include "${value}"`)
        },
        ok() {
          if (actual) fail(`Expected ${JSON.stringify(actual)} to be falsy`)
        },
      },
    },
  }
}

// ── Core execution ──────────────────────────────────────────────────────────

/**
 * Execute a user script synchronously inside a `new Function()` scope.
 *
 * Used directly by the Web Worker, and as a fallback when Workers are
 * unavailable (e.g. SSR, CSP restrictions).
 */
export function executeScript(script: string, context: ScriptRunContext): ScriptRunResult {
  const logs: ScriptLog[] = []
  const tests: TestResult[] = []
  // Work on copies — originals are unchanged until we return
  const envVars = { ...context.envVars }
  const tempVars = { ...context.tempVars }

  // Captured console
  const capturedConsole = {
    log: (...args: unknown[]) =>
      logs.push({ level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
    warn: (...args: unknown[]) =>
      logs.push({ level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
    error: (...args: unknown[]) =>
      logs.push({ level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
  }

  // Build pm object
  const pm = {
    environment: {
      get: (key: string): string | undefined => envVars[key],
      set: (key: string, value: unknown) => { envVars[key] = String(value) },
      unset: (key: string) => { delete envVars[key] },
      has: (key: string): boolean => key in envVars,
    },
    variables: {
      get: (key: string): string | undefined => tempVars[key],
      set: (key: string, value: unknown) => { tempVars[key] = String(value) },
      unset: (key: string) => { delete tempVars[key] },
      has: (key: string): boolean => key in tempVars,
    },
    test: (name: string, fn: () => void) => {
      try {
        fn()
        tests.push({ name, passed: true })
      } catch (e) {
        tests.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
      }
    },
    expect: makeExpect,
    // Convenience: pm.response (post-request only)
    ...(context.response
      ? {
          response: (() => {
            let _json: unknown
            const resp = context.response!
            return {
              get status() { return resp.status },
              get code() { return resp.status },
              get statusText() { return resp.statusText },
              get headers() { return resp.headers },
              json<T = unknown>(): T {
                if (_json === undefined) {
                  try { _json = JSON.parse(resp.body) }
                  catch { _json = null }
                }
                return _json as T
              },
              text: () => resp.body,
              to: { have: { status: (code: number) => { if (resp.status !== code) throw new Error(`Expected status ${resp.status} to equal ${code}`) } } },
            }
          })(),
        }
      : {}),
    // Convenience: pm.request (pre-request only)
    ...(context.request
      ? {
          request: {
            url: context.request.url,
            method: context.request.method,
            headers: context.request.headers,
          },
        }
      : {}),
  }

  try {
    // Isolated scope — only pm and console are injected, no access to outer globals
    // eslint-disable-next-line no-new-func
    const fn = new Function('pm', 'console', `"use strict";\n${script}`)
    fn(pm, capturedConsole)
  } catch (e) {
    return { envVars, tempVars, logs, tests, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
  }

  return { envVars, tempVars, logs, tests }
}
