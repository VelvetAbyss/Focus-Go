import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import type { Habit } from '../../../data/models/types'
import { HABIT_COLORS, HABIT_ICONS, type HabitDraft } from '../model/habitSchema'
import { useHabitsI18n } from '../habitsI18n'

type HabitFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: HabitDraft) => Promise<void>
  initialHabit?: Habit | null
}

export const HabitFormDialog = ({ open, onOpenChange, onSubmit, initialHabit }: HabitFormDialogProps) => {
  const i18n = useHabitsI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedColor, setSelectedColor] = useState<string>(HABIT_COLORS[0])
  const [selectedIcon, setSelectedIcon] = useState<string>(HABIT_ICONS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initialHabit?.title ?? '')
    setDescription(initialHabit?.description ?? '')
    setSelectedColor(initialHabit?.color ?? HABIT_COLORS[0])
    setSelectedIcon(initialHabit?.icon ?? HABIT_ICONS[0])
    setError('')
  }, [initialHabit, open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError(i18n.formValidationName)
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        title: name.trim(),
        description: description.trim(),
        icon: selectedIcon,
        color: selectedColor,
        type: initialHabit?.type ?? 'boolean',
        freezesAllowed: initialHabit?.freezesAllowed ?? 1,
        target: initialHabit?.target,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="habit-dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !saving) onOpenChange(false)
          }}
        >
          <motion.div
            className="habit-dialog__panel"
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="habit-dialog__content">
              <div className="habit-dialog__header">
                <motion.h2
                  className="habit-dialog__title"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  {initialHabit ? i18n.formTitleEdit : i18n.formTitleCreate}
                </motion.h2>
                <motion.button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="habit-dialog__close"
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <X size={24} />
                </motion.button>
              </div>

              <form onSubmit={(event) => void handleSubmit(event)}>
                <motion.div className="habit-dialog__field" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
                  <label className="habit-dialog__label" htmlFor="habit-name-input">{i18n.formName}</label>
                  <input
                    id="habit-name-input"
                    type="text"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      if (error) setError('')
                    }}
                    placeholder={i18n.formNamePlaceholder}
                    className="habit-dialog__input"
                  />
                  {error ? <p className="habit-dialog__error">{error}</p> : null}
                </motion.div>

                <motion.div className="habit-dialog__field" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
                  <label className="habit-dialog__label" htmlFor="habit-description-input">{i18n.formDescription}</label>
                  <textarea
                    id="habit-description-input"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={i18n.formDescriptionPlaceholder}
                    rows={3}
                    className="habit-dialog__textarea"
                  />
                </motion.div>

                <motion.div className="habit-dialog__field" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
                  <label className="habit-dialog__label">{i18n.formIcon}</label>
                  <div className="habit-dialog__icon-grid">
                    {HABIT_ICONS.map((icon, index) => (
                      <motion.button
                        key={icon}
                        type="button"
                        onClick={() => setSelectedIcon(icon)}
                        className={`habit-dialog__icon-swatch ${selectedIcon === icon ? 'is-active' : ''}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.015, duration: 0.2 }}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {icon}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                <motion.div className="habit-dialog__field" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
                  <label className="habit-dialog__label">{i18n.formColor}</label>
                  <div className="habit-dialog__color-grid">
                    {HABIT_COLORS.map((color, index) => (
                      <motion.button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`habit-dialog__color-swatch ${selectedColor === color ? 'is-active' : ''}`}
                        style={{ backgroundColor: color }}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: selectedColor === color ? 1.1 : 1 }}
                        transition={{ delay: 0.25 + index * 0.02, duration: 0.2 }}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                      />
                    ))}
                  </div>
                </motion.div>

                <motion.div className="habit-dialog__preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.3 }}>
                  <div className="habit-dialog__preview-label">{i18n.formPreview}</div>
                  <div className="habit-dialog__preview-row">
                    <motion.span
                      className="habit-dialog__preview-icon"
                      key={selectedIcon}
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      {selectedIcon}
                    </motion.span>
                    <div>
                      <div className="habit-dialog__preview-title">{name || i18n.formName}</div>
                      <div className="habit-dialog__preview-description">{description || i18n.formDescription}</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div className="habit-dialog__actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.3 }}>
                  <motion.button type="button" onClick={() => onOpenChange(false)} className="habit-dialog__button habit-dialog__button--secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    {i18n.formCancel}
                  </motion.button>
                  <motion.button type="submit" className="habit-dialog__button habit-dialog__button--primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={saving}>
                    {initialHabit ? i18n.formSubmitSave : i18n.formSubmitCreate}
                  </motion.button>
                </motion.div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
