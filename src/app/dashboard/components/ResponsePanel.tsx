'use client'

import { memo } from 'react'
import type { ExecResponse } from './types'
import { formatBytes, statusColor, statusBg } from './utils'
import { SyntaxHighlight } from './SyntaxHighlight'

interface ResponsePanelProps {
  response: ExecResponse | null
  responseTab: 'Pretty' | 'Headers' | 'Cookies' | 'Timing' | 'Raw'
  setResponseTab: (tab: 'Pretty' | 'Headers' | 'Cookies' | 'Timing' | 'Raw') => void
  isSending: boolean
  sendError: string | null
  requestTiming: { dns: number; connect: number; tls: number; firstByte: number; download: number; total: number } | null
}

export const ResponsePanel = memo(function ResponsePanel({ response, responseTab, setResponseTab, isSending, sendError, requestTiming }: ResponsePanelProps) {
  return (
    <div className="border-t border-gray-800 flex flex-col" style={{ height: '40%', minHeight: '180px' }}>
      {/* Response header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 shrink-0">
        <span className="text-xs text-gray-500 font-medium">Response</span>
        {response && (
          <>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${statusBg(response.status)} ${statusColor(response.status)}`}>
              {response.status} {response.statusText}
            </span>
            <span className="text-xs text-gray-500">{response.durationMs}ms</span>
            <span className="text-xs text-gray-500">{formatBytes(response.size)}</span>
          </>
        )}
        {isSending && <span className="text-xs text-orange-400 animate-pulse">Sending...</span>}
        {sendError && <span className="text-xs text-red-400">{sendError}</span>}
        <div className="flex-1" />
        {response && (['Pretty', 'Headers', 'Cookies', 'Timing', 'Raw'] as const).map(t => (
          <button key={t} onClick={() => setResponseTab(t)}
            className={`text-xs px-2 py-1 rounded transition ${responseTab === t ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Response body */}
      <div className="flex-1 overflow-auto p-4">
        {/* Pretty */}
        {response && responseTab === 'Pretty' && (
          <>
            {response.body.length > 500_000 && (
              <p className="text-[10px] text-yellow-500 mb-2">Response truncated to 500KB for performance. Switch to Raw tab for full body.</p>
            )}
            <SyntaxHighlight json={response.body.length > 500_000 ? response.body.slice(0, 500_000) + '\n… (truncated)' : response.body} />
          </>
        )}

        {/* Raw */}
        {response && responseTab === 'Raw' && (
          <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all font-mono">{response.body}</pre>
        )}

        {/* Headers */}
        {response && responseTab === 'Headers' && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 font-medium">Header</th>
                <th className="text-left pb-2 pl-4 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(response.headers).map(([k, v]) => (
                <tr key={k} className="border-b border-gray-800/40">
                  <td className="py-1.5 text-purple-400 font-mono">{k}</td>
                  <td className="py-1.5 pl-4 text-gray-300 break-all font-mono">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Cookies */}
        {response && responseTab === 'Cookies' && (() => {
          const setCookieHeader = Object.entries(response.headers).find(([k]) => k.toLowerCase() === 'set-cookie')
          const cookies = setCookieHeader ? setCookieHeader[1].split(/,(?=\s*\w+=)/).map(c => {
            const parts = c.trim().split(';').map(p => p.trim())
            const [nameVal, ...attrs] = parts
            const [name, ...valParts] = nameVal.split('=')
            return { name, value: valParts.join('='), attributes: attrs }
          }) : []
          return cookies.length > 0 ? (
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 font-medium">Name</th>
                <th className="text-left pb-2 pl-4 font-medium">Value</th>
                <th className="text-left pb-2 pl-4 font-medium">Attributes</th>
              </tr></thead>
              <tbody>{cookies.map((c, i) => (
                <tr key={i} className="border-b border-gray-800/40">
                  <td className="py-1.5 text-orange-400 font-mono">{c.name}</td>
                  <td className="py-1.5 pl-4 text-gray-300 break-all font-mono">{c.value}</td>
                  <td className="py-1.5 pl-4 text-gray-500 text-[10px]">{c.attributes.join('; ')}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="text-xs text-gray-600">No cookies in the response.</p>
        })()}

        {/* Timing */}
        {response && responseTab === 'Timing' && requestTiming && (
          <div className="space-y-3 max-w-md">
            <p className="text-[10px] text-gray-500 italic">* Timing breakdown is estimated from total duration</p>
            {[
              { label: 'DNS Lookup', value: requestTiming.dns, color: 'bg-cyan-500' },
              { label: 'TCP Connect', value: requestTiming.connect, color: 'bg-blue-500' },
              { label: 'TLS Handshake', value: requestTiming.tls, color: 'bg-purple-500' },
              { label: 'First Byte (TTFB)', value: requestTiming.firstByte, color: 'bg-green-500' },
              { label: 'Download', value: requestTiming.download, color: 'bg-yellow-500' },
            ].map(t => (
              <div key={t.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{t.label}</span>
                  <span className="text-gray-300 font-mono">{t.value}ms</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${t.color} rounded-full transition-all`} style={{ width: `${Math.max(2, (t.value / requestTiming.total) * 100)}%` }} />
                </div>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-2 border-t border-gray-800">
              <span className="text-gray-300 font-medium">Total</span>
              <span className="text-orange-400 font-bold font-mono">{requestTiming.total}ms</span>
            </div>
          </div>
        )}

        {!response && !isSending && !sendError && (
          <span className="text-gray-700 text-xs">Hit Send to see the response</span>
        )}
      </div>
    </div>
  )
})
