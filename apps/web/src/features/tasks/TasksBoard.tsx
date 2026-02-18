import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import type { TaskItem, TaskStatus, TaskPriority } from './tasks.types'
import TaskDrawer from './TaskDrawer'
import Button from '../../shared/ui/Button'
import Card from '../../shared/ui/Card'
import Dialog from '../../shared/ui/Dialog'
import Select from '../../shared/ui/Select'
import { AppNumber } from '../../shared/ui/AppNumber'
import TaskCard from './components/TaskCard'
import AnimatedScrollList from '../../shared/ui/AnimatedScrollList'
import { triggerTabGroupSwitchAnimation, triggerTabPressAnimation } from '../../shared/ui/tabPressAnimation'
import TaskCalendarWidget from './components/TaskCalendarWidget'
import { useToast } from '../../shared/ui/toast/toast'
const tabs: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
]

type SortMode = 'importance' | 'time'
type TagFilterMode = 'all' | 'work' | 'life' | 'health' | 'study' | 'finance' | 'family'
type TasksViewMode = 'kanban' | 'calendar'

const STORAGE_TAB_KEY = 'tasks_active_tab'
const STORAGE_SORT_KEY = 'tasks_sort_mode'
const STORAGE_TAGS_MIGRATION_KEY = 'tasks_tags_select_v2_migrated'

const priorityOrder: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const sortByImportance = (a: TaskItem, b: TaskItem) => {
  const pa = a.priority ? priorityOrder[a.priority] : Number.POSITIVE_INFINITY
  const pb = b.priority ? priorityOrder[b.priority] : Number.POSITIVE_INFINITY
  if (pa !== pb) return pa - pb
  return b.createdAt - a.createdAt
}

const sortByTime = (a: TaskItem, b: TaskItem) => b.createdAt - a.createdAt
const tagFilterOptions: { value: TagFilterMode; label: string }[] = [
  { value: 'all', label: 'All tags' },
  { value: 'work', label: 'Work' },
  { value: 'life', label: 'Life' },
  { value: 'health', label: 'Health' },
  { value: 'study', label: 'Study' },
  { value: 'finance', label: 'Finance' },
  { value: 'family', label: 'Family' },
]

const getNextStatus = (status: TaskStatus) => {
  if (status === 'todo') return { next: 'doing' as const, label: 'Start' }
  if (status === 'doing') return { next: 'done' as const, label: 'Done' }
  return { next: 'todo' as const, label: 'Reopen' }
}

const TasksBoard = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null)

  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'importance'
    const stored = window.localStorage.getItem(STORAGE_SORT_KEY)
    if (stored === 'time' || stored === 'importance') return stored
    return 'importance'
  })
  const [tagFilter, setTagFilter] = useState<TagFilterMode>('all')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskInputShaking, setNewTaskInputShaking] = useState(false)
  const [viewMode, setViewMode] = useState<TasksViewMode>('kanban')
  const [progressComposerTaskId, setProgressComposerTaskId] = useState<string | null>(null)
  const [progressComposerValue, setProgressComposerValue] = useState('')
  const [progressSavingTaskId, setProgressSavingTaskId] = useState<string | null>(null)
  const toast = useToast()

  const [activeStatus, setActiveStatus] = useState<TaskStatus>(() => {
    if (typeof window === 'undefined') return 'todo'
    const stored = window.localStorage.getItem(STORAGE_TAB_KEY)
    return stored === 'todo' || stored === 'doing' || stored === 'done' ? stored : 'todo'
  })

  const listRefs = useRef<Record<TaskStatus, HTMLDivElement | null>>({
    todo: null,
    doing: null,
    done: null,
  })
  const newTaskInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const load = async () => {
      if (typeof window !== 'undefined' && !window.localStorage.getItem(STORAGE_TAGS_MIGRATION_KEY)) {
        await tasksRepo.clearAllTags()
        window.localStorage.setItem(STORAGE_TAGS_MIGRATION_KEY, '1')
      }
      const items = await tasksRepo.list()
      setTasks(items)
    }
    void load()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_TAB_KEY, activeStatus)
  }, [activeStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_SORT_KEY, sortMode)
  }, [sortMode])

  useEffect(() => {
    const el = listRefs.current[activeStatus]
    if (el) el.scrollTop = 0
  }, [activeStatus])

  useEffect(() => {
    setProgressComposerTaskId(null)
    setProgressComposerValue('')
  }, [activeStatus, viewMode])

  const handleDeleteTask = async (task: TaskItem) => {
    await tasksRepo.remove(task.id)
    setTasks((prev) => prev.filter((item) => item.id !== task.id))
    if (activeTask?.id === task.id) setActiveTask(null)
  }

  const requestDelete = (task: TaskItem) => setDeleteTarget(task)
  const cancelDelete = () => setDeleteTarget(null)
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setActiveTask(null)
    await handleDeleteTask(deleteTarget)
    setDeleteTarget(null)
  }

  const handleUpdated = (updated: TaskItem) => {
    setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setActiveTask((prev) => (prev?.id === updated.id ? updated : prev))
  }

  const handleDeleted = (id: string) => {
    setTasks((prev) => prev.filter((item) => item.id !== id))
    if (activeTask?.id === id) setActiveTask(null)
    if (progressComposerTaskId === id) {
      setProgressComposerTaskId(null)
      setProgressComposerValue('')
    }
  }

  const canSubmitNewTask = newTaskTitle.trim().length > 0
  const clearInputShake = () => setNewTaskInputShaking(false)

  const submitNewTask = async () => {
    const title = newTaskTitle.trim()
    if (!title) {
      setNewTaskInputShaking(false)
      requestAnimationFrame(() => setNewTaskInputShaking(true))
      requestAnimationFrame(() => newTaskInputRef.current?.focus())
      return false
    }
    const newTask = await tasksRepo.add({
      title,
      status: 'todo',
      priority: null,
      dueDate: undefined,
      tags: [],
      subtasks: [],
    })
    setTasks((prev) => [newTask, ...prev])
    setActiveStatus('todo')
    setNewTaskTitle('')
    requestAnimationFrame(() => {
      const listEl = listRefs.current.todo
      if (listEl) listEl.scrollTo({ top: 0, behavior: 'auto' })
    })
    requestAnimationFrame(() => newTaskInputRef.current?.focus())
    return true
  }

  const calendarTasks = useMemo(
    () =>
      tagFilter === 'all'
        ? tasks
        : tasks.filter((task) => task.tags.some((tag) => tag.toLowerCase() === tagFilter)),
    [tasks, tagFilter]
  )

  const rowsByStatus = useMemo(() => {
    const sorter = sortMode === 'time' ? sortByTime : sortByImportance
    const grouped: Record<TaskStatus, TaskItem[]> = { todo: [], doing: [], done: [] }
    tasks.forEach((task) => {
      if (tagFilter !== 'all' && !task.tags.some((tag) => tag.toLowerCase() === tagFilter)) return
      grouped[task.status].push(task)
    })
    ;(Object.keys(grouped) as TaskStatus[]).forEach((key) => {
      grouped[key] = grouped[key].slice().sort(sorter)
    })
    return grouped
  }, [tasks, sortMode, tagFilter])

  const activeTabLabel = useMemo(() => tabs.find((t) => t.key === activeStatus)?.label ?? 'Todo', [activeStatus])
  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex((tab) => tab.key === activeStatus)
    return idx >= 0 ? idx : 0
  }, [activeStatus])
  const tabMotionStyle = useMemo(
    () =>
      ({
        '--tab-count': `${tabs.length}`,
        '--tab-active-index': `${activeIndex}`,
      }) as CSSProperties,
    [activeIndex]
  )

  const getStatusActions = (task: TaskItem) => {
    if (task.status === 'todo') {
      return [
        {
          key: 'start',
          label: 'Start',
          onClick: async (nextTask: TaskItem) => {
            const updated = await tasksRepo.updateStatus(nextTask.id, 'doing')
            if (!updated) return
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
            if (activeTask?.id === updated.id) setActiveTask(updated)
          },
        },
        {
          key: 'done',
          label: 'Done',
          onClick: async (nextTask: TaskItem) => {
            const updated = await tasksRepo.updateStatus(nextTask.id, 'done')
            if (!updated) return
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
            if (activeTask?.id === updated.id) setActiveTask(updated)
          },
        },
      ]
    }
    const next = getNextStatus(task.status)
    return [
      {
        key: next.next,
        label: next.label,
        onClick: async (nextTask: TaskItem) => {
          const updated = await tasksRepo.updateStatus(nextTask.id, next.next)
          if (!updated) return
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          if (activeTask?.id === updated.id) setActiveTask(updated)
        },
      },
    ]
  }

  const handleToggleProgressComposer = (task: TaskItem) => {
    if (task.status !== activeStatus) return
    if (progressComposerTaskId === task.id) {
      setProgressComposerTaskId(null)
      setProgressComposerValue('')
      return
    }
    setProgressComposerTaskId(task.id)
    setProgressComposerValue('')
  }

  const closeQuickProgress = (task: TaskItem) => {
    if (progressComposerTaskId !== task.id) return
    setProgressComposerTaskId(null)
    setProgressComposerValue('')
  }

  const submitQuickProgress = async (task: TaskItem) => {
    const content = progressComposerValue.trim()
    if (!content || progressSavingTaskId) return
    setProgressSavingTaskId(task.id)
    try {
      const updated = await tasksRepo.appendProgress(task.id, content)
      if (!updated) return
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      if (activeTask?.id === updated.id) setActiveTask(updated)
      setProgressComposerTaskId(null)
      setProgressComposerValue('')
    } catch {
      toast.push({
        variant: 'error',
        title: 'Save failed',
        message: 'Progress is kept in the input. Press Enter to retry.',
      })
    } finally {
      setProgressSavingTaskId(null)
    }
  }

  return (
    <Card
      title="Tasks"
      eyebrow="Kanban"
      actions={
        <Button
          type="button"
          className="button button--ghost tasks-fg__view-toggle"
          onClick={() => setViewMode((prev) => (prev === 'kanban' ? 'calendar' : 'kanban'))}
        >
          {viewMode === 'kanban' ? 'Calendar' : 'Task'}
        </Button>
      }
    >
      <div className="tasks-fg">
        <div className="tasks-fg__top">
          <div className="tasks-fg__tabs-row">
            <div className="tasks-fg__tabs tab-motion-group" role="tablist" aria-label="Task status tabs" style={tabMotionStyle}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeStatus === tab.key}
                  className={`tasks-fg__tab tab-motion-tab ${activeStatus === tab.key ? 'is-active' : ''}`}
                  onClick={(event) => {
                    triggerTabPressAnimation(event.currentTarget)
                    triggerTabGroupSwitchAnimation(event.currentTarget)
                    setActiveStatus(tab.key)
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="tasks-fg__filters">
              <div className="tasks-fg__select tasks-fg__select--tag">
                <Select
                  value={tagFilter}
                  options={tagFilterOptions}
                  onChange={(v) => setTagFilter(v as TagFilterMode)}
                />
              </div>

              <div className="tasks-fg__select">
                <Select
                  value={sortMode}
                  options={[
                    { value: 'importance', label: 'Importance' },
                    { value: 'time', label: 'Time' },
                  ]}
                  onChange={(v) => setSortMode(v as SortMode)}
                />
              </div>

              <span className="muted tasks-fg__count" aria-label={`${activeTabLabel} count`}>
                <AppNumber value={rowsByStatus[activeStatus].length} />
              </span>
            </div>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <TaskCalendarWidget
            tasks={calendarTasks}
            onTaskCreated={(task) => {
              setTasks((prev) => [task, ...prev])
            }}
            onTaskUpdated={(task) => {
              handleUpdated(task)
            }}
            onTaskDeleted={(id) => {
              handleDeleted(id)
            }}
          />
        ) : (
          <>
            <div className="tasks-fg__viewport" aria-label="Task lists">
              <div className="tasks-fg__track" style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}>
                {tabs.map((tab) => {
                  const rows = rowsByStatus[tab.key]
                  return (
                    <div key={tab.key} className="tasks-fg__panel" role="tabpanel" aria-label={`${tab.label} tasks`}>
                      <AnimatedScrollList
                        items={rows}
                        getKey={(task) => task.id}
                        showGradients
                        itemDelay={0.1}
                        className="tasks-fg__list-wrap"
                        listClassName="tasks-fg__list"
                        setListRef={(node) => {
                          listRefs.current[tab.key] = node
                        }}
                        emptyState={
                          <div className="tasks-fg__empty">
                            <p className="muted">No tasks</p>
                          </div>
                        }
                        renderItem={(task) => {
                          return (
                            <TaskCard
                              task={task}
                              onClick={(nextTask) => setActiveTask(nextTask)}
                              onDelete={(nextTask) => requestDelete(nextTask)}
                              statusActions={getStatusActions(task)}
                              progressComposer={{
                                isOpen: progressComposerTaskId === task.id,
                                value: progressComposerTaskId === task.id ? progressComposerValue : '',
                                disabled: progressSavingTaskId === task.id,
                                onToggle: handleToggleProgressComposer,
                                onChange: setProgressComposerValue,
                                onSubmit: (nextTask) => {
                                  void submitQuickProgress(nextTask)
                                },
                                onCancel: closeQuickProgress,
                              }}
                            />
                          )
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <form
              className="tasks-fg__composer"
              onSubmit={(event) => {
                event.preventDefault()
                void submitNewTask()
              }}
            >
              <input
                ref={newTaskInputRef}
                className={`tasks-fg__input ${newTaskInputShaking ? 'is-shaking' : ''}`}
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                onAnimationEnd={clearInputShake}
                placeholder="Add a new task..."
              />
              <Button type="submit" className="button tasks-fg__add-btn" disabled={!canSubmitNewTask}>
                Add
              </Button>
            </form>
          </>
        )}
      </div>

      <TaskDrawer
        open={Boolean(activeTask)}
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onRequestDelete={requestDelete}
      />
      <Dialog open={Boolean(deleteTarget)} title="Delete task" onClose={cancelDelete}>
        <div className="dialog__body">
          <p>Delete "{deleteTarget?.title}"?</p>
          <div className="dialog__actions">
            <Button className="button button--ghost" type="button" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button className="button button--danger" type="button" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  )
}

export default TasksBoard
