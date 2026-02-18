import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

type DialogProps = {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  panelClassName?: string
  contentClassName?: string
}

const DIALOG_EXIT_MS = 360

const Dialog = ({ open, title, onClose, children, panelClassName, contentClassName }: DialogProps) => {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const exitTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current)
        exitTimeoutRef.current = null
      }
      const mountFrame = window.requestAnimationFrame(() => {
        setMounted(true)
        window.requestAnimationFrame(() => {
          setVisible(true)
        })
      })
      return () => window.cancelAnimationFrame(mountFrame)
    } else if (mounted) {
      const hideFrame = window.requestAnimationFrame(() => {
        setVisible(false)
      })
      exitTimeoutRef.current = window.setTimeout(() => {
        setMounted(false)
      }, DIALOG_EXIT_MS)
      return () => window.cancelAnimationFrame(hideFrame)
    }
  }, [open, mounted])

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!mounted) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const dialog = (
    <div className={`dialog ${visible ? 'dialog--visible' : ''}`}>
      <div 
        className="dialog__backdrop" 
        onClick={handleBackdropClick}
        role="presentation" 
      />
      <div 
        className={cn('dialog__panel', panelClassName)} 
        onClick={handlePanelClick}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <header className="dialog__header">
            <h2>{title}</h2>
          </header>
        )}
        <div className={cn('dialog__content', contentClassName)}>{children}</div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}

export default Dialog
