import { useEffect, useState } from 'react'

type TaskNoteValue = {
  contentJson?: Record<string, unknown> | null
  contentMd?: string
}

type TaskNoteEditorProps = {
  value: TaskNoteValue
  onChange: (next: TaskNoteValue) => void
}

const TaskNoteEditor = ({ value, onChange }: TaskNoteEditorProps) => {
  const [draft, setDraft] = useState(value.contentMd ?? '')

  useEffect(() => {
    setDraft(value.contentMd ?? '')
  }, [value.contentMd])

  return (
    <div className="task-note-editor">
      <textarea
        aria-label="Task note editor"
        className="task-note-editor__textarea min-h-[260px] w-full resize-none rounded-[18px] border border-[#3a3733]/8 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-700 shadow-none outline-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300"
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          onChange({ contentMd: next, contentJson: null })
        }}
        placeholder="Write task details here."
        rows={10}
      />
    </div>
  )
}

export default TaskNoteEditor
