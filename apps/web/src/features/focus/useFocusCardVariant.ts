import { useCallback, useEffect, useState } from 'react'

export type FocusCardVariant = 'almanac' | 'classic'

const STORAGE_KEY = 'focusgo.focusCard.variant'
const EVENT_NAME = 'focusgo:focus-card-variant-changed'
const DEFAULT_VARIANT: FocusCardVariant = 'almanac'

const readVariant = (): FocusCardVariant => {
  if (typeof window === 'undefined') return DEFAULT_VARIANT
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'classic' || stored === 'almanac' ? stored : DEFAULT_VARIANT
}

export const useFocusCardVariant = (): [FocusCardVariant, (next: FocusCardVariant) => void] => {
  const [variant, setVariantState] = useState<FocusCardVariant>(readVariant)

  useEffect(() => {
    const onChange = () => setVariantState(readVariant())
    window.addEventListener(EVENT_NAME, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(EVENT_NAME, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const setVariant = useCallback((next: FocusCardVariant) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  }, [])

  return [variant, setVariant]
}
