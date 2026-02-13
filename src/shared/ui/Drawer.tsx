import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import Button from './Button'

type DrawerProps = {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
  hideHeader?: boolean
  hideDefaultClose?: boolean
}

const DRAWER_EXIT_MS = 420

const Drawer = ({ open, title, onClose, children, actions, hideHeader, hideDefaultClose }: DrawerProps) => {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const exitTimeoutRef = useRef<number | null>(null)
  const prevBodyOverflowRef = useRef<string | null>(null)

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
      }, DRAWER_EXIT_MS)
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

  useEffect(() => {
    if (open) {
      if (prevBodyOverflowRef.current === null) {
        prevBodyOverflowRef.current = document.body.style.overflow
      }
      document.body.style.overflow = 'hidden'
      return
    }

    if (prevBodyOverflowRef.current !== null) {
      document.body.style.overflow = prevBodyOverflowRef.current
      prevBodyOverflowRef.current = null
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (prevBodyOverflowRef.current !== null) {
        document.body.style.overflow = prevBodyOverflowRef.current
        prevBodyOverflowRef.current = null
      }
    }
  }, [])

  if (!mounted) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleWheelCapture = (e: React.WheelEvent) => {
    e.stopPropagation()
  }

  const drawer = (
    <div className={`drawer ${visible ? 'drawer--visible' : ''}`}>
      <div 
        className="drawer__backdrop" 
        onClick={handleBackdropClick}
        role="presentation" 
      />
      <aside 
        className="drawer__panel" 
        onClick={handlePanelClick}
        onWheelCapture={handleWheelCapture}
        aria-hidden={false}
      >
        {!hideHeader && (
          <header className="drawer__header">
            <h2>{title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {actions}
              {!hideDefaultClose && (
                <Button className="button button--ghost" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </header>
        )}
        <div className={`drawer__content ${hideHeader ? 'drawer__content--no-header' : ''}`}>{children}</div>
      </aside>
    </div>
  )

  return createPortal(drawer, document.body)
}

export default Drawer
