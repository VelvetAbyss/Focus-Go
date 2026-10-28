import { useId, useMemo, useState } from 'react'
import { Check, ChevronDown, Folder, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'
import { cn } from '@/lib/utils'
import type { ProjectItem } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'

type TaskProjectAssignCardProps = {
  projectId?: string
  projects: ProjectItem[]
  onChange: (nextProjectId?: string) => void
}

const TaskProjectAssignCard = ({ projectId, projects, onChange }: TaskProjectAssignCardProps) => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const labelId = useId()

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status !== 'archived'),
    [projects],
  )
  const currentProject = projectId ? projects.find((project) => project.id === projectId) : undefined
  const isOrphan = Boolean(projectId && (!currentProject || currentProject.status === 'archived'))

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return activeProjects
    return activeProjects.filter((project) => project.title.toLowerCase().includes(trimmed))
  }, [activeProjects, query])

  const select = (nextId?: string) => {
    onChange(nextId)
    setOpen(false)
    setQuery('')
  }

  const showSearch = activeProjects.length > 6

  const projectLabel = currentProject
    ? `${currentProject.title}${isOrphan ? ` ${t('tasks.drawer.projectArchivedSuffix')}` : ''}`
    : t(projectId ? 'tasks.drawer.projectMissing' : 'tasks.drawer.projectUnassigned')

  return (
    <section className="task-detail-card task-detail-project tdv2-section-enter">
      <div className="task-detail-property-heading">
        <p id={labelId} className="task-detail-kicker">{t('tasks.drawer.project')}</p>
        {projectId ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('tasks.drawer.removeProject')}
            className="task-detail-project__remove"
            onClick={() => select(undefined)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="task-detail-project__trigger"
            aria-labelledby={`${labelId} ${labelId}-value`}
            title={projectLabel}
          >
            <Folder className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
            <span
              id={`${labelId}-value`}
              className={cn('task-detail-project__value', (!projectId || isOrphan) && 'text-ink-3')}
            >
              {projectLabel}
            </span>
            <ChevronDown className="task-detail-project__chevron h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[320px] max-w-[calc(100vw-32px)] rounded-[var(--radius-md)] border border-rule p-2 shadow-[var(--shadow-card-lg)]"
        >
          <ProjectPickerList
            projects={filtered}
            showSearch={showSearch}
            query={query}
            setQuery={setQuery}
            currentProjectId={projectId}
            onSelect={select}
          />
        </PopoverContent>
      </Popover>
    </section>
  )
}

type ProjectPickerListProps = {
  projects: ProjectItem[]
  showSearch: boolean
  query: string
  setQuery: (next: string) => void
  currentProjectId?: string
  onSelect: (nextId?: string) => void
}

const ProjectPickerList = ({
  projects,
  showSearch,
  query,
  setQuery,
  currentProjectId,
  onSelect,
}: ProjectPickerListProps) => {
  const { t } = useI18n()
  return (
    <div className="space-y-1.5">
      {showSearch ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-secondary)]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('tasks.drawer.searchProject')}
            className="h-8 rounded-[var(--radius-md)] border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] bg-[color:var(--bg-muted)] pl-7 text-label"
            autoFocus
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={cn(
          'flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-left text-ui transition-colors hover:bg-[color:var(--surface-hover)]',
          !currentProjectId && 'bg-[color:var(--surface-hover)] font-semibold',
        )}
      >
        <span className="inline-flex items-center gap-2 text-[color:var(--text-secondary)]">
          <X className="h-3.5 w-3.5" />
          {t('tasks.drawer.projectUnassigned')}
        </span>
        {!currentProjectId ? <Check className="h-3.5 w-3.5 text-ink-3" /> : null}
      </button>
      <div className="max-h-[260px] space-y-0.5 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="px-3 py-4 text-center text-label text-[color:var(--text-secondary)]">
            {t('tasks.drawer.noMatchingProjects')}
          </p>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-left text-ui transition-colors hover:bg-[color:var(--surface-hover)]',
                currentProjectId === project.id && 'bg-[color:var(--surface-hover)] font-semibold',
              )}
            >
              <span className="inline-flex items-center gap-2 truncate">
                <Folder className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                <span className="truncate">{project.title}</span>
              </span>
              {currentProjectId === project.id ? <Check className="h-3.5 w-3.5 shrink-0 text-ink-3" /> : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default TaskProjectAssignCard
