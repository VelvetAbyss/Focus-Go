import { createContext, useContext } from 'react'

export type ToastVariant = 'info' | 'success' | 'error'

export type ToastPushArgs = {
  title?: string
  message: string
  variant?: ToastVariant
  durationMs?: number
  actionLabel?: string
  onAction?: () => void
}

export type ToastContextValue = {
  push: (args: ToastPushArgs) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
