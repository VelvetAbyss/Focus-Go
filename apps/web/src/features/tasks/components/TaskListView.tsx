import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectItem } from '../../../data/models/types'
import type { TaskItem, TaskStatus } from '../tasks.types'
import { resolveProjectColor } from '../../../shared/design/tokens'
import TaskRow from './TaskRow'
import '../tasks-ledger.css'

const DONE_COLLAPSED_LIMIT = 4
const STORAGE_DONE_EXPANDED_KEY = 'tasks_list_done_expanded'

type TaskListViewProps = {
  tasks: TaskItem[]
  projectById: Map<string, ProjectItem>
  ownerName?: (task: TaskItem) => string | undefined
  onTaskClick: (task: TaskItem) => void
  onCycleStatus: (task: TaskItem) => void
  onDelete?: (task: TaskItem) => void
  onTogglePin?: (task: TaskItem) => void
  onAddTask?: (status: TaskStatus) => void
}

const TaskListView = ({
  tasks,
  projectById,
  ownerName,
  onTaskClick,
  onCycleStatus,
  onDelete,
  onTogglePin,
  onAddTask,
}: TaskListViewProps) => {
  const [doneExpanded, setDoneExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_DONE_EXPANDED_KEY) === '1'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_DONE_EXPANDED_KEY, doneExpanded ? '1' : '0')
  }, [doneExpanded])

  const byStatus = useMemo(() => {
    const groups: Record<TaskStatus, TaskItem[]> = { todo: [], doing: [], done: [] }
    tasks.forEach((task) => {
      groups[task.status].push(task)
    })
    return groups
  }, [tasks])

  const visibleDone = doneExpanded ? byStatus.done : byStatus.done.slice(0, DONE_COLLAPSED_LIMIT)
  const hiddenDoneCount = Math.max(0, byStatus.done.length - DONE_COLLAPSED_LIMIT)

  const resolveProjectForRow = (task: TaskItem) => {
    if (!task.projectId) return null
    const project = projectById.get(task.projectId)
    if (!project || project.status === 'archived') return null
    return { id: project.id, title: project.title, color: resolveProjectColor(project) }
  }

  return (
    <div className="fg-task-list">
      <div className="fg-task-list__board">
        {/* ── TODO ───────────────────────────────── */}
        <motion.section
          className="fg-task-list__col fg-task-list__col--todo"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.36 }}
        >
          <header className="fg-task-list__col-head">
            <div className="fg-task-list__col-head__title">
              <span className="fg-task-list__col-glyph" aria-hidden />
              <span className="fg-task-list__col-name">待办</span>
              <span className="fg-task-list__col-count">{byStatus.todo.length}</span>
            </div>
            {onAddTask ? (
              <button
                type="button"
                className="fg-task-list__add"
                aria-label="Add todo"
                onClick={() => onAddTask('todo')}
              >
                <Plus className="size-3.5" strokeWidth={1.8} />
              </button>
            ) : null}
          </header>

          <div className="fg-task-list__rows">
            {byStatus.todo.length === 0 ? (
              <p className="fg-task-list__empty">无待办</p>
            ) : (
              byStatus.todo.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + Math.min(i, 8) * 0.025, duration: 0.28 }}
                >
                  <TaskRow
                    task={task}
                    project={resolveProjectForRow(task)}
                    index={i}
                    variant="todo"
                    onClick={onTaskClick}
                    onCycleStatus={onCycleStatus}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                  />
                </motion.div>
              ))
            )}
          </div>
        </motion.section>

        {/* ── DOING (hero) ───────────────────────── */}
        <motion.section
          className="fg-task-list__col fg-task-list__col--doing"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.36 }}
        >
          <header className="fg-task-list__col-head fg-task-list__col-head--hero">
            <div className="fg-task-list__col-head__title">
              <span className="fg-task-list__col-glyph fg-task-list__col-glyph--hero" aria-hidden />
              <span className="fg-task-list__col-name fg-task-list__col-name--hero">进行中</span>
              <span className="fg-task-list__col-count fg-task-list__col-count--hero">{byStatus.doing.length}</span>
            </div>
            {onAddTask ? (
              <button
                type="button"
                className="fg-task-list__add"
                aria-label="Add doing"
                onClick={() => onAddTask('doing')}
              >
                <Plus className="size-3.5" strokeWidth={1.8} />
              </button>
            ) : null}
          </header>

          <div className="fg-task-list__rows fg-task-list__rows--hero">
            {byStatus.doing.length === 0 ? (
              <p className="fg-task-list__empty">没有在进行的任务</p>
            ) : (
              byStatus.doing.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.16 + Math.min(i, 6) * 0.04, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                >
                  <TaskRow
                    task={task}
                    project={resolveProjectForRow(task)}
                    ownerName={ownerName?.(task)}
                    variant="doing"
                    onClick={onTaskClick}
                    onCycleStatus={onCycleStatus}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                  />
                </motion.div>
              ))
            )}
          </div>
        </motion.section>

        {/* ── DONE (archive) ─────────────────────── */}
        <motion.section
          className={cn('fg-task-list__col fg-task-list__col--done', doneExpanded && 'is-expanded')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.36 }}
        >
          <header className="fg-task-list__col-head fg-task-list__col-head--archive">
            <div className="fg-task-list__col-head__title">
              <span className="fg-task-list__col-glyph" aria-hidden />
              <span className="fg-task-list__col-name">已完成</span>
              <span className="fg-task-list__col-count">{byStatus.done.length}</span>
            </div>
          </header>

          <div className="fg-task-list__rows fg-task-list__rows--archive">
            {byStatus.done.length === 0 ? (
              <p className="fg-task-list__empty">尚未归档</p>
            ) : (
              visibleDone.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.22 + Math.min(i, 8) * 0.02, duration: 0.25 }}
                >
                  <TaskRow
                    task={task}
                    project={resolveProjectForRow(task)}
                    variant="done"
                    onClick={onTaskClick}
                    onCycleStatus={onCycleStatus}
                    onDelete={onDelete}
                  />
                </motion.div>
              ))
            )}
          </div>
          {hiddenDoneCount > 0 ? (
            <button
              type="button"
              className="fg-task-list__expand"
              onClick={() => setDoneExpanded((v) => !v)}
            >
              {doneExpanded ? '折叠归档' : `查看全部 ${byStatus.done.length} 项`}
              <span aria-hidden>{doneExpanded ? ' ↑' : ' →'}</span>
            </button>
          ) : null}
        </motion.section>
      </div>
    </div>
  )
}

export default TaskListView
