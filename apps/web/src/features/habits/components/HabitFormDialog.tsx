import { useEffect, useMemo, useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Habit, HabitType } from '../../../data/models/types'
import { HABIT_COLORS, type HabitDraft } from '../model/habitSchema'
import { useHabitsI18n } from '../habitsI18n'

type HabitFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: HabitDraft) => Promise<void>
  initialHabit?: Habit | null
}

type FormState = {
  title: string
  type: HabitType
  target: string
  freezesAllowed: string
  color: string
}

const createInitialState = (habit?: Habit | null): FormState => ({
  title: habit?.title ?? '',
  type: habit?.type ?? 'boolean',
  target: habit?.target ? String(habit.target) : '1',
  freezesAllowed: String(habit?.freezesAllowed ?? 1),
  color: habit?.color ?? HABIT_COLORS[0],
})

export const HabitFormDialog = ({ open, onOpenChange, onSubmit, initialHabit }: HabitFormDialogProps) => {
  const i18n = useHabitsI18n()
  const [form, setForm] = useState<FormState>(() => createInitialState(initialHabit))
  const [errors, setErrors] = useState<{ title?: string; target?: string }>({})
  const [saving, setSaving] = useState(false)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(createInitialState(initialHabit))
    setErrors({})
  }, [initialHabit, open])

  const dirty = useMemo(() => {
    const base = createInitialState(initialHabit)
    return JSON.stringify(base) !== JSON.stringify(form)
  }, [form, initialHabit])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    if (dirty && !saving) {
      setConfirmDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  const handleSubmit = async () => {
    const nextErrors: { title?: string; target?: string } = {}
    if (!form.title.trim()) nextErrors.title = i18n.form.validationTitle
    const target = Number(form.target)
    if ((form.type === 'numeric' || form.type === 'timer') && (!Number.isFinite(target) || target < 1)) {
      nextErrors.target = i18n.form.validationTarget
    }
    setErrors(nextErrors)
    if (nextErrors.title || nextErrors.target) return

    setSaving(true)
    try {
      await onSubmit({
        title: form.title.trim(),
        type: form.type,
        color: form.color,
        target: form.type === 'boolean' ? undefined : Math.round(target),
        freezesAllowed: Math.max(0, Math.round(Number(form.freezesAllowed) || 0)),
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{initialHabit ? i18n.form.editTitle : i18n.form.createTitle}</DialogTitle>
            <DialogDescription>{i18n.subtitle}</DialogDescription>
          </DialogHeader>

          <div className="habit-form-grid">
            <div className="habit-form-grid__field">
              <Label htmlFor="habit-title">{i18n.form.title}</Label>
              <Input
                id="habit-title"
                value={form.title}
                placeholder={i18n.form.titlePlaceholder}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              {errors.title ? <p className="habit-form-grid__error">{errors.title}</p> : null}
            </div>

            <div className="habit-form-grid__field">
              <Label>{i18n.form.type}</Label>
              <Select value={form.type} onValueChange={(value: HabitType) => setForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">{i18n.form.typeBoolean}</SelectItem>
                  <SelectItem value="numeric">{i18n.form.typeNumeric}</SelectItem>
                  <SelectItem value="timer">{i18n.form.typeTimer}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type !== 'boolean' ? (
              <div className="habit-form-grid__field">
                <Label htmlFor="habit-target">{i18n.form.target}</Label>
                <Input
                  id="habit-target"
                  type="number"
                  min={1}
                  value={form.target}
                  onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}
                />
                {errors.target ? <p className="habit-form-grid__error">{errors.target}</p> : null}
              </div>
            ) : null}

            <div className="habit-form-grid__field">
              <Label htmlFor="habit-freezes">{i18n.form.freezesAllowed}</Label>
              <Input
                id="habit-freezes"
                type="number"
                min={0}
                value={form.freezesAllowed}
                onChange={(event) => setForm((prev) => ({ ...prev, freezesAllowed: event.target.value }))}
              />
            </div>

            <div className="habit-form-grid__field">
              <Label>{i18n.form.color}</Label>
              <div className="habit-color-palette" role="radiogroup" aria-label={i18n.form.color}>
                {HABIT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`habit-color-palette__swatch ${form.color === color ? 'is-active' : ''}`}
                    style={{ backgroundColor: color }}
                    aria-checked={form.color === color}
                    role="radio"
                    onClick={() => setForm((prev) => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {i18n.form.cancel}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              {i18n.form.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.form.discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>{i18n.form.discardDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.form.keepEditing}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscardOpen(false)
                onOpenChange(false)
              }}
            >
              {i18n.form.discardConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
