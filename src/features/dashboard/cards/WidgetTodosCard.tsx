import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Card from '../../../shared/ui/Card'
import Button from '../../../shared/ui/Button'
import { Trash2 } from 'lucide-react'
import { widgetTodoRepo } from '../../../data/repositories/widgetTodoRepo'
import type { WidgetTodo, WidgetTodoScope } from '../../../data/models/types'
import { useAddInputComposer } from '../../../shared/hooks/useAddInputComposer'
import AnimatedScrollList from '../../../shared/ui/AnimatedScrollList'
import { triggerTabGroupSwitchAnimation, triggerTabPressAnimation } from '../../../shared/ui/tabPressAnimation'

const scopes: { key: WidgetTodoScope; label: string }[] = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
]

const WidgetTodosCard = () => {
  const [items, setItems] = useState<WidgetTodo[]>([])
  const [activeScope, setActiveScope] = useState<WidgetTodoScope>('day')
  const [lastAdded, setLastAdded] = useState<{ id: string; scope: WidgetTodoScope } | null>(null)
  const [sortAnchorTime, setSortAnchorTime] = useState(0)

  const listRefs = useRef<Record<WidgetTodoScope, HTMLDivElement | null>>({
    day: null,
    week: null,
    month: null,
  })

  useEffect(() => {
    widgetTodoRepo.list().then((loaded) => {
      setItems(loaded)
      const anchor = loaded.reduce((max, item) => (item.updatedAt > max ? item.updatedAt : max), 0)
      setSortAnchorTime(anchor)
    })
  }, [])

  const scopeItems = useMemo(
    () => items.filter((item) => item.scope === activeScope),
    [items, activeScope]
  )

  const activeIndex = useMemo(() => {
    const next = scopes.findIndex((scope) => scope.key === activeScope)
    return next < 0 ? 0 : next
  }, [activeScope])
  const tabMotionStyle = useMemo(
    () =>
      ({
        '--tab-count': `${scopes.length}`,
        '--tab-active-index': `${activeIndex}`,
      }) as CSSProperties,
    [activeIndex]
  )

  const completionLabel = useMemo(() => {
    const total = scopeItems.length
    if (total === 0) return '— completed'
    const done = scopeItems.reduce((acc, item) => acc + (item.done ? 1 : 0), 0)
    return `${done} / ${total} completed`
  }, [scopeItems])

  const orderedItemsByScope = useMemo(() => {
    const toTimestamp = (todo: WidgetTodo) => {
      if (todo.dueDate) {
        const match = todo.dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (match) {
          const year = Number(match[1])
          const month = Number(match[2]) - 1
          const day = Number(match[3])
          return new Date(year, month, day).getTime()
        }
        const parsed = Date.parse(todo.dueDate)
        if (!Number.isNaN(parsed)) return parsed
      }
      return todo.createdAt
    }

    const now = sortAnchorTime
    const buildList = (scope: WidgetTodoScope) => {
      const base = items.filter((item) => item.scope === scope)
      const sorted = base.slice().sort((a, b) => {
        const ta = toTimestamp(a)
        const tb = toTimestamp(b)

        if (now === 0) return tb - ta

        return Math.abs(ta - now) - Math.abs(tb - now) || b.createdAt - a.createdAt
      })

      if (lastAdded?.scope !== scope) return sorted
      const index = sorted.findIndex((item) => item.id === lastAdded.id)
      if (index <= 0) return sorted
      const [picked] = sorted.splice(index, 1)
      sorted.unshift(picked)
      return sorted
    }

    return {
      day: buildList('day'),
      week: buildList('week'),
      month: buildList('month'),
    }
  }, [items, lastAdded, sortAnchorTime])

  const handleToggle = async (todo: WidgetTodo, done: boolean) => {
    const updated = await widgetTodoRepo.update({ ...todo, done })
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setSortAnchorTime(updated.updatedAt)
  }

  const handleDelete = async (todo: WidgetTodo) => {
    await widgetTodoRepo.remove(todo.id)
    setItems((prev) => prev.filter((item) => item.id !== todo.id))
  }

  const { inputRef, isShaking, value, setValue, clearShake, canSubmit, submit } = useAddInputComposer({
    onSubmit: async (title) => {
      const added = await widgetTodoRepo.add({
        scope: activeScope,
        title,
        priority: 'medium',
        done: false,
      })

      setItems((prev) => [added, ...prev])
      setLastAdded({ id: added.id, scope: added.scope })
      setSortAnchorTime(added.updatedAt)
      requestAnimationFrame(() => {
        const listEl = listRefs.current[activeScope]
        if (listEl) listEl.scrollTo({ top: 0, behavior: 'auto' })
      })
    },
  })

  return (
    <Card
      title="To-do List"
      eyebrow="WIDGET"
      actions={<span className="widget-todos__completed">{completionLabel}</span>}
    >
      <div className="widget-todos-card">
        <div className="widget-todos__tabs tab-motion-group" role="tablist" aria-label="Todo scope" style={tabMotionStyle}>
          {scopes.map((scope) => (
            <button
              key={scope.key}
              type="button"
              role="tab"
              aria-selected={activeScope === scope.key}
              className={`widget-todos__tab tab-motion-tab ${activeScope === scope.key ? 'is-active' : ''}`}
              onClick={(event) => {
                triggerTabPressAnimation(event.currentTarget)
                triggerTabGroupSwitchAnimation(event.currentTarget)
                setActiveScope(scope.key)
              }}
            >
              {scope.label}
            </button>
          ))}
        </div>

        <div className="widget-todos__viewport" aria-label="Todo lists">
          <div className="widget-todos__track" style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}>
            {scopes.map((scope) => {
              const rows = orderedItemsByScope[scope.key]
              return (
                <div
                  key={scope.key}
                  className="widget-todos__panel"
                  role="tabpanel"
                  aria-label={`${scope.label} todos`}
                >
                  <AnimatedScrollList
                    items={rows}
                    getKey={(item) => item.id}
                    showGradients
                    itemDelay={0.1}
                    className="widget-todos__list-wrap"
                    listClassName="widget-todos__list"
                    setListRef={(node) => {
                      listRefs.current[scope.key] = node
                    }}
                    renderItem={(item) => (
                      <label className={`widget-todos__item ${item.done ? 'is-done' : ''}`}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={(event) => void handleToggle(item, event.target.checked)}
                        />
                        <span className="widget-todos__title">{item.title}</span>
                        <button
                          type="button"
                          className="widget-todos__delete"
                          aria-label="Delete task"
                          title="Delete task"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void handleDelete(item)
                          }}
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </label>
                    )}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <form
          className="widget-todos__composer"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input
            ref={inputRef}
            className={`widget-todos__input ${isShaking ? 'is-shaking' : ''}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onAnimationEnd={clearShake}
            placeholder="Add a new task..."
          />
          <Button type="submit" className="button widget-todos__add-btn" disabled={!canSubmit}>
            Add
          </Button>
        </form>
      </div>
    </Card>
  )
}

export default WidgetTodosCard
