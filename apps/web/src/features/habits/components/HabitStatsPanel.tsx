import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppNumber } from '../../../shared/ui/AppNumber'
import { useHabitsI18n } from '../habitsI18n'

type HabitStatsPanelProps = {
  activeCount: number
  longestStreak: number
  completedToday: number
}

export const HabitStatsPanel = ({ activeCount, longestStreak, completedToday }: HabitStatsPanelProps) => {
  const i18n = useHabitsI18n()

  return (
    <Card className="habit-stats-card">
      <CardHeader>
        <CardTitle>{i18n.stats}</CardTitle>
      </CardHeader>
      <CardContent className="habit-stats-card__grid">
        <div>
          <p className="muted">{i18n.activeCount}</p>
          <p className="habit-stats-card__value">
            <AppNumber value={activeCount} />
          </p>
        </div>
        <div>
          <p className="muted">{i18n.streak}</p>
          <p className="habit-stats-card__value">
            <AppNumber value={longestStreak} />
          </p>
        </div>
        <div>
          <p className="muted">{i18n.completed}</p>
          <p className="habit-stats-card__value">
            <AppNumber value={completedToday} />
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
