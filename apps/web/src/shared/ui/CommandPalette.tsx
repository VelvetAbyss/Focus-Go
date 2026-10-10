import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import {
  Calendar,
  CalendarDays,
  CalendarPlus,
  Compass,
  FileDown,
  FileText,
  FolderKanban,
  Home,
  LayoutList,
  ListTodo,
  Map as MapIcon,
  MapPin,
  NotebookPen,
  NotebookText,
  Plane,
  Play,
  Plus,
  Search,
  Settings,
  SquareActivity,
  Trash2,
  CircleCheck,
  Circle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { notesRepo } from '../../data/repositories/notesRepo'
import { diaryRepo } from '../../data/repositories/diaryRepo'
import { projectsRepo } from '../../data/repositories/projectsRepo'
import { createTask as createTaskRecord, parseQuickAddTaskInput } from '../../features/tasks/application/taskActions'
import { requestOpen } from '../navigation/openRequest'
import { appIntlLocale } from '../i18n/format'
import { searchDocs, type SearchDoc, type SearchKind } from './commandSearch'
import { buildDiaryEntryRoute, buildNoteDetailRoute, buildTaskDetailRoute, buildTripDetailRoute, ROUTES } from '../../app/routes/routes'
import { emitTasksChanged } from '../../features/tasks/taskSync'
import { useTripCommandContext } from '../../features/trips/tripCommandRegistry'
import { tripsRepo } from '../../features/trips/tripsRepo'
import type { TripRecord } from '../../data/models/types'
import { useI18n } from '../i18n/useI18n'
import type { TranslationKey } from '../i18n/types'
import { readCurrentUserRecentCommandTargets, rememberCurrentUserRecentCommandTarget, resolveRecentCommandTargets } from './recentCommandTargets'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// `keywords` keep English search terms working in every UI language.
const ACTIONS: Array<{ id: string; labelKey: TranslationKey; keywords: string; icon: typeof ListTodo; to: string }> = [
  { id: 'dashboard', labelKey: 'commandPalette.nav.dashboard', keywords: 'dashboard home', icon: Home, to: ROUTES.DASHBOARD },
  { id: 'timeline', labelKey: 'commandPalette.nav.timeline', keywords: 'timeline activity', icon: SquareActivity, to: ROUTES.TIMELINE },
  { id: 'tasks', labelKey: 'commandPalette.nav.tasks', keywords: 'tasks todo', icon: ListTodo, to: ROUTES.TASKS },
  { id: 'note', labelKey: 'commandPalette.nav.note', keywords: 'notes note', icon: NotebookText, to: ROUTES.NOTE },
  { id: 'calendar', labelKey: 'commandPalette.nav.calendar', keywords: 'calendar', icon: CalendarDays, to: ROUTES.CALENDAR },
  { id: 'projects', labelKey: 'commandPalette.nav.projects', keywords: 'projects', icon: FolderKanban, to: ROUTES.PROJECTS },
  { id: 'trips', labelKey: 'commandPalette.nav.trips', keywords: 'trips travel', icon: Plane, to: ROUTES.TRIPS },
  { id: 'focus', labelKey: 'commandPalette.nav.focus', keywords: 'focus pomodoro timer', icon: Play, to: ROUTES.FOCUS },
  { id: 'diary', labelKey: 'commandPalette.nav.diary', keywords: 'diary journal', icon: NotebookPen, to: ROUTES.DIARY },
  { id: 'settings', labelKey: 'commandPalette.nav.settings', keywords: 'settings preferences', icon: Settings, to: ROUTES.SETTINGS },
]

const RESULT_GROUPS: Array<{ kind: SearchKind; headingKey: TranslationKey }> = [
  { kind: 'task', headingKey: 'commandPalette.group.tasks' },
  { kind: 'note', headingKey: 'commandPalette.group.notes' },
  { kind: 'diary', headingKey: 'commandPalette.group.diary' },
  { kind: 'project', headingKey: 'commandPalette.group.projects' },
]

const RESULT_LABEL_KEYS: Record<SearchKind, TranslationKey> = {
  task: 'commandPalette.group.tasks',
  note: 'commandPalette.group.notes',
  diary: 'commandPalette.group.diary',
  project: 'commandPalette.group.projects',
}

/** Loads everything ⌘K can find: tasks, notes, diary entries and projects (all local). */
const loadSearchDocs = async (untitled: string): Promise<SearchDoc[]> => {
  const [tasks, notes, diary, projects] = await Promise.all([
    tasksRepo.list(),
    notesRepo.list(),
    diaryRepo.listActive(),
    projectsRepo.list(),
  ])
  const locale = appIntlLocale()
  const dayLabel = (dateKey: string) =>
    new Date(`${dateKey}T12:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  return [
    ...tasks.map((task): SearchDoc => ({
      kind: 'task',
      id: task.id,
      title: task.title,
      body: [task.description, task.progressNote, ...task.subtasks.map((item) => item.title), ...task.tags].filter(Boolean).join(' '),
      closed: task.status === 'done' || task.status === 'dropped',
      updatedAt: task.updatedAt,
    })),
    ...notes.map((note): SearchDoc => ({
      kind: 'note',
      id: note.id,
      title: note.title.trim() || untitled,
      body: note.contentMd,
      updatedAt: note.updatedAt,
    })),
    ...diary
      .filter((entry) => entry.contentMd.trim())
      .map((entry): SearchDoc => ({
        kind: 'diary',
        id: entry.id,
        title: dayLabel(entry.dateKey),
        body: entry.contentMd,
        updatedAt: entry.updatedAt,
      })),
    ...projects.map((project): SearchDoc => ({
      kind: 'project',
      id: project.id,
      title: project.title,
      body: [project.description, project.goal, project.nextAction].filter(Boolean).join(' '),
      closed: project.status === 'archived' || project.status === 'done',
      updatedAt: project.updatedAt,
    })),
  ]
}

const VIEW_OPTIONS = [
  { id: 'list', labelKey: 'commandPalette.view.list', icon: LayoutList },
  { id: 'timeline', labelKey: 'commandPalette.view.timeline', icon: Calendar },
  { id: 'map', labelKey: 'commandPalette.view.map', icon: MapIcon },
] as const

const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const tripCtx = useTripCommandContext()
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [searchIndex, setSearchIndex] = useState<SearchDoc[]>([])
  const [recentTargets, setRecentTargets] = useState(readCurrentUserRecentCommandTargets)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  const closeAndRestoreFocus = useCallback(() => {
    onOpenChange(false)
    window.requestAnimationFrame(() => {
      if (previouslyFocusedElement.current?.isConnected) previouslyFocusedElement.current.focus()
    })
  }, [onOpenChange])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (open) closeAndRestoreFocus()
        else {
          previouslyFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          onOpenChange(true)
        }
        return
      }
      if (event.key === 'Escape' && open) closeAndRestoreFocus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeAndRestoreFocus, onOpenChange, open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSearchIndex([])
    setRecentTargets(readCurrentUserRecentCommandTargets())
    void tripsRepo.list().then((rows) => {
      if (!cancelled) setTrips(rows)
    })
    void loadSearchDocs(t('notes.trash.untitled')).then((docs) => {
      if (!cancelled) setSearchIndex(docs)
    })
    return () => {
      cancelled = true
    }
  }, [open, t])

  const createTask = async () => {
    const raw = query.trim()
    if (!raw) return
    // Same quick-add syntax as the task composer ("明天下午3点 开会 #工作 !1").
    const parsed = await parseQuickAddTaskInput(raw, { projects: await projectsRepo.list() })
    await createTaskRecord({
      title: parsed.title,
      status: parsed.waitingOn ? 'waiting' : 'todo',
      waitingOn: parsed.waitingOn,
      priority: parsed.priority,
      isToday: parsed.isToday,
      dueDate: parsed.dueDate,
      reminderAt: parsed.reminderAt,
      recurrence: parsed.recurrence,
      projectId: parsed.projectId,
      tags: parsed.tags,
      subtasks: [],
    })
    emitTasksChanged('command-palette:create-task')
    setQuery('')
    onOpenChange(false)
    navigate(ROUTES.TASKS)
  }

  const openHit = (hit: SearchDoc) => {
    setRecentTargets(rememberCurrentUserRecentCommandTarget({ kind: hit.kind, id: hit.id }))
    if (hit.kind === 'project') {
      navigate(`${ROUTES.PROJECTS}/${hit.id}`)
      return
    }
    if (hit.kind === 'task') {
      requestOpen('task', hit.id)
      navigate(buildTaskDetailRoute(hit.id))
      return
    }
    if (hit.kind === 'note') {
      requestOpen('note', hit.id)
      navigate(buildNoteDetailRoute(hit.id))
      return
    }
    navigate(buildDiaryEntryRoute(hit.id))
  }

  const run = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  const trimmed = query.trim()
  const needle = trimmed.toLowerCase()
  const hits = useMemo(() => searchDocs(searchIndex, trimmed), [searchIndex, trimmed])
  const recentDocs = useMemo(() => resolveRecentCommandTargets(recentTargets, searchIndex), [recentTargets, searchIndex])

  if (!open) return null

  // Filtering is done here, not by cmdk, so content results keep their ranking and come first.
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle)
  const currentTripId = tripCtx?.trip.id
  const otherTrips = trips.filter((trip) => trip.id !== currentTripId && matches(`${trip.title} ${trip.destination ?? ''} trip`))
  const visibleActions = ACTIONS.filter((action) => matches(`${t(action.labelKey)} ${action.keywords}`))

  return (
    <div className="command-palette" role="dialog" aria-modal="true" aria-label={t('commandPalette.aria')}>
      <button
        type="button"
        className="command-palette__backdrop"
        aria-label={t('commandPalette.close')}
        onClick={closeAndRestoreFocus}
      />
      <Command
        className="command-palette__panel"
        label={t('commandPalette.aria')}
        shouldFilter={false}
      >
        <div className="command-palette__input-row">
          <Search className="size-4" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={tripCtx ? t('commandPalette.placeholderTrip') : t('commandPalette.placeholder')}
            onKeyDown={(event) => {
              // Nothing found: Enter captures the text as a task.
              if (event.key === 'Enter' && trimmed && !event.defaultPrevented) {
                if (hits.length === 0 && visibleActions.length === 0 && otherTrips.length === 0 && !tripCtx) {
                  event.preventDefault()
                  void createTask()
                }
              }
            }}
          />
          <kbd>⌘K</kbd>
        </div>
        <Command.List className="command-palette__list">
          {!trimmed && recentDocs.length > 0 ? (
            <Command.Group heading={t('commandPalette.group.recent')} className="command-palette__group">
              {recentDocs.map((doc) => {
                const Icon = doc.kind === 'task' ? (doc.closed ? CircleCheck : Circle) : doc.kind === 'note' ? FileText : doc.kind === 'diary' ? NotebookPen : FolderKanban
                return (
                  <Command.Item
                    key={`recent:${doc.kind}:${doc.id}`}
                    value={`recent:${doc.kind}:${doc.id}`}
                    className={`command-palette__item command-palette__item--result${doc.closed ? ' is-closed' : ''}`}
                    onSelect={() => run(() => openHit(doc))}
                  >
                    <Icon className="size-4" />
                    <span>{doc.title}</span>
                    <strong>{t(RESULT_LABEL_KEYS[doc.kind])}</strong>
                  </Command.Item>
                )
              })}
            </Command.Group>
          ) : null}
          {RESULT_GROUPS.map(({ kind, headingKey }) => {
            const groupHits = hits.filter((hit) => hit.kind === kind)
            if (groupHits.length === 0) return null
            return (
              <Command.Group key={kind} heading={t(headingKey)} className="command-palette__group">
                {groupHits.map((hit) => {
                  const Icon = kind === 'task' ? (hit.closed ? CircleCheck : Circle) : kind === 'note' ? FileText : kind === 'diary' ? NotebookPen : FolderKanban
                  return (
                    <Command.Item
                      key={`${kind}:${hit.id}`}
                      value={`${kind}:${hit.id}`}
                      className={`command-palette__item command-palette__item--result${hit.closed ? ' is-closed' : ''}`}
                      onSelect={() => run(() => openHit(hit))}
                    >
                      <Icon className="size-4" />
                      <span>{hit.title}</span>
                      {hit.snippet ? <strong>{hit.snippet}</strong> : null}
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )
          })}

          {trimmed ? (
            <Command.Item
              value={`create-task:${trimmed}`}
              className="command-palette__item"
              onSelect={() => void createTask()}
            >
              <Plus className="size-4" />
              <span>{t('commandPalette.createTask')}</span>
              <strong>{trimmed}</strong>
            </Command.Item>
          ) : null}

          {tripCtx ? (
            <>
              <Command.Group heading={t('commandPalette.group.thisTrip')} className="command-palette__group">
                {tripCtx.sections.filter((section) => matches(`${t('commandPalette.goTo', { name: section.label })} ${section.label}`)).map((section) => (
                  <Command.Item
                    key={`section:${section.id}`}
                    value={`${t('commandPalette.goTo', { name: section.label })} Go to ${section.label}`}
                    className="command-palette__item"
                    onSelect={() => run(() => tripCtx.scrollToSection(section.id))}
                  >
                    <Compass className="size-4" />
                    <span>{t('commandPalette.goTo', { name: section.label })}</span>
                  </Command.Item>
                ))}
                {VIEW_OPTIONS.filter((view) => matches(`${t(view.labelKey)} ${view.id} view`)).map((view) => {
                  const Icon = view.icon
                  return (
                    <Command.Item
                      key={`view:${view.id}`}
                      value={`${t(view.labelKey)} Switch to ${view.id} view`}
                      className="command-palette__item"
                      onSelect={() => run(() => tripCtx.switchItineraryView(view.id))}
                    >
                      <Icon className="size-4" />
                      <span>{t(view.labelKey)}</span>
                    </Command.Item>
                  )
                })}
                {tripCtx.trip.itinerary.filter((day) => matches(`${t('commandPalette.addActivity', { n: day.day })} ${day.label} day ${day.day}`)).map((day) => (
                  <Command.Item
                    key={`add:${day.day}`}
                    value={`${t('commandPalette.addActivity', { n: day.day })} Add activity to Day ${day.day} ${day.label}`}
                    className="command-palette__item"
                    onSelect={() => run(() => tripCtx.addActivity(day.day))}
                  >
                    <Plus className="size-4" />
                    <span>{t('commandPalette.addActivity', { n: day.day })}</span>
                    <strong>{day.label}</strong>
                  </Command.Item>
                ))}
                {matches(`${t('commandPalette.exportPdf')} Export trip as PDF`) ? <Command.Item
                  value={`${t('commandPalette.exportPdf')} Export trip as PDF`}
                  className="command-palette__item"
                  onSelect={() => run(() => tripCtx.exportPdf())}
                >
                  <FileDown className="size-4" />
                  <span>{t('commandPalette.exportPdf')}</span>
                </Command.Item> : null}
                {matches(`${t('commandPalette.exportIcal')} Export trip as iCal ics calendar`) ? <Command.Item
                  value={`${t('commandPalette.exportIcal')} Export trip as iCal ics calendar`}
                  className="command-palette__item"
                  onSelect={() => run(() => tripCtx.exportIcal())}
                >
                  <CalendarPlus className="size-4" />
                  <span>{t('commandPalette.exportIcal')}</span>
                </Command.Item> : null}
                {matches(`${t('commandPalette.deleteTrip')} Delete this trip`) ? <Command.Item
                  value={`${t('commandPalette.deleteTrip')} Delete this trip`}
                  className="command-palette__item"
                  onSelect={() => run(() => tripCtx.deleteTrip())}
                >
                  <Trash2 className="size-4" />
                  <span>{t('commandPalette.deleteTrip')}</span>
                </Command.Item> : null}
              </Command.Group>
            </>
          ) : null}

          {otherTrips.length > 0 ? (
            <Command.Group heading={t('commandPalette.group.trips')} className="command-palette__group">
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

          {visibleActions.length > 0 ? (
          <Command.Group heading={t('commandPalette.group.navigate')} className="command-palette__group">
            {visibleActions.map((action) => {
              const Icon = action.icon
              return (
                <Command.Item
                  key={action.id}
                  value={`${t(action.labelKey)} ${action.keywords}`}
                  className="command-palette__item"
                  onSelect={() => run(() => navigate(action.to))}
                >
                  <Icon className="size-4" />
                  <span>{t(action.labelKey)}</span>
                </Command.Item>
              )
            })}
          </Command.Group>
          ) : null}
        </Command.List>
      </Command>
    </div>
  )
}

export default CommandPalette
