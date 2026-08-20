import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Plus } from 'lucide-react'
import { PhotoProvider } from 'react-photo-view'
import { cn } from '@/lib/utils'
import type { TaskAttachment } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import TaskAttachmentImage from './TaskAttachmentImage'
import {
  TASK_ATTACHMENT_LIMIT,
  processFilesForComposer,
  type ProcessRejectReason,
} from '../application/taskAttachments'

type TaskAttachmentsSectionProps = {
  attachments: TaskAttachment[] | undefined
  onChange: (next: TaskAttachment[]) => void
}

const TaskAttachmentsSection = ({ attachments, onChange }: TaskAttachmentsSectionProps) => {
  const { t } = useI18n()
  const toast = useToast()
  const list = useMemo(() => attachments ?? [], [attachments])
  const count = list.length
  const limitReached = count >= TASK_ATTACHMENT_LIMIT
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const [hasFocus, setHasFocus] = useState(false)

  const reportRejected = useCallback(
    (rejected: Array<{ reason: ProcessRejectReason; file: File }>, truncatedByBatch: number, truncatedByTotal: number) => {
      if (rejected.some((item) => item.reason === 'invalid-mime')) {
        toast.push({ variant: 'error', title: t('tasks.attachments.title'), message: t('tasks.attachments.invalidType') })
      }
      if (rejected.some((item) => item.reason === 'too-large')) {
        toast.push({ variant: 'error', title: t('tasks.attachments.title'), message: t('tasks.attachments.tooLarge') })
      }
      if (rejected.some((item) => item.reason === 'compress-failed')) {
        toast.push({ variant: 'error', title: t('tasks.attachments.title'), message: t('tasks.attachments.compressFailed') })
      }
      if (truncatedByBatch > 0) {
        toast.push({ variant: 'info', title: t('tasks.attachments.title'), message: t('tasks.attachments.limitPerBatch') })
      }
      if (truncatedByTotal > 0) {
        toast.push({ variant: 'info', title: t('tasks.attachments.title'), message: t('tasks.attachments.limitTotal') })
      }
    },
    [t, toast],
  )

  const ingestFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || limitReached) return
      const result = await processFilesForComposer(files, count)
      if (result.added.length > 0) {
        onChange([...(list ?? []), ...result.added])
      }
      reportRejected(result.rejected, result.truncatedByBatch, result.truncatedByTotal)
    },
    [count, limitReached, list, onChange, reportRejected],
  )

  const handlePick = () => {
    if (limitReached) return
    fileInputRef.current?.click()
  }

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void ingestFiles(files)
  }

  const handleDragOver = (event: React.DragEvent) => {
    if (limitReached) return
    event.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    if (limitReached) return
    const files = Array.from(event.dataTransfer.files ?? [])
    void ingestFiles(files)
  }

  useEffect(() => {
    const node = sectionRef.current
    if (!node || !hasFocus) return
    const onPaste = (event: ClipboardEvent) => {
      if (limitReached) return
      const clipboardFiles: File[] = []
      const items = event.clipboardData?.items ?? []
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        if (item && item.kind === 'file') {
          const file = item.getAsFile()
          if (file) clipboardFiles.push(file)
        }
      }
      if (clipboardFiles.length > 0) {
        event.preventDefault()
        void ingestFiles(clipboardFiles)
      }
    }
    node.addEventListener('paste', onPaste as EventListener)
    return () => node.removeEventListener('paste', onPaste as EventListener)
  }, [hasFocus, ingestFiles, limitReached])

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      onFocus={() => setHasFocus(true)}
      onBlur={() => setHasFocus(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="task-detail-card-shell tdv2-section-enter outline-none"
      style={{ animationDelay: '30ms' }}
    >
      <div
        className={cn(
          'task-detail-card rounded-[26px] border border-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] p-5 shadow-[var(--shadow-card-lg)] transition-colors',
          isDragging && !limitReached && 'border-emerald-400/60 bg-emerald-50/40',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="task-detail-kicker">{t('tasks.attachments.title')}</p>
            <h2 className="task-detail-title mt-0.5">
              {t('tasks.attachments.title')} {count}/{TASK_ATTACHMENT_LIMIT}
            </h2>
          </div>
          {count > 0 ? (
            <button
              type="button"
              onClick={handlePick}
              disabled={limitReached}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] px-3 text-[11px] font-semibold transition-colors',
                limitReached
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:border-emerald-400/60 hover:bg-emerald-50/40 hover:text-emerald-700',
              )}
              title={limitReached ? t('tasks.attachments.limitReached') : t('tasks.attachments.addMore')}
            >
              <Plus className="h-3.5 w-3.5" />
              {limitReached ? t('tasks.attachments.limitReached') : t('tasks.attachments.addMore')}
            </button>
          ) : null}
        </div>

        {count > 0 ? (
          <PhotoProvider maskOpacity={0.85}>
            <div className="task-attachments-gallery mt-4 flex gap-3 overflow-x-auto pb-2">
              {list.map((attachment) => (
                <TaskAttachmentImage
                  key={attachment.id}
                  attachment={attachment}
                  removeLabel={t('tasks.attachments.remove')}
                  onRemove={(id) => onChange(list.filter((item) => item.id !== id))}
                />
              ))}
              {!limitReached ? (
                <button
                  type="button"
                  onClick={handlePick}
                  className="task-attachment-add flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[color-mix(in_srgb,var(--text-primary)_15%,transparent)] text-[color:var(--text-secondary)] transition-colors hover:border-emerald-400/60 hover:bg-emerald-50/40 hover:text-emerald-600"
                  aria-label={t('tasks.attachments.addMore')}
                >
                  <Plus className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </PhotoProvider>
        ) : (
          <button
            type="button"
            onClick={handlePick}
            className={cn(
              'mt-4 flex w-full items-center gap-3 rounded-[18px] border-2 border-dashed border-[color-mix(in_srgb,var(--text-primary)_15%,transparent)] bg-[color:var(--bg-muted)] px-4 py-5 text-left transition-colors',
              !limitReached && 'hover:border-emerald-400/60 hover:bg-emerald-50/40',
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--bg-elevated)] text-[color:var(--text-secondary)]">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[color:var(--text-primary)]">
                {t('tasks.attachments.dropHint')}
              </p>
              <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">
                {t('tasks.attachments.dropSubhint', { limit: TASK_ATTACHMENT_LIMIT })}
              </p>
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </section>
  )
}

export default TaskAttachmentsSection
