import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '../../../shared/i18n/useI18n'

type CreateTaskDialogFormProps = {
  creating: boolean
  onCancel: () => void
  onCreate: (title: string) => void
}

/**
 * Owns the title field so typing does not re-render CalendarPage.
 *
 * The value used to live in CalendarPage state, which meant every keystroke
 * reconciled the whole page — including the month grid and the mini grid, each
 * mapping the full six-week range. Typing 20 characters cost ~247ms there.
 *
 * Mount this with `key={createDateKey}` so reopening for another date starts empty.
 */
export const CreateTaskDialogForm = ({ creating, onCancel, onCreate }: CreateTaskDialogFormProps) => {
  const { t } = useI18n()
  const [title, setTitle] = useState('')

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed || creating) return
    onCreate(trimmed)
  }

  return (
    <>
      <div className="calendar-dialog__panel">
        <Label htmlFor="task-title">{t('calendar.title')}</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          {t('tasks.cancel')}
        </Button>
        <Button onClick={submit} disabled={creating || !title.trim()}>
          {t('calendar.create')}
        </Button>
      </DialogFooter>
    </>
  )
}

export default CreateTaskDialogForm
