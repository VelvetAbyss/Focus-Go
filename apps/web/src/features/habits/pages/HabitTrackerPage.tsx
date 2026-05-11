import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import type { Habit } from '../../../data/models/types'
import { useToast } from '../../../shared/ui/toast/toast'
import { HabitFormDialog } from '../components/HabitFormDialog'
import { HabitList } from '../components/HabitList'
import { useHabitTracker } from '../hooks/useHabitTracker'
import { useHabitsI18n } from '../habitsI18n'
import { todayDateKey } from '../model/dateKey'
import { DiscoveryEmptyState } from '../../../shared/ui/EmptyState'
import { useI18n } from '../../../shared/i18n/useI18n'
import '../habits.css'

/* ─── Stats Panel ─────────────────────────────────────────── */
type StatsPanelProps = {
  completed: number
  total: number
  percent: number
  activeCount: number
  bestStreak: number
  weekTotal: number
}

const StatsPanel = ({ completed, total, percent, activeCount, bestStreak, weekTotal }: StatsPanelProps) => {
  const r = 28
  const cx = 36
  const cy = 36
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(percent, 100) / 100)

  return (
    <div className="hb-stats">
      {/* Today's progress ring */}
      <motion.div
        className="hb-stats__card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35 }}
      >
        <div className="hb-stats__label">今日进度</div>
        <div className="hb-stats__ring-wrap">
          <div className="hb-stats__ring-container">
            <svg className="hb-stats__ring" width="72" height="72" viewBox="0 0 72 72">
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="5.5" />
              <motion.circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="#3daa78"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            </svg>
            <div className="hb-stats__ring-pct">{percent}%</div>
          </div>
          <div>
            <div className="hb-stats__value" style={{ fontSize: 28 }}>
              {completed}
              <span className="hb-stats__value-unit">/{total}</span>
            </div>
            <div className="hb-stats__sub">习惯已完成</div>
          </div>
        </div>
      </motion.div>

      {/* Active habits */}
      <motion.div
        className="hb-stats__card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.10, duration: 0.35 }}
      >
        <div className="hb-stats__label">活跃习惯</div>
        <motion.div
          className="hb-stats__value"
          key={activeCount}
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          {activeCount}
        </motion.div>
        <div className="hb-stats__sub">正在追踪</div>
      </motion.div>

      {/* Best streak */}
      <motion.div
        className="hb-stats__card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
      >
        <div className="hb-stats__label">最长连续</div>
        <motion.div
          className="hb-stats__value"
          key={bestStreak}
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          {bestStreak}
          <span className="hb-stats__value-unit"> 天</span>
        </motion.div>
        <div className="hb-stats__sub">当前最佳连击</div>
      </motion.div>

      {/* Week total */}
      <motion.div
        className="hb-stats__card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20, duration: 0.35 }}
      >
        <div className="hb-stats__label">本周打卡</div>
        <motion.div
          className="hb-stats__value"
          key={weekTotal}
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          {weekTotal}
        </motion.div>
        <div className="hb-stats__sub">次完成</div>
      </motion.div>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────── */
const HabitTrackerPage = () => {
  const i18n = useHabitsI18n()
  const { t } = useI18n()
  const toast = useToast()
  const {
    loading,
    activeHabits,
    archivedHabits,
    completedDatesByHabit,
    streakByHabit,
    dailyProgress,
    heatmap,
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

  const bestStreak = useMemo(
    () => Math.max(0, ...Object.values(streakByHabit)),
    [streakByHabit],
  )

  const weekTotal = useMemo(
    () => heatmap.slice(-7).reduce((sum, day) => sum + day.completed, 0),
    [heatmap],
  )

  return (
    <section className="habits-page-design">
      <div className="habits-page-design__container">

        {/* Header */}
        <motion.div
          className="hb-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <p className="hb-header__eyebrow">习惯系统</p>
            <h1 className="hb-header__title">{i18n.title}</h1>
            <p className="hb-header__subtitle">{i18n.subtitle}</p>
          </div>
          <motion.button
            type="button"
            onClick={() => {
              setEditingHabit(null)
              setDialogOpen(true)
            }}
            className="hb-header__add"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <Plus size={18} />
            {i18n.addHabit}
          </motion.button>
        </motion.div>

        {/* Stats Panel */}
        {!loading && (
          <StatsPanel
            completed={dailyProgress.completed}
            total={dailyProgress.total}
            percent={dailyProgress.percent}
            activeCount={activeHabits.length}
            bestStreak={bestStreak}
            weekTotal={weekTotal}
          />
        )}

        {/* Habit Grid */}
        {loading ? (
          <div className="habits-page-design__empty">
            <p>{i18n.subtitle}</p>
          </div>
        ) : (
          <>
            {activeHabits.length === 0 ? (
              <DiscoveryEmptyState
                variant="first-time"
                title={i18n.emptyTitle}
                body={i18n.emptyDescription}
                relatedFeature={{ label: t('emptyState.habits.related') }}
              />
            ) : (
              <HabitList
                habits={activeHabits}
                completedDatesByHabit={completedDatesByHabit}
                streakByHabit={streakByHabit}
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
                  await (completedDates.includes(dateKey)
                    ? undoHabit(habit.id, dateKey)
                    : completeHabit(habit, undefined, dateKey))
                }}
                onArchive={async (habitId) => {
                  await archiveHabit(habitId)
                  toast.push({ variant: 'info', message: i18n.toastArchived })
                }}
              />
            )}
          </>
        )}

        {/* Archived */}
        {archivedHabits.length > 0 ? (
          <section className="habits-page-design__archived">
            <h2>{i18n.archived}</h2>
            <div className="habits-page-design__archived-list">
              {archivedHabits.map((habit) => (
                <motion.button
                  key={habit.id}
                  type="button"
                  className="habits-page-design__archived-item"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    void restoreHabit(habit.id).then(() => {
                      toast.push({ variant: 'success', message: i18n.toastRestored })
                    })
                  }}
                >
                  <span>{habit.icon ?? '🎯'}</span>
                  <span>{habit.title}</span>
                </motion.button>
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
