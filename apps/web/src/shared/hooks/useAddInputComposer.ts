import { useCallback, useRef, useState } from 'react'

type UseAddInputComposerOptions = {
  onSubmit: (value: string) => Promise<void> | void
}

export const useAddInputComposer = ({ onSubmit }: UseAddInputComposerOptions) => {
  const [value, setValue] = useState('')
  const [isShaking, setIsShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const trimmedValue = value.trim()
  const canSubmit = trimmedValue.length > 0

  const triggerShake = useCallback(() => {
    setIsShaking(false)
    requestAnimationFrame(() => setIsShaking(true))
  }, [])

  const clearShake = useCallback(() => {
    setIsShaking(false)
  }, [])

  const submit = useCallback(async () => {
    if (!canSubmit) {
      triggerShake()
      inputRef.current?.focus()
      return false
    }

    await onSubmit(trimmedValue)
    setValue('')
    requestAnimationFrame(() => inputRef.current?.focus())
    return true
  }, [canSubmit, onSubmit, trimmedValue, triggerShake])

  return {
    value,
    setValue,
    canSubmit,
    isShaking,
    clearShake,
    inputRef,
    submit,
  }
}

