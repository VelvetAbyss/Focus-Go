import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'

type TaskNoteValue = {
  contentJson?: Record<string, unknown> | null
  contentMd?: string
}

type TaskNoteEditorProps = {
  value: TaskNoteValue
  onChange: (next: TaskNoteValue) => void
}

const TaskNoteEditor = ({ value, onChange }: TaskNoteEditorProps) => {
  const { t } = useI18n()
  const [draft, setDraft] = useState(value.contentMd ?? '')

  useEffect(() => {
    setDraft(value.contentMd ?? '')
  }, [value.contentMd])

  return (
    <div className="task-note-editor">
      <textarea
        aria-label="任务备注编辑器"
        className="task-note-editor__textarea min-h-[260px] w-full resize-none rounded-[18px] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] px-4 py-3 text-[13px] leading-6 text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-[color-mix(in_srgb,var(--text-primary)_25%,transparent)]"
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          onChange({ contentMd: next, contentJson: null })
        }}
        placeholder={t('tasks.drawer.detailsPlaceholder')}
        rows={10}
      />
    </div>
  )
}

export default TaskNoteEditor
