import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
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

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

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

  const trimmed = query.trim()

  return (
    <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <button
        type="button"
        className="command-palette__backdrop"
        aria-label="Close command palette"
        onClick={() => onOpenChange(false)}
      />
      <Command
        className="command-palette__panel"
        label="Command palette"
        shouldFilter
      >
        <div className="command-palette__input-row">
          <Search className="size-4" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Capture a task or type a destination"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && trimmed && !event.defaultPrevented) {
                const hasMatch = ACTIONS.some((action) =>
                  action.label.toLowerCase().includes(trimmed.toLowerCase()),
                )
                if (!hasMatch) {
                  event.preventDefault()
                  void createTask()
                }
              }
            }}
          />
          <kbd>⌘K</kbd>
        </div>
        <Command.List className="command-palette__list">
          {trimmed ? (
            <Command.Item
              value={`create-task:${trimmed}`}
              className="command-palette__item"
              onSelect={() => void createTask()}
            >
              <Plus className="size-4" />
              <span>Create task</span>
              <strong>{trimmed}</strong>
            </Command.Item>
          ) : null}
          {ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Command.Item
                key={action.id}
                value={action.label}
                className="command-palette__item"
                onSelect={() => {
                  onOpenChange(false)
                  navigate(action.to)
                }}
              >
                <Icon className="size-4" />
                <span>{action.label}</span>
              </Command.Item>
            )
          })}
        </Command.List>
      </Command>
    </div>
  )
}

export default CommandPalette
