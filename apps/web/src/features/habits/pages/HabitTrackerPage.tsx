import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Habit } from '../../../data/models/types'
import { useMotionPreference } from '../../../shared/prefs/useMotionPreference'
import { useToast } from '../../../shared/ui/toast/toast'
import { DailyProgressRing } from '../components/DailyProgressRing'
import { HabitFormDialog } from '../components/HabitFormDialog'
import { HabitHeatmap } from '../components/HabitHeatmap'
import { HabitList } from '../components/HabitList'
import { HabitStatsPanel } from '../components/HabitStatsPanel'
import { useHabitTracker } from '../hooks/useHabitTracker'
import { useHabitsI18n } from '../habitsI18n'
import { parseDateKey } from '../model/dateKey'
import '../habits.css'

const CelebrationBurst = ({ active }: { active: boolean }) => {
  const dots = Array.from({ length: 18 }, (_, index) => index)

  return (
    <AnimatePresence>
      {active ? (
        <motion.div className="habit-celebration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {dots.map((index) => {
            const angle = (Math.PI * 2 * index) / dots.length
            const offsetX = Math.cos(angle) * (80 + (index % 3) * 24)
            const offsetY = Math.sin(angle) * (80 + (index % 4) * 20)
            return (
              <motion.span
                key={index}
                className="habit-celebration__dot"
                initial={{ x: 0, y: 0, scale: 0.5, opacity: 0.9 }}
                animate={{ x: offsetX, y: offsetY, scale: 1.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            )
          })}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const HabitTrackerPage = () => {
  const i18n = useHabitsI18n()
  const toast = useToast()
  const { reduceMotion } = useMotionPreference()
  const {
    loading,
    activeHabits,
    archivedHabits,
    streakByHabit,
    dailyProgress,
    completedHabitIds,
    heatmap,
    dateKey,
    createHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    completeHabit,
    undoHabit,
    moveHabit,
  } = useHabitTracker()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const previousPercent = useRef(0)

  const activeSorted = useMemo(() => {
    return [...activeHabits].sort((a, b) => {
      const aDone = completedHabitIds.has(a.id)
      const bDone = completedHabitIds.has(b.id)
      if (aDone !== bDone) return aDone ? 1 : -1
      return a.sortOrder - b.sortOrder
    })
  }, [activeHabits, completedHabitIds])

  const longestStreak = useMemo(() => {
    const values = Object.values(streakByHabit)
    return values.length ? Math.max(...values) : 0
  }, [streakByHabit])

  useEffect(() => {
    const nowPercent = dailyProgress.percent
    const shouldCelebrate = dailyProgress.total > 0 && nowPercent === 100 && previousPercent.current < 100
    if (shouldCelebrate) {
      toast.push({ variant: 'success', message: i18n.toast.allCompleted })
      if (!reduceMotion) {
        previousPercent.current = nowPercent
        setCelebrate(true)
        const timer = window.setTimeout(() => setCelebrate(false), 1100)
        return () => window.clearTimeout(timer)
      }
    }
    previousPercent.current = nowPercent
  }, [dailyProgress.percent, dailyProgress.total, i18n.toast.allCompleted, reduceMotion, toast])

  const formattedDate = useMemo(() => {
    return parseDateKey(dateKey).toLocaleDateString(undefined, i18n.dateFormat)
  }, [dateKey, i18n.dateFormat])

  return (
    <section className="module-page-shell habits-page">
      <CelebrationBurst active={celebrate} />

      <header className="habits-page__header">
        <div>
          <h1>{i18n.title}</h1>
          <p className="muted">{i18n.subtitle}</p>
          <p className="habits-page__date">{i18n.today}: {formattedDate}</p>
        </div>
        <Button
          size="icon"
          aria-label={i18n.addHabit}
          onClick={() => {
            setEditingHabit(null)
            setDialogOpen(true)
          }}
        >
          <Plus size={18} />
        </Button>
      </header>

      <div className="habits-page__layout">
        <div className="habits-page__main">
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">{i18n.active}</TabsTrigger>
              <TabsTrigger value="archived">{i18n.archived}</TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {loading ? <p className="muted">Loading…</p> : null}
              {!loading && activeSorted.length === 0 ? <p className="muted">{i18n.emptyActive}</p> : null}
              {!loading && activeSorted.length > 0 ? (
                <HabitList
                  habits={activeSorted}
                  completedHabitIds={completedHabitIds}
                  streakByHabit={streakByHabit}
                  archived={false}
                  onComplete={async (habit, value) => {
                    await completeHabit(habit, value)
                    toast.push({
                      variant: 'success',
                      message: i18n.toast.completed,
                      actionLabel: i18n.toast.undo,
                      durationMs: 6000,
                      onAction: () => {
                        void undoHabit(habit.id).then(() => {
                          toast.push({ variant: 'info', message: i18n.toast.undone })
                        })
                      },
                    })
                  }}
                  onArchive={async (habitId) => {
                    await archiveHabit(habitId)
                    toast.push({ variant: 'info', message: i18n.toast.archived })
                  }}
                  onRestore={async (habitId) => {
                    await restoreHabit(habitId)
                    toast.push({ variant: 'success', message: i18n.toast.restored })
                  }}
                  onEdit={(habit) => {
                    setEditingHabit(habit)
                    setDialogOpen(true)
                  }}
                  onMove={moveHabit}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="archived">
              {loading ? <p className="muted">Loading…</p> : null}
              {!loading && archivedHabits.length === 0 ? <p className="muted">{i18n.emptyArchived}</p> : null}
              {!loading && archivedHabits.length > 0 ? (
                <HabitList
                  habits={archivedHabits}
                  completedHabitIds={completedHabitIds}
                  streakByHabit={streakByHabit}
                  archived
                  onComplete={async () => {}}
                  onArchive={async () => {}}
                  onRestore={async (habitId) => {
                    await restoreHabit(habitId)
                    toast.push({ variant: 'success', message: i18n.toast.restored })
                  }}
                  onEdit={(habit) => {
                    setEditingHabit(habit)
                    setDialogOpen(true)
                  }}
                  onMove={async () => {}}
                />
              ) : null}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="habits-page__side">
          <DailyProgressRing completed={dailyProgress.completed} total={dailyProgress.total} percent={dailyProgress.percent} />
          <HabitStatsPanel activeCount={activeHabits.length} longestStreak={longestStreak} completedToday={dailyProgress.completed} />
          <HabitHeatmap points={heatmap} />
        </aside>
      </div>

      <HabitFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialHabit={editingHabit}
        onSubmit={async (draft) => {
          if (editingHabit) {
            await updateHabit(editingHabit.id, draft)
            toast.push({ variant: 'success', message: i18n.toast.updated })
            return
          }
          await createHabit(draft)
          toast.push({ variant: 'success', message: i18n.toast.created })
        }}
      />
    </section>
  )
}

export default HabitTrackerPage
