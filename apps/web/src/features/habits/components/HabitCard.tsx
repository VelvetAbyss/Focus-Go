import { useMemo, useState, type CSSProperties } from 'react'
import { Archive, ArrowDown, ArrowUp, Check, Pencil, RotateCcw, Timer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Habit } from '../../../data/models/types'
import { AppNumber } from '../../../shared/ui/AppNumber'
import { useHabitsI18n } from '../habitsI18n'

type HabitCardProps = {
  habit: Habit
  streak: number
  completed: boolean
  archived: boolean
  onComplete: (value?: number) => Promise<void>
  onArchive: () => Promise<void>
  onRestore: () => Promise<void>
  onEdit: () => void
  onMoveUp: () => Promise<void>
  onMoveDown: () => Promise<void>
}

export const HabitCard = ({
  habit,
  streak,
  completed,
  archived,
  onComplete,
  onArchive,
  onRestore,
  onEdit,
  onMoveUp,
  onMoveDown,
}: HabitCardProps) => {
  const i18n = useHabitsI18n()
  const [valueOpen, setValueOpen] = useState(false)
  const [pendingValue, setPendingValue] = useState(String(habit.target ?? 1))

  const showValueInput = habit.type !== 'boolean'
  const displayTarget = useMemo(() => {
    if (habit.type === 'boolean') return null
    if (habit.type === 'timer') return `${habit.target ?? 0} ${i18n.minutes}`
    return String(habit.target ?? 0)
  }, [habit.target, habit.type, i18n.minutes])

  return (
    <Card className={`habit-card ${completed ? 'is-completed' : ''} ${streak > 7 ? 'is-hot-streak' : ''}`} style={{ '--habit-color': habit.color } as CSSProperties}>
      <CardHeader className="habit-card__header">
        <CardTitle>{habit.title}</CardTitle>
        <div className="habit-card__meta">
          <Badge variant="outline">
            {i18n.streak}: <AppNumber value={streak} />
          </Badge>
          <Badge variant="outline">
            {i18n.freezes}: {habit.freezesAllowed}
          </Badge>
          {displayTarget ? <Badge variant="outline">{i18n.target}: {displayTarget}</Badge> : null}
        </div>
      </CardHeader>

      <CardContent>
        <div className="habit-card__content-row">
          {archived ? (
            <Button variant="outline" size="icon" aria-label={i18n.restore} onClick={() => void onRestore()}>
              <RotateCcw size={16} />
            </Button>
          ) : (
            <Button
              variant={completed ? 'secondary' : 'default'}
              size="icon"
              aria-label={i18n.complete}
              onClick={() => void onComplete()}
            >
              {habit.type === 'timer' ? <Timer size={16} /> : <Check size={16} />}
            </Button>
          )}

          {!archived && showValueInput ? (
            <Popover open={valueOpen} onOpenChange={setValueOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label={i18n.updateValue}>
                  <Pencil size={16} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="habit-card__value-popover" side="top" align="start">
                <div className="habit-card__value-form">
                  <Input
                    type="number"
                    min={1}
                    value={pendingValue}
                    onChange={(event) => setPendingValue(event.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const value = Math.max(1, Math.round(Number(pendingValue) || 1))
                      void onComplete(value)
                      setValueOpen(false)
                    }}
                  >
                    <Check size={14} />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="habit-card__footer">
        {!archived ? (
          <>
            <Button variant="ghost" size="icon" aria-label={i18n.moveUp} onClick={() => void onMoveUp()}>
              <ArrowUp size={16} />
            </Button>
            <Button variant="ghost" size="icon" aria-label={i18n.moveDown} onClick={() => void onMoveDown()}>
              <ArrowDown size={16} />
            </Button>
            <Button variant="ghost" size="icon" aria-label={i18n.edit} onClick={onEdit}>
              <Pencil size={16} />
            </Button>
            <Button variant="ghost" size="icon" aria-label={i18n.archive} onClick={() => void onArchive()}>
              <Archive size={16} />
            </Button>
          </>
        ) : null}
      </CardFooter>
    </Card>
  )
}
