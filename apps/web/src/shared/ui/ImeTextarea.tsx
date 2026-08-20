import { useEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/**
 * Textarea that correctly handles CJK IME composition.
 * During composition (pinyin, etc.) it buffers locally and only
 * fires onChange after compositionEnd, preventing mid-composition re-renders.
 */
const ImeTextarea = ({ value, onChange, ...props }: Props) => {
  const [localValue, setLocalValue] = useState(value)
  const composingRef = useRef(false)

  useEffect(() => {
    if (!composingRef.current) {
      setLocalValue(value)
    }
  }, [value])

  return (
    <textarea
      {...props}
      value={localValue}
      onChange={(event) => {
        const val = event.target.value
        setLocalValue(val)
        if (!composingRef.current) {
          onChange(val)
        }
      }}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false
        const val = event.currentTarget.value
        setLocalValue(val)
        onChange(val)
      }}
    />
  )
}

export default ImeTextarea
