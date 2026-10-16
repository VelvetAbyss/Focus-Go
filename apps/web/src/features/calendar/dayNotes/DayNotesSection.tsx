import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import { addDayNote, editDayNote, removeDayNote, restoreDayNote, setDayNotesOnDashboard } from './useDayNotes'
import { dayNoteTone, MAX_DAY_NOTE_LENGTH, type DayNote } from './dayNotesStorage'
import './dayNotes.css'

type DayNotesSectionProps = {
  dateKey: string
  todayKey: string
  notes: DayNote[]
  showOnDashboard: boolean
}

/**
 * The selected day's notes in the calendar's day panel: slips you click to
 * rewrite, × to remove (with undo), and a pencil field where Enter adds one.
 * Notes are reminders, not tasks: no status, never in a task list.
 */
const DayNotesSection = ({ dateKey, todayKey, notes, showOnDashboard }: DayNotesSectionProps) => {
  const { t } = useI18n()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  // Enter and Escape blur the field; the blur commits unless Escape cancelled.
  const cancelEditRef = useRef(false)
  const tone = dayNoteTone(dateKey, todayKey)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (addDayNote(dateKey, draft)) setDraft('')
  }

  const remove = (note: DayNote) => {
    removeDayNote(note.id)
    toast.push({
      message: t('calendar.notes.removed'),
      actionLabel: t('calendar.notes.undo'),
      onAction: () => restoreDayNote(note),
    })
  }

  const finishEdit = (note: DayNote, value: string) => {
    setEditingId(null)
    if (value.trim()) editDayNote(note.id, value)
    else remove(note)
  }

  const handleEditKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelEditRef.current = true
      event.currentTarget.blur()
    }
  }

  return (
    <section className="day-notes" aria-label={t('calendar.notes.title')}>
      <div className="day-notes__head">
        <h3 className="calendar-side-panel__title">{t('calendar.notes.title')}</h3>
        <label className="day-notes__dashboard" title={t('calendar.notes.dashboardHint')}>
          <span>{t('calendar.notes.dashboard')}</span>
          <Switch checked={showOnDashboard} onCheckedChange={setDayNotesOnDashboard} />
        </label>
      </div>

      {notes.length > 0 ? (
        <ul key={dateKey} className="day-notes__list calendar-side-panel__list--enter" data-note-tone={tone}>
          {notes.map((note) => (
            <li key={note.id} className="day-note">
              <span className="day-note-fold" aria-hidden="true" />
              {editingId === note.id ? (
                <input
                  className="day-note__edit"
                  defaultValue={note.text}
                  maxLength={MAX_DAY_NOTE_LENGTH}
                  aria-label={t('calendar.notes.edit', { text: note.text })}
                  autoFocus
                  onKeyDown={handleEditKey}
                  onBlur={(event) => {
                    if (cancelEditRef.current) {
                      cancelEditRef.current = false
                      setEditingId(null)
                      return
                    }
                    finishEdit(note, event.currentTarget.value)
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="day-note__text"
                  aria-label={t('calendar.notes.edit', { text: note.text })}
                  onClick={() => setEditingId(note.id)}
                >
                  {note.text}
                </button>
              )}
              <button
                type="button"
                className="day-note__remove"
                aria-label={t('calendar.notes.remove', { text: note.text })}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => remove(note)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="day-notes__composer" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault()
          }}
          maxLength={MAX_DAY_NOTE_LENGTH}
          placeholder={t('calendar.notes.placeholder')}
          aria-label={t('calendar.notes.new')}
          autoComplete="off"
        />
      </form>
    </section>
  )
}

export default DayNotesSection
