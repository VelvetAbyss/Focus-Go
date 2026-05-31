import { X } from 'lucide-react'
import { PhotoView } from 'react-photo-view'
import 'react-photo-view/dist/react-photo-view.css'
import { cn } from '@/lib/utils'
import type { TaskAttachment } from '../../../data/models/types'
import { useAttachmentUrl } from './useAttachmentUrl'

type TaskAttachmentImageProps = {
  attachment: TaskAttachment
  onRemove?: (id: string) => void
  removeLabel?: string
  className?: string
}

const TaskAttachmentImage = ({ attachment, onRemove, removeLabel, className }: TaskAttachmentImageProps) => {
  const url = useAttachmentUrl(attachment.hash)

  return (
    <div
      className={cn(
        'task-attachment-image group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border',
        'border-[color:color-mix(in_srgb,var(--accent-action)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-action)_5%,var(--bg-elevated))]',
        'transition-shadow hover:shadow-[0_6px_18px_-10px_rgba(139,94,52,0.45)]',
        className,
      )}
    >
      {url ? (
        <PhotoView src={url}>
          <img
            src={url}
            alt={attachment.name ?? '任务附件'}
            className="h-full w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
        </PhotoView>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
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
          className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-all duration-200 hover:bg-black/85 hover:scale-105 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  )
}

export default TaskAttachmentImage
