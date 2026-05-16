import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Paperclip, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TaskAttachment } from '../../../data/models/types'
import { useToast } from '../../../shared/ui/toast/toast'
import { getDroppedImageFiles, getPastedImageFiles } from '../../../shared/util/clipboard'
import {
  TASK_ATTACHMENT_LIMIT,
  type ProcessRejectReason,
  processFilesForComposer,
} from '../application/taskAttachments'
import TaskAttachmentChip from './TaskAttachmentChip'

export type TaskAddComposerHandle = {
  focus: () => void
}

type TaskAddComposerProps = {
  onSubmit: (title: string, attachments?: TaskAttachment[]) => Promise<boolean> | boolean
  compact?: boolean
  plain?: boolean
  hero?: boolean
  placeholder?: string
}

const DISCOVERY_STORAGE_KEY = 'focusgo.composer.discovered'
const ATTRACT_DELAY_MS = 800
const ATTRACT_DURATION_MS = 3400
const CELEBRATE_MS = 540

type HeroPhase = 'idle' | 'attracting' | 'breathing' | 'discovered'

const readDiscovered = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DISCOVERY_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

const writeDiscovered = () => {
  try {
    window.localStorage.setItem(DISCOVERY_STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

const TaskAddComposer = forwardRef<TaskAddComposerHandle, TaskAddComposerProps>(function TaskAddComposer(
  { onSubmit, compact = false, plain = false, hero = false, placeholder },
  ref,
) {
  const { t } = useI18n()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [inputShaking, setInputShaking] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [phase, setPhase] = useState<HeroPhase>(hero ? 'idle' : 'discovered')
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const celebrateTimerRef = useRef<number | null>(null)
  const dragCounterRef = useRef(0)

  const attachmentsEnabled = hero

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  useEffect(() => {
    if (!hero) {
      setPhase('discovered')
      return
    }
    if (readDiscovered()) {
      setPhase('discovered')
      return
    }
    const t1 = window.setTimeout(() => setPhase('attracting'), ATTRACT_DELAY_MS)
    const t2 = window.setTimeout(() => setPhase('breathing'), ATTRACT_DELAY_MS + ATTRACT_DURATION_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [hero])

  useEffect(() => {
    return () => {
      if (celebrateTimerRef.current) window.clearTimeout(celebrateTimerRef.current)
    }
  }, [])

  const markDiscovered = () => {
    writeDiscovered()
    setPhase('discovered')
  }

  const rejectMessages = useMemo<Record<ProcessRejectReason, string>>(
    () => ({
      'invalid-mime': t('tasks.attachments.invalidType'),
      'too-large': t('tasks.attachments.tooLarge'),
      'compress-failed': t('tasks.attachments.compressFailed'),
    }),
    [t],
  )

  const ingestFiles = useCallback(
    async (files: File[]) => {
      if (!attachmentsEnabled || files.length === 0) return
      setIsProcessing(true)
      try {
        const result = await processFilesForComposer(files, attachments.length)
        if (result.added.length > 0) {
          setAttachments((prev) => [...prev, ...result.added])
        }
        if (result.truncatedByBatch > 0) {
          toast.push({ message: t('tasks.attachments.limitPerBatch'), variant: 'info' })
        }
        if (result.truncatedByTotal > 0) {
          toast.push({ message: t('tasks.attachments.limitTotal'), variant: 'info' })
        }
        const seenReasons = new Set<ProcessRejectReason>()
        for (const rejection of result.rejected) {
          if (seenReasons.has(rejection.reason)) continue
          seenReasons.add(rejection.reason)
          toast.push({ message: rejectMessages[rejection.reason], variant: 'error' })
        }
      } finally {
        setIsProcessing(false)
      }
    },
    [attachmentsEnabled, attachments.length, rejectMessages, t, toast],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLFormElement>) => {
      if (!attachmentsEnabled) return
      const files = getPastedImageFiles(event.nativeEvent)
      if (files.length === 0) return
      event.preventDefault()
      void ingestFiles(files)
    },
    [attachmentsEnabled, ingestFiles],
  )

  const handleDragEnter = (event: React.DragEvent<HTMLFormElement>) => {
    if (!attachmentsEnabled) return
    const types = event.dataTransfer?.types
    const hasFile = types && Array.from(types).includes('Files')
    if (!hasFile) return
    dragCounterRef.current += 1
    setIsDragOver(true)
  }
  const handleDragOver = (event: React.DragEvent<HTMLFormElement>) => {
    if (!attachmentsEnabled) return
    if (event.dataTransfer?.types && Array.from(event.dataTransfer.types).includes('Files')) {
      event.preventDefault()
    }
  }
  const handleDragLeave = () => {
    if (!attachmentsEnabled) return
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }
  const handleDrop = (event: React.DragEvent<HTMLFormElement>) => {
    if (!attachmentsEnabled) return
    const files = getDroppedImageFiles(event.nativeEvent)
    if (files.length === 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
      return
    }
    event.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)
    void ingestFiles(files)
  }

  const handleFilePicker = () => {
    fileInputRef.current?.click()
  }
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    void ingestFiles(files)
  }

  const handleSubmit = async () => {
    const nextTitle = title.trim()
    if (!nextTitle) {
      setInputShaking(false)
      requestAnimationFrame(() => setInputShaking(true))
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    if (isProcessing) return

    const submitAttachments = attachmentsEnabled && attachments.length > 0 ? attachments : undefined
    const didCreate = await onSubmit(nextTitle, submitAttachments)
    if (!didCreate) return

    markDiscovered()
    setTitle('')
    setAttachments([])
    if (hero) {
      setJustSubmitted(false)
      requestAnimationFrame(() => setJustSubmitted(true))
      if (celebrateTimerRef.current) window.clearTimeout(celebrateTimerRef.current)
      celebrateTimerRef.current = window.setTimeout(() => setJustSubmitted(false), CELEBRATE_MS)
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const hasText = title.trim().length > 0
  const canAddMore = attachments.length < TASK_ATTACHMENT_LIMIT

  return (
    <form
      className={cn(
        'tasks-fg__composer mt-4 rounded-[22px] border border-[#3a3733]/6 bg-transparent p-3 shadow-none backdrop-blur-none transition-all duration-300',
        compact ? 'mt-3 rounded-[18px] p-2.5' : '',
        plain && !hero ? 'mt-0 rounded-none border-x-0 border-b-0 border-t bg-transparent px-4 py-3 shadow-none backdrop-blur-none' : '',
        hero ? 'tasks-fg__composer--hero mt-0 rounded-none border-0 bg-transparent px-4 py-3 shadow-none backdrop-blur-none' : '',
        hero && phase === 'attracting' ? 'is-attracting' : '',
        hero && phase === 'breathing' ? 'is-breathing' : '',
        hero && justSubmitted ? 'just-submitted' : '',
        hero && isDragOver ? 'is-drag-over' : '',
        isFocused && !plain && !hero && 'border-slate-300/80 shadow-[0_2px_12px_rgba(58,55,51,0.06)]',
        isFocused && plain && !hero && 'border-t-primary/20 bg-transparent',
      )}
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
      onPaste={attachmentsEnabled ? handlePaste : undefined}
      onDragEnter={attachmentsEnabled ? handleDragEnter : undefined}
      onDragOver={attachmentsEnabled ? handleDragOver : undefined}
      onDragLeave={attachmentsEnabled ? handleDragLeave : undefined}
      onDrop={attachmentsEnabled ? handleDrop : undefined}
    >
      {hero ? <div className="tasks-fg__hero-shimmer" aria-hidden="true" /> : null}
      {attachmentsEnabled && attachments.length > 0 ? (
        <div className="tasks-fg__chip-strip relative z-[1] mb-2 flex gap-2 overflow-x-auto pb-1">
          {attachments.map((attachment) => (
            <TaskAttachmentChip
              key={attachment.id}
              attachment={attachment}
              onRemove={removeAttachment}
              removeLabel={t('tasks.attachments.remove')}
            />
          ))}
        </div>
      ) : null}
      {attachmentsEnabled ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
      ) : null}
      <div
        className={cn(
          'flex items-center gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/85 px-3 py-2 transition-all duration-300',
          compact ? 'rounded-[15px] px-2.5 py-2' : '',
          plain && !hero ? 'flex-1 gap-2 rounded-lg bg-transparent px-3 py-1.5' : '',
          hero ? 'flex-1 gap-3 rounded-xl border-[color:color-mix(in_srgb,var(--accent-action)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-action)_5%,white)] px-3.5 py-2.5' : '',
          isFocused && !plain && !hero && 'border-slate-300 bg-white shadow-[0_0_0_3px_rgba(148,163,184,0.15)]',
          isFocused && plain && !hero && 'border-ring/60 bg-transparent ring-2 ring-ring/15',
          isFocused && hero && 'border-[color:color-mix(in_srgb,var(--accent-action)_60%,transparent)] shadow-[0_0_0_4px_rgba(139,94,52,0.16)]',
        )}
      >
        <span
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-all duration-300',
            plain && !hero && 'h-4 w-4 rounded-none bg-transparent text-muted-foreground shadow-none',
            hero && 'tasks-fg__hero-plus h-5 w-5 rounded-none bg-transparent text-[color:var(--accent-action)] shadow-none',
            isFocused && !plain && !hero && 'bg-primary/8 text-primary shadow-none',
            isFocused && plain && !hero && 'text-primary',
          )}
          style={hero ? { transition: 'transform 320ms cubic-bezier(0.22,1,0.36,1)' } : undefined}
        >
          <Plus
            className={cn(
              'transition-transform duration-300',
              hero ? 'h-[18px] w-[18px]' : 'h-4 w-4',
              isFocused ? 'rotate-90 scale-110' : 'rotate-0',
            )}
            strokeWidth={hero ? 2.4 : 2}
          />
        </span>
        {attachmentsEnabled ? (
          <button
            type="button"
            onClick={handleFilePicker}
            disabled={!canAddMore}
            aria-label={t('tasks.attachments.pickFile')}
            title={t('tasks.attachments.pickFile')}
            className={cn(
              'tasks-fg__paperclip inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              'text-[color:color-mix(in_srgb,var(--accent-action)_70%,var(--text-secondary,#6b6357))]',
              'transition-all duration-200',
              'hover:bg-[color:color-mix(in_srgb,var(--accent-action)_12%,transparent)] hover:text-[color:var(--accent-action)] hover:scale-105',
              'active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent-action)_40%,transparent)]',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100',
            )}
            style={{ transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
          >
            <Paperclip className="h-[15px] w-[15px]" strokeWidth={2.2} />
          </button>
        ) : null}
        <input
          ref={inputRef}
          className={cn(
            'tasks-fg__input h-auto min-h-0 border-0 bg-transparent px-0 py-0 text-[13px] shadow-none outline-none placeholder:text-slate-400 focus-visible:ring-0',
            compact ? 'text-[12px]' : '',
            plain && !hero ? 'flex-1 text-sm placeholder:text-muted-foreground/60' : '',
            hero ? 'flex-1 text-[15px] font-medium placeholder:text-muted-foreground/85 placeholder:transition-colors placeholder:duration-300 caret-[color:var(--accent-action)]' : '',
            inputShaking ? 'is-shaking' : '',
          )}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onAnimationEnd={() => setInputShaking(false)}
          onFocus={() => {
            setIsFocused(true)
            if (hero) markDiscovered()
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder ?? t('modules.tasks.addPlaceholder')}
        />
        {hero ? (
          <kbd
            className={cn(
              'hidden sm:inline-flex items-center justify-center rounded border border-[color:color-mix(in_srgb,var(--accent-action)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-action)_10%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-[color:var(--accent-action)] transition-all duration-300 ease-out',
              hasText ? 'pointer-events-none opacity-0 -translate-x-1 scale-90' : 'opacity-90 translate-x-0 scale-100 hover:bg-[color:color-mix(in_srgb,var(--accent-action)_18%,transparent)] hover:scale-105',
            )}
            style={{ letterSpacing: 0, transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
            aria-label="Press N to add a task"
          >
            N
          </kbd>
        ) : null}
        <Button
          type="submit"
          className={cn(
            'tasks-fg__add-btn h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold shadow-none gap-1.5',
            'transition-all duration-300',
            compact ? 'h-7 px-2.5 text-[10px]' : '',
            plain && !hero ? 'rounded-md px-3 text-xs' : '',
            hero
              ? cn(
                  'rounded-md px-3 text-xs bg-[color:var(--accent-action)] text-white',
                  'hover:bg-[color:color-mix(in_srgb,var(--accent-action)_88%,white)] hover:shadow-[0_6px_16px_-6px_rgba(139,94,52,0.5)]',
                  'active:scale-[0.96]',
                  hasText
                    ? 'opacity-100 scale-100 shadow-[0_2px_10px_-2px_rgba(139,94,52,0.4)]'
                    : 'opacity-60 scale-[0.94] shadow-none',
                )
              : hasText
                ? 'opacity-100 translate-x-0 transition-all duration-200'
                : 'opacity-0 translate-x-2 pointer-events-none transition-all duration-200',
          )}
          style={hero ? { transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' } : undefined}
          size="sm"
          disabled={!hasText}
        >
          {t('modules.tasks.add')}
          <kbd
            className="inline-flex items-center justify-center rounded border border-current/25 bg-current/10 px-1 font-mono text-[10px] font-normal leading-none opacity-80"
            style={{ letterSpacing: 0 }}
          >
            ⏎
          </kbd>
        </Button>
      </div>
    </form>
  )
})

export default TaskAddComposer
