'use client'

export function ConfirmModal({ title, message, onConfirm, onCancel, destructive, confirmLabel, secondaryAction }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; destructive?: boolean
  confirmLabel?: string
  secondaryAction?: { label: string; onClick: () => void }
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-th-surface border border-th-border-soft rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-th-text mb-2">{title}</h3>
        <p className="text-xs text-th-text-3 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-th-text-3 hover:text-th-text bg-th-input rounded-md transition">Cancel</button>
          {secondaryAction && (
            <button onClick={secondaryAction.onClick} className="px-3 py-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 rounded-md transition">
              {secondaryAction.label}
            </button>
          )}
          <button onClick={onConfirm} className={`px-3 py-1.5 text-xs text-white rounded-md transition ${destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-th-input hover:bg-gray-600'}`}>
            {confirmLabel ?? (destructive ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
