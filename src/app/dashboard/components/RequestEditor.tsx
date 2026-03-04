'use client'

import { memo } from 'react'
import type {
  HttpMethod, KV, ReqBody, ReqAuth,
  RawBodyType, ScriptResult,
} from './types'
import {
  HTTP_METHODS, METHOD_COLOR, EMPTY_KV,
} from './constants'
import { KVEditor } from './KVEditor'

interface RequestEditorProps {
  /* request meta */
  reqName: string
  setReqName: (v: string) => void
  method: HttpMethod
  setMethod: (v: HttpMethod) => void
  url: string
  setUrl: (v: string) => void
  /* save */
  saveRequest: () => void
  sendRequest: () => void
  isSaving: boolean
  saveFlash: boolean
  saveError: string
  setSaveError: (v: string) => void
  isSending: boolean
  /* editor tabs */
  activeTab: 'Params' | 'Headers' | 'Body' | 'Authorization' | 'Pre-request' | 'Post-request'
  setActiveTab: (t: 'Params' | 'Headers' | 'Body' | 'Authorization' | 'Pre-request' | 'Post-request') => void
  /* params / headers */
  params: KV[]
  setParams: (v: KV[]) => void
  headers: KV[]
  setHeaders: (v: KV[]) => void
  /* body */
  body: ReqBody
  setBody: React.Dispatch<React.SetStateAction<ReqBody>>
  /* auth */
  auth: ReqAuth
  setAuth: React.Dispatch<React.SetStateAction<ReqAuth>>
  /* scripts */
  preRequestScript: string
  setPreRequestScript: (v: string) => void
  postRequestScript: string
  setPostRequestScript: (v: string) => void
  preScriptResult: ScriptResult | null
  postScriptResult: ScriptResult | null
}

export const RequestEditor = memo(function RequestEditor(props: RequestEditorProps) {
  const {
    reqName, setReqName, method, setMethod, url, setUrl,
    saveRequest, sendRequest, isSaving, saveFlash, saveError, setSaveError, isSending,
    activeTab, setActiveTab,
    params, setParams, headers, setHeaders,
    body, setBody, auth, setAuth,
    preRequestScript, setPreRequestScript, postRequestScript, setPostRequestScript,
    preScriptResult, postScriptResult,
  } = props

  return (
    <>
      {/* Request name bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 shrink-0">
        <input value={reqName} onChange={e => { setReqName(e.target.value); setSaveError('') }}
          className="flex-1 bg-transparent text-sm text-gray-200 font-medium focus:outline-none placeholder-gray-600 min-w-0" placeholder="Request name" />
        {saveError && <span className="text-xs text-red-400 shrink-0">{saveError}</span>}
        <button onClick={() => saveRequest()} disabled={isSaving}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition ${saveFlash ? 'bg-green-600 text-white' : saveError ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'} disabled:opacity-50`}>
          {saveFlash ? 'Saved!' : isSaving ? 'Saving\u2026' : 'Save'}
        </button>
      </div>

      {/* URL bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 shrink-0">
        <select value={method} onChange={e => setMethod(e.target.value as HttpMethod)}
          className={`bg-gray-800 border border-gray-700 rounded-md px-2 py-2 text-sm font-bold focus:outline-none focus:border-orange-500 ${METHOD_COLOR[method]}`}>
          {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendRequest()}
          placeholder="Enter request URL" className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono" />
        <button onClick={sendRequest} disabled={isSending || !url.trim()}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-md text-sm transition">
          {isSending ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> : 'Send'}
        </button>
      </div>

      {/* Editor tab strip */}
      <div className="flex border-b border-gray-800 px-4 shrink-0">
        {(['Params', 'Headers', 'Body', 'Authorization', 'Pre-request', 'Post-request'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition ${activeTab === tab ? 'text-orange-400 border-orange-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'Params' && <KVEditor rows={params} onChange={setParams} />}
        {activeTab === 'Headers' && <KVEditor rows={headers} onChange={setHeaders} />}

        {activeTab === 'Body' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs">
              {(['none', 'form-data', 'x-www-form-urlencoded', 'raw'] as const).map(t => (
                <label key={t} className="flex items-center gap-1 text-gray-400 cursor-pointer hover:text-gray-200">
                  <input type="radio" name="bodyType" value={t} checked={body.type === t}
                    onChange={() => setBody(b => ({ ...b, type: t, formData: b.formData?.length ? b.formData : [EMPTY_KV()] }))}
                    className="accent-orange-500" />
                  {t}
                </label>
              ))}
              {body.type === 'raw' && (
                <select value={body.rawType ?? 'json'}
                  onChange={e => setBody(b => ({ ...b, rawType: e.target.value as RawBodyType }))}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-orange-400 focus:outline-none focus:border-orange-500 ml-1">
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                  <option value="javascript">JavaScript</option>
                  <option value="html">HTML</option>
                  <option value="xml">XML</option>
                </select>
              )}
            </div>
            {body.type === 'form-data' && (
              <KVEditor rows={body.formData ?? [EMPTY_KV()]} onChange={fd => setBody(b => ({ ...b, formData: fd }))} />
            )}
            {body.type === 'x-www-form-urlencoded' && (
              <KVEditor rows={body.formData ?? [EMPTY_KV()]} onChange={fd => setBody(b => ({ ...b, formData: fd }))} />
            )}
            {body.type === 'raw' && (
              <textarea value={body.content} onChange={e => setBody(b => ({ ...b, content: e.target.value }))}
                placeholder={(body.rawType ?? 'json') === 'json' ? '{\n  "key": "value"\n}' : 'Request body'} rows={10}
                className="w-full bg-gray-900 border border-gray-700 rounded-md p-3 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-y" />
            )}
          </div>
        )}

        {activeTab === 'Authorization' && (
          <div className="space-y-4 max-w-md text-xs">
            <div>
              <label className="text-gray-400 block mb-1.5">Auth type</label>
              <select value={auth.type} onChange={e => setAuth(a => ({ ...a, type: e.target.value as ReqAuth['type'] }))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-orange-500 w-48">
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="api-key">API Key</option>
              </select>
            </div>
            {auth.type === 'bearer' && (
              <div>
                <label className="text-gray-400 block mb-1.5">Token</label>
                <input value={auth.token ?? ''} onChange={e => setAuth(a => ({ ...a, token: e.target.value }))} placeholder="Bearer token" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono" />
              </div>
            )}
            {auth.type === 'basic' && (
              <div className="space-y-2">
                <div><label className="text-gray-400 block mb-1.5">Username</label><input value={auth.username ?? ''} onChange={e => setAuth(a => ({ ...a, username: e.target.value }))} placeholder="Username" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-gray-400 block mb-1.5">Password</label><input type="password" value={auth.password ?? ''} onChange={e => setAuth(a => ({ ...a, password: e.target.value }))} placeholder="Password" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500" /></div>
              </div>
            )}
            {auth.type === 'api-key' && (
              <div className="space-y-2">
                <div><label className="text-gray-400 block mb-1.5">Header name</label><input value={auth.apiKeyHeader ?? ''} onChange={e => setAuth(a => ({ ...a, apiKeyHeader: e.target.value }))} placeholder="X-API-Key" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-gray-400 block mb-1.5">Key</label><input value={auth.apiKey ?? ''} onChange={e => setAuth(a => ({ ...a, apiKey: e.target.value }))} placeholder="API key value" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono" /></div>
              </div>
            )}
          </div>
        )}

        {/* Script editor tabs */}
        {(activeTab === 'Pre-request' || activeTab === 'Post-request') && (
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500 leading-relaxed">
              {activeTab === 'Pre-request'
                ? 'Runs before the request is sent. Use pm.environment.set() and pm.variables.set() to inject dynamic values.'
                : 'Runs after the response. Use pm.response.json(), pm.test(), and pm.environment.set() to extract and assert values.'}
            </p>
            <textarea
              value={activeTab === 'Pre-request' ? preRequestScript : postRequestScript}
              onChange={e => (activeTab === 'Pre-request' ? setPreRequestScript : setPostRequestScript)(e.target.value)}
              placeholder={activeTab === 'Pre-request'
                ? '// Pre-request script\npm.environment.set("authToken", "my-token");\npm.variables.set("timestamp", Date.now().toString());'
                : '// Post-request script\nconst data = pm.response.json();\npm.environment.set("token", data.token);\npm.test("Status is 200", () => {\n  pm.expect(pm.response.code).to.equal(200);\n});'}
              rows={10}
              spellCheck={false}
              className="w-full bg-gray-900 border border-gray-700 rounded-md p-3 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-y"
            />
            {(() => {
              const r = activeTab === 'Pre-request' ? preScriptResult : postScriptResult
              if (!r || (!r.logs.length && !r.tests.length && !r.error)) return null
              return (
                <div className="border border-gray-700/60 rounded-md overflow-hidden">
                  <div className="bg-gray-800/60 px-3 py-1.5 text-[10px] text-gray-400 font-medium uppercase tracking-wider">Script Console</div>
                  <div className="p-2 space-y-0.5 font-mono text-xs max-h-40 overflow-y-auto bg-gray-900/50">
                    {r.error && <div className="text-red-400">{'\u2716'} {r.error}</div>}
                    {r.tests.map((t, i) => (
                      <div key={i} className={t.passed ? 'text-emerald-400' : 'text-red-400'}>
                        {t.passed ? '\u2713' : '\u2716'} {t.name}{!t.passed && t.error ? ` — ${t.error}` : ''}
                      </div>
                    ))}
                    {r.logs.map((l, i) => (
                      <div key={i} className={l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-yellow-400' : 'text-gray-300'}>
                        <span className="text-gray-600 mr-1">[{l.level}]</span>{l.message}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </>
  )
})
