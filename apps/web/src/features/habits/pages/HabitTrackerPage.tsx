import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import type { Habit } from '../../../data/models/types'
import { useToast } from '../../../shared/ui/toast/toast'
import { HabitFormDialog } from '../components/HabitFormDialog'
import { HabitList } from '../components/HabitList'
import { useHabitTracker } from '../hooks/useHabitTracker'
import { useHabitsI18n } from '../habitsI18n'
import { todayDateKey } from '../model/dateKey'
import '../habits.css'

const HabitTrackerPage = () => {
  const i18n = useHabitsI18n()
  const toast = useToast()
  const {
    activeHabits,
    archivedHabits,
    completedDatesByHabit,
    createHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    completeHabit,
    undoHabit,
  } = useHabitTracker()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const today = todayDateKey()

  return (
    <section className="habits-page-design">
      <div className="habits-page-design__container">
        <motion.div
          className="habits-page-design__header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="habits-page-design__title">{i18n.title}</h1>
          <p className="habits-page-design__subtitle">{i18n.subtitle}</p>
        </motion.div>

        <motion.button
          type="button"
          onClick={() => {
            setEditingHabit(null)
            setDialogOpen(true)
          }}
          className="habits-page-design__add"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={20} />
          {i18n.addHabit}
        </motion.button>

        <AnimatePresence mode="wait">
          {activeHabits.length === 0 ? (
            <motion.div
              key="empty"
              className="habits-page-design__empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.24 }}
            >
              <motion.div
                className="habits-page-design__empty-emoji"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                🎯
              </motion.div>
              <h3>{i18n.emptyTitle}</h3>
              <p>{i18n.emptyDescription}</p>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <HabitList
                habits={activeHabits}
                completedDatesByHabit={completedDatesByHabit}
                onToggleToday={async (habit) => {
                  const completedDates = completedDatesByHabit[habit.id] ?? []
                  if (completedDates.includes(today)) {
                    await undoHabit(habit.id)
                    toast.push({ variant: 'info', message: i18n.toastUndone })
                    return
                  }
                  await completeHabit(habit)
                  toast.push({
                    variant: 'success',
                    message: i18n.toastCompleted,
                    actionLabel: i18n.undo,
                    durationMs: 6000,
                    onAction: () => {
                      void undoHabit(habit.id).then(() => {
                        toast.push({ variant: 'info', message: i18n.toastUndone })
                      })
                    },
                  })
                }}
                onToggleDate={async (habit, dateKey) => {
                  const completedDates = completedDatesByHabit[habit.id] ?? []
                  await (completedDates.includes(dateKey) ? undoHabit(habit.id, dateKey) : completeHabit(habit, undefined, dateKey))
                }}
                onArchive={async (habitId) => {
                  await archiveHabit(habitId)
                  toast.push({ variant: 'info', message: i18n.toastArchived })
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {archivedHabits.length > 0 ? (
          <section className="habits-page-design__archived">
            <h2>{i18n.archived}</h2>
            <div className="habits-page-design__archived-list">
              {archivedHabits.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  className="habits-page-design__archived-item"
                  onClick={() => {
                    void restoreHabit(habit.id).then(() => {
                      toast.push({ variant: 'success', message: i18n.toastRestored })
                    })
                  }}
                >
                  <span>{habit.icon ?? '🎯'}</span>
                  <span>{habit.title}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <HabitFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialHabit={editingHabit}
          onSubmit={async (draft) => {
            if (editingHabit) {
              await updateHabit(editingHabit.id, draft)
              return
            }
            await createHabit(draft)
          }}
        />
      </div>
    </section>
  )
}

export default HabitTrackerPage
