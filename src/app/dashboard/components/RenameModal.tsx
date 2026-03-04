'use client'

import { useState } from 'react'

export function RenameModal({ label, currentName, onSave, onCancel, title }: {
  label: string; currentName: string; onSave: (name: string) => void; onCancel: () => void; title?: string
}) {
  const [name, setName] = useState(currentName)
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-3">{title ?? `Rename ${label}`}</h3>
        <input
          autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 rounded-md transition">Cancel</button>
          <button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()} className="px-3 py-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-md transition">Save</button>
        </div>
      </div>
    </div>
  )
}
