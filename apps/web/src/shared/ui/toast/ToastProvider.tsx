import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createId } from '../../utils/ids'
import type { ToastPushArgs, ToastVariant } from './toast'
import { ToastContext } from './toast'

type ToastItem = {
  id: string
  title?: string
  message: string
  variant: ToastVariant
  actionLabel?: string
  onAction?: () => void
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timeoutsRef = useRef<Record<string, number>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timeout = timeoutsRef.current[id]
    if (timeout) {
      window.clearTimeout(timeout)
      delete timeoutsRef.current[id]
    }
  }, [])

  const push = useCallback(
    ({ title, message, variant = 'info', durationMs = 3200, actionLabel, onAction }: ToastPushArgs) => {
      const id = createId()
      setToasts((prev) => [...prev, { id, title, message, variant, actionLabel, onAction }])
      timeoutsRef.current[id] = window.setTimeout(() => dismiss(id), durationMs)
    },
    [dismiss],
  )

  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach((timeout) => window.clearTimeout(timeout))
      timeoutsRef.current = {}
    }
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.variant}`} role="status">
            <div className="toast__body">
              {toast.title ? <div className="toast__title">{toast.title}</div> : null}
              <div className="toast__message">{toast.message}</div>
              {toast.actionLabel && toast.onAction ? (
                <button
                  type="button"
                  className="toast__action button button--ghost"
                  onClick={() => {
                    toast.onAction?.()
                    dismiss(toast.id)
                  }}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
            <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
