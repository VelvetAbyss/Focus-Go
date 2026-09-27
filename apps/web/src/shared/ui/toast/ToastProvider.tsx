import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { createId } from '../../utils/ids'
import { DURATION, EASE, SPRING } from '../../motion/tokens'
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

const VARIANT_ICON = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
} satisfies Record<ToastVariant, typeof Info>

type Timer = { handle: number; remaining: number; startedAt: number }

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Record<string, Timer>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current[id]
    if (timer) {
      window.clearTimeout(timer.handle)
      delete timersRef.current[id]
    }
  }, [])

  const schedule = useCallback(
    (id: string, ms: number) => {
      timersRef.current[id] = { handle: window.setTimeout(() => dismiss(id), ms), remaining: ms, startedAt: Date.now() }
    },
    [dismiss],
  )

  const push = useCallback(
    ({ title, message, variant = 'info', durationMs = 3200, actionLabel, onAction }: ToastPushArgs) => {
      const id = createId()
      setToasts((prev) => [...prev, { id, title, message, variant, actionLabel, onAction }])
      schedule(id, durationMs)
    },
    [schedule],
  )

  // Reading a toast shouldn't race its timer: hovering the stack pauses
  // every countdown, leaving resumes them with the time they had left.
  const pauseAll = useCallback(() => {
    Object.values(timersRef.current).forEach((timer) => {
      window.clearTimeout(timer.handle)
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
    })
  }, [])

  const resumeAll = useCallback(() => {
    Object.entries(timersRef.current).forEach(([id, timer]) => schedule(id, Math.max(900, timer.remaining)))
  }, [schedule])

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => window.clearTimeout(timer.handle))
      timersRef.current = {}
    }
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-viewport"
        aria-live="polite"
        aria-relevant="additions"
        onPointerEnter={pauseAll}
        onPointerLeave={resumeAll}
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = VARIANT_ICON[toast.variant]
            return (
              <motion.div
                key={toast.id}
                layout
                className={`toast toast--${toast.variant}`}
                role="status"
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING.gentle }}
                exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: DURATION.fast, ease: EASE.accelerate } }}
                transition={{ layout: SPRING.layout }}
              >
                <Icon className="toast__icon" size={16} aria-hidden="true" />
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
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
