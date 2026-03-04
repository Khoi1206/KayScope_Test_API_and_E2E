'use client'

export function ConfirmModal({ title, message, onConfirm, onCancel, destructive }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; destructive?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
        <p className="text-xs text-gray-400 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 rounded-md transition">Cancel</button>
          <button onClick={onConfirm} className={`px-3 py-1.5 text-xs text-white rounded-md transition ${destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-500 hover:bg-orange-600'}`}>
            {destructive ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
