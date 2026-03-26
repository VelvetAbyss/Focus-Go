import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '../../../shared/i18n/useI18n'

type TaskAddComposerProps = {
  onSubmit: (title: string) => Promise<boolean> | boolean
  compact?: boolean
  plain?: boolean
  placeholder?: string
}

const TaskAddComposer = ({ onSubmit, compact = false, plain = false, placeholder }: TaskAddComposerProps) => {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [inputShaking, setInputShaking] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleSubmit = async () => {
    const nextTitle = title.trim()
    if (!nextTitle) {
      setInputShaking(false)
      requestAnimationFrame(() => setInputShaking(true))
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }

    const didCreate = await onSubmit(nextTitle)
    if (!didCreate) return

    setTitle('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <form
      className={cn(
        'tasks-fg__composer mt-4 rounded-[22px] border border-[#3a3733]/6 bg-transparent p-3 shadow-none backdrop-blur-none transition',
        compact ? 'mt-3 rounded-[18px] p-2.5' : '',
        plain ? 'mt-0 rounded-none border-x-0 border-b-0 border-t bg-transparent px-4 py-3 shadow-none backdrop-blur-none' : '',
        isFocused && !plain && 'border-slate-300/80 shadow-none',
        isFocused && plain && 'border-t-primary/20 bg-transparent shadow-[0_-2px_8px_rgba(58, 55, 51, 0.04)]',
      )}
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/85 px-3 py-2 transition',
          compact ? 'rounded-[15px] px-2.5 py-2' : '',
          plain ? 'flex-1 gap-2 rounded-lg bg-transparent px-3 py-1.5' : '',
          isFocused && !plain && 'border-slate-300 bg-white shadow-[0_0_0_3px_rgba(148,163,184,0.12)]',
          isFocused && plain && 'border-ring/60 bg-transparent ring-2 ring-ring/15',
        )}
      >
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm',
            plain && 'h-4 w-4 rounded-none bg-transparent text-muted-foreground shadow-none',
            isFocused && !plain && 'text-slate-700',
            isFocused && plain && 'text-primary',
          )}
        >
          <Plus className="h-4 w-4" />
        </span>
        <input
          ref={inputRef}
          className={cn(
            'tasks-fg__input h-auto min-h-0 border-0 bg-transparent px-0 py-0 text-[13px] shadow-none outline-none placeholder:text-slate-400 focus-visible:ring-0',
            compact ? 'text-[12px]' : '',
            plain ? 'flex-1 text-sm placeholder:text-muted-foreground/60' : '',
            inputShaking ? 'is-shaking' : '',
          )}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onAnimationEnd={() => setInputShaking(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder ?? t('modules.tasks.addPlaceholder')}
        />
        <Button
          type="submit"
          className={cn(
            'tasks-fg__add-btn h-8 rounded-full px-4 text-[11px] font-semibold shadow-none',
            compact ? 'h-7 px-3 text-[10px]' : '',
            plain ? 'shrink-0 rounded-md px-4 text-xs' : '',
          )}
          size="sm"
          disabled={title.trim().length === 0}
        >
          {t('modules.tasks.add')}
        </Button>
      </div>
    </form>
  )
}

export default TaskAddComposer
