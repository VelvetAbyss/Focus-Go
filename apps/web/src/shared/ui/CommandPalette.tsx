import { useEffect, useMemo, useState } from 'react'
import { FolderKanban, ListTodo, Play, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { ROUTES } from '../../app/routes/routes'
import { emitTasksChanged } from '../../features/tasks/taskSync'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ACTIONS = [
  { id: 'tasks', label: 'Open Tasks', icon: ListTodo, to: ROUTES.TASKS },
  { id: 'projects', label: 'Open Projects', icon: FolderKanban, to: ROUTES.PROJECTS },
  { id: 'focus', label: 'Open Focus', icon: Play, to: ROUTES.FOCUS },
]

const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
      }
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  const filteredActions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return ACTIONS
    return ACTIONS.filter((action) => action.label.toLowerCase().includes(needle))
  }, [query])

  const createTask = async () => {
    const title = query.trim()
    if (!title) return
    const created = await tasksRepo.add({
      title,
      status: 'todo',
      priority: null,
      tags: [],
      subtasks: [],
    })
    emitTasksChanged('command-palette:create-task')
    window.localStorage.setItem('focusgo.lastCapturedTaskId', created.id)
    setQuery('')
    onOpenChange(false)
    navigate(ROUTES.TASKS)
  }

  if (!open) return null

  return (
    <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" className="command-palette__backdrop" aria-label="Close command palette" onClick={() => onOpenChange(false)} />
      <div className="command-palette__panel">
        <div className="command-palette__input-row">
          <Search className="size-4" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void createTask()
              }
            }}
            placeholder="Capture a task or type a destination"
          />
          <kbd>⌘K</kbd>
        </div>
        <div className="command-palette__list">
          {query.trim() ? (
            <button type="button" className="command-palette__item" onClick={() => void createTask()}>
              <Plus className="size-4" />
              <span>Create task</span>
              <strong>{query.trim()}</strong>
            </button>
          ) : null}
          {filteredActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                className="command-palette__item"
                onClick={() => {
                  onOpenChange(false)
                  navigate(action.to)
                }}
              >
                <Icon className="size-4" />
                <span>{action.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
