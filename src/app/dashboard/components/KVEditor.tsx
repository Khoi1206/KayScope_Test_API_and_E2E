'use client'

import type { KV } from './types'
import { EMPTY_KV } from './constants'

export function KVEditor({ rows, onChange }: { rows: KV[]; onChange: (rows: KV[]) => void }) {
  const update = (idx: number, field: keyof KV, val: string | boolean) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r))
    onChange(next)
  }
  const add = () => onChange([...rows, EMPTY_KV()])
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx))

  return (
    <div className="text-xs">
      <table className="w-full">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="w-8 pb-2" />
            <th className="text-left pb-2 font-medium">Key</th>
            <th className="text-left pb-2 pl-2 font-medium">Value</th>
            <th className="text-left pb-2 pl-2 font-medium hidden sm:table-cell">Description</th>
            <th className="w-8 pb-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800/40 group">
              <td className="py-1.5 pr-2">
                <input type="checkbox" checked={row.enabled} onChange={(e) => update(i, 'enabled', e.target.checked)} className="accent-orange-500" />
              </td>
              <td className="py-1.5">
                <input value={row.key} onChange={(e) => update(i, 'key', e.target.value)} placeholder="Key" className="w-full bg-transparent text-gray-300 placeholder-gray-600 focus:outline-none" />
              </td>
              <td className="py-1.5 pl-2">
                <input value={row.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="Value" className="w-full bg-transparent text-gray-300 placeholder-gray-600 focus:outline-none" />
              </td>
              <td className="py-1.5 pl-2 hidden sm:table-cell">
                <input value={row.description ?? ''} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Description" className="w-full bg-transparent text-gray-400 placeholder-gray-600 focus:outline-none" />
              </td>
              <td className="py-1.5 pl-1">
                <button onClick={() => remove(i)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={add} className="mt-2 flex items-center gap-1 text-gray-500 hover:text-gray-300 transition">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Add row
      </button>
    </div>
  )
}
