import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskAttachment } from '../../../data/models/types'
import { useAttachmentUrl } from './useAttachmentUrl'
import { useI18n } from '../../../shared/i18n/useI18n'

type TaskAttachmentChipProps = {
  attachment: TaskAttachment
  /** Optional pre-resolved preview URL (e.g. local objectURL from a freshly pasted file before blob cache lookup). */
  previewUrl?: string | null
  onRemove?: (id: string) => void
  size?: number
  removeLabel?: string
  className?: string
}

const TaskAttachmentChip = ({
  attachment,
  previewUrl,
  onRemove,
  size = 56,
  removeLabel,
  className,
}: TaskAttachmentChipProps) => {
  const { t } = useI18n()
  const resolved = useAttachmentUrl(previewUrl ? null : attachment.hash)
  const url = previewUrl ?? resolved

  return (
    <div
      className={cn(
        'tasks-fg__chip group relative shrink-0 overflow-hidden rounded-[var(--radius-sm)] border bg-[color:color-mix(in_srgb,var(--accent-action)_4%,var(--bg-elevated))]',
        'border-[color:color-mix(in_srgb,var(--accent-action)_22%,transparent)] transition-shadow',
        'hover:shadow-[0_4px_12px_-6px_color-mix(in_srgb,var(--ink-1)_35%,transparent)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img
          src={url}
          alt={attachment.name ?? t('tasks.attachment.alt')}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[color:color-mix(in_srgb,var(--accent-action)_8%,var(--bg-elevated))]">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--accent-action)_55%,transparent)]" />
        </div>
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove(attachment.id)
          }}
          aria-label={removeLabel ?? 'Remove attachment'}
          className={cn(
            'absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white',
            'transition-all duration-200 hover:bg-black/85 hover:scale-105',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
        >
          <X className="h-3 w-3" strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  )
}

export default TaskAttachmentChip
