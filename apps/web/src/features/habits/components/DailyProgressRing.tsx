import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AppNumber } from '../../../shared/ui/AppNumber'
import { useHabitsI18n } from '../habitsI18n'

type DailyProgressRingProps = {
  completed: number
  total: number
  percent: number
}

export const DailyProgressRing = ({ completed, total, percent }: DailyProgressRingProps) => {
  const i18n = useHabitsI18n()

  return (
    <Card className="habit-progress-card">
      <CardHeader>
        <CardTitle>{i18n.progress}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="habit-progress-card__stats">
          <AppNumber value={percent} suffix="%" className="habit-progress-card__percent" />
          <p className="muted">
            {completed} / {total} {i18n.completed}
          </p>
        </div>
        <Progress value={percent} aria-label={`${i18n.progress} ${percent}%`} />
      </CardContent>
    </Card>
  )
}
