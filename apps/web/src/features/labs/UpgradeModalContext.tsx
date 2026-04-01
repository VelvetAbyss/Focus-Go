/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react'

type UpgradeModalContextValue = {
  open: boolean
  lockedFeature: string | undefined
  openModal: (lockedFeature?: string) => void
  closeModal: () => void
}

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null)

export const UpgradeModalProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false)
  const [lockedFeature, setLockedFeature] = useState<string | undefined>()

  const openModal = (feature?: string) => {
    setLockedFeature(feature)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setLockedFeature(undefined)
  }

  return (
    <UpgradeModalContext.Provider value={{ open, lockedFeature, openModal, closeModal }}>
      {children}
    </UpgradeModalContext.Provider>
  )
}

export const useUpgradeModal = () => {
  const ctx = useContext(UpgradeModalContext)
  if (!ctx) throw new Error('useUpgradeModal must be used within UpgradeModalProvider')
  return ctx
}
