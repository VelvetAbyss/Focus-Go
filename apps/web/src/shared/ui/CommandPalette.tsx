import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import {
  Calendar,
  CalendarPlus,
  Compass,
  FileDown,
  FolderKanban,
  LayoutList,
  ListTodo,
  Map as MapIcon,
  MapPin,
  Plane,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { buildTripDetailRoute, ROUTES } from '../../app/routes/routes'
import { emitTasksChanged } from '../../features/tasks/taskSync'
import { useTripCommandContext } from '../../features/trips/tripCommandRegistry'
import { tripsRepo } from '../../features/trips/tripsRepo'
import type { TripRecord } from '../../data/models/types'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ACTIONS = [
  { id: 'tasks', label: 'Open Tasks', icon: ListTodo, to: ROUTES.TASKS },
  { id: 'projects', label: 'Open Projects', icon: FolderKanban, to: ROUTES.PROJECTS },
  { id: 'trips', label: 'Open Trips', icon: Plane, to: ROUTES.TRIPS },
  { id: 'focus', label: 'Open Focus', icon: Play, to: ROUTES.FOCUS },
]

const VIEW_OPTIONS = [
  { id: 'list', label: 'Itinerary · List view', icon: LayoutList },
  { id: 'timeline', label: 'Itinerary · Timeline view', icon: Calendar },
  { id: 'map', label: 'Itinerary · Map view', icon: MapIcon },
] as const

const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const tripCtx = useTripCommandContext()
  const [trips, setTrips] = useState<TripRecord[]>([])

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

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void tripsRepo.list().then((rows) => {
      if (!cancelled) setTrips(rows)
    })
    return () => {
      cancelled = true
    }
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

  const run = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  if (!open) return null

  const trimmed = query.trim()
  const currentTripId = tripCtx?.trip.id
  const otherTrips = trips.filter((trip) => trip.id !== currentTripId)

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
            placeholder={tripCtx ? 'Jump, switch view, add activity…' : 'Capture a task or type a destination'}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && trimmed && !event.defaultPrevented) {
                const hasMatch = ACTIONS.some((action) =>
                  action.label.toLowerCase().includes(trimmed.toLowerCase()),
                )
                if (!hasMatch && !tripCtx) {
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

          {tripCtx ? (
            <>
              <Command.Group heading="This trip" className="command-palette__group">
                {tripCtx.sections.map((section) => (
                  <Command.Item
                    key={`section:${section.id}`}
                    value={`Go to ${section.label}`}
                    className="command-palette__item"
                    onSelect={() => run(() => tripCtx.scrollToSection(section.id))}
                  >
                    <Compass className="size-4" />
                    <span>Go to {section.label}</span>
                  </Command.Item>
                ))}
                {VIEW_OPTIONS.map((view) => {
                  const Icon = view.icon
                  return (
                    <Command.Item
                      key={`view:${view.id}`}
                      value={`Switch to ${view.label}`}
                      className="command-palette__item"
                      onSelect={() => run(() => tripCtx.switchItineraryView(view.id))}
                    >
                      <Icon className="size-4" />
                      <span>{view.label}</span>
                    </Command.Item>
                  )
                })}
                {tripCtx.trip.itinerary.map((day) => (
                  <Command.Item
                    key={`add:${day.day}`}
                    value={`Add activity to Day ${day.day} ${day.label}`}
                    className="command-palette__item"
                    onSelect={() => run(() => tripCtx.addActivity(day.day))}
                  >
                    <Plus className="size-4" />
                    <span>Add activity to Day {day.day}</span>
                    <strong>{day.label}</strong>
                  </Command.Item>
                ))}
                <Command.Item
                  value="Export trip as PDF"
                  className="command-palette__item"
                  onSelect={() => run(() => tripCtx.exportPdf())}
                >
                  <FileDown className="size-4" />
                  <span>Export trip as PDF</span>
                </Command.Item>
                <Command.Item
                  value="Export trip as iCal ics calendar"
                  className="command-palette__item"
                  onSelect={() => run(() => tripCtx.exportIcal())}
                >
                  <CalendarPlus className="size-4" />
                  <span>Export trip as iCal (.ics)</span>
                </Command.Item>
                <Command.Item
                  value="Delete this trip"
                  className="command-palette__item"
                  onSelect={() => run(() => tripCtx.deleteTrip())}
                >
                  <Trash2 className="size-4" />
                  <span>Delete this trip</span>
                </Command.Item>
              </Command.Group>
            </>
          ) : null}

          {otherTrips.length > 0 ? (
            <Command.Group heading="Trips" className="command-palette__group">
              {otherTrips.map((trip) => (
                <Command.Item
                  key={`trip:${trip.id}`}
                  value={`Open trip ${trip.title} ${trip.destination}`}
                  className="command-palette__item"
                  onSelect={() => run(() => navigate(buildTripDetailRoute(trip.id)))}
                >
                  <MapPin className="size-4" />
                  <span>{trip.title}</span>
                  {trip.destination ? <strong>{trip.destination}</strong> : null}
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          <Command.Group heading="Navigate" className="command-palette__group">
            {ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <Command.Item
                  key={action.id}
                  value={action.label}
                  className="command-palette__item"
                  onSelect={() => run(() => navigate(action.to))}
                >
                  <Icon className="size-4" />
                  <span>{action.label}</span>
                </Command.Item>
              )
            })}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  )
}

export default CommandPalette
