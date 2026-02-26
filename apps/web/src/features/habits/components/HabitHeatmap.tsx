import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useHabitsI18n } from '../habitsI18n'

type HabitHeatmapProps = {
  points: Array<{ dateKey: string; completed: number; total: number }>
}

const levelClass = (completed: number, total: number) => {
  if (total <= 0 || completed <= 0) return 'is-level-0'
  const ratio = completed / total
  if (ratio >= 1) return 'is-level-4'
  if (ratio >= 0.75) return 'is-level-3'
  if (ratio >= 0.5) return 'is-level-2'
  return 'is-level-1'
}

export const HabitHeatmap = ({ points }: HabitHeatmapProps) => {
  const i18n = useHabitsI18n()

  return (
    <Card className="habit-heatmap-card">
      <CardHeader>
        <CardTitle>{i18n.heatmap}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="habit-heatmap-grid" aria-label="habit heatmap">
          {points.map((point) => (
            <div
              key={point.dateKey}
              className={`habit-heatmap-grid__cell ${levelClass(point.completed, point.total)}`}
              title={`${point.dateKey}: ${point.completed}/${point.total} ${i18n.completed}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
