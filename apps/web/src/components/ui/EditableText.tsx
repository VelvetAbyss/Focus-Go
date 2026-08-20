import * as React from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

type EditableTextProps = {
  value: string
  placeholder?: string
  onCommit: (next: string) => void | Promise<void>
  multiline?: boolean
  className?: string
  textClassName?: string
  editorClassName?: string
  ariaLabel?: string
  /** If true, an empty value renders nothing in display mode (caller is expected to render fallback). */
  hideWhenEmpty?: boolean
  /** Optional: render fallback element instead of placeholder when value is empty (e.g. a different default copy). */
  emptyFallback?: React.ReactNode
  /**
   * When true, display mode shows an obvious affordance: dashed underline +
   * a pencil icon on hover + tooltip. Use for "low-discoverability" fields
   * (e.g. the Project detail "next step") where users don't realize the text
   * is editable.
   */
  hint?: boolean
  /** Custom tooltip for the hint pencil. Defaults to "Click to edit". */
  hintLabel?: string
}

export function EditableText({
  value,
  placeholder,
  onCommit,
  multiline = false,
  className,
  textClassName,
  editorClassName,
  ariaLabel,
  hideWhenEmpty = false,
  emptyFallback,
  hint = false,
  hintLabel = 'Click to edit',
}: EditableTextProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  React.useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  React.useEffect(() => {
    if (editing && inputRef.current) {
      const node = inputRef.current
      node.focus()
      node.select()
    }
  }, [editing])

  const commit = async () => {
    const next = draft
    setEditing(false)
    if (next === value) return
    try {
      await onCommit(next)
    } catch {
      setDraft(value)
    }
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'Enter') {
      if (multiline) {
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault()
          void commit()
        }
      } else {
        event.preventDefault()
        void commit()
      }
    }
  }

  if (editing) {
    const sharedProps = {
      ref: inputRef as React.Ref<never>,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: () => void commit(),
      onKeyDown: handleKey,
      placeholder,
      'aria-label': ariaLabel,
      className: cn(
        'editable-text__editor',
        'w-full resize-none bg-transparent outline-none ring-0 border-0 p-0 m-0',
        'focus-visible:outline-none focus-visible:ring-0',
        textClassName,
        editorClassName,
      ),
    }
    return (
      <span className={cn('editable-text editable-text--editing block', className)}>
        {multiline ? (
          <textarea {...(sharedProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} rows={1} />
        ) : (
          <input type="text" {...(sharedProps as React.InputHTMLAttributes<HTMLInputElement>)} />
        )}
      </span>
    )
  }

  const empty = !value || !value.trim()
  if (empty && hideWhenEmpty && !emptyFallback) {
    return (
      <span
        className={cn(
          'editable-text editable-text--display editable-text--empty',
          'cursor-text inline-block min-w-[2ch] opacity-60 hover:opacity-100',
          className,
          textClassName,
        )}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setEditing(true)
          }
        }}
      >
        {placeholder ?? ''}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'editable-text editable-text--display group/editable inline-flex items-center gap-1.5 align-baseline',
        'cursor-text rounded-sm transition-colors hover:bg-foreground/[0.04]',
        hint && 'editable-text--hint border-b border-dashed border-foreground/15 hover:border-foreground/40',
        className,
        textClassName,
      )}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      title={hint ? hintLabel : undefined}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setEditing(true)
        }
      }}
    >
      <span className="min-w-0 flex-1">
        {empty ? (emptyFallback ?? <span className="opacity-50">{placeholder}</span>) : value}
      </span>
      {hint ? (
        <Pencil
          aria-hidden
          className="h-3 w-3 shrink-0 text-foreground/35 opacity-0 transition-opacity duration-200 group-hover/editable:opacity-100"
        />
      ) : null}
    </span>
  )
}

export default EditableText
