import { useMemo, useState } from 'react'
import { Check, ChevronDown, Folder, FolderPlus, Search, X } from 'lucide-react'
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

  // ASSIGNED STATE
  if (currentProject && !isOrphan) {
    return (
      <section
        className="task-detail-card tdv2-section-enter rounded-[22px] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] bg-[color:var(--bg)] p-4 shadow-[var(--shadow-card)]"
        style={{ animationDelay: '20ms' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-600">
              <Folder className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="task-detail-kicker">{t('tasks.drawer.project')}</p>
              <p className="mt-0.5 truncate text-[15px] font-semibold text-[color:var(--text-primary)]">
                {currentProject.title}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-[color-mix(in_srgb,var(--text-primary)_15%,transparent)] px-3 text-[11px] font-semibold"
                >
                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                  {t('tasks.drawer.changeProject')}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[280px] rounded-[18px] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] p-2 shadow-[var(--shadow-card-lg)]"
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
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('tasks.drawer.removeProject')}
              className="h-8 w-8 rounded-full text-[color:var(--text-secondary)] hover:bg-rose-50 hover:text-rose-500"
              onClick={() => select(undefined)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>
    )
  }

  // ORPHAN STATE
  if (isOrphan && currentProject) {
    return (
      <section
        className="task-detail-card tdv2-section-enter rounded-[22px] border border-amber-300/40 bg-amber-50/40 p-4"
        style={{ animationDelay: '20ms' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-amber-100 text-amber-700">
              <Folder className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="task-detail-kicker">{t('tasks.drawer.project')}</p>
              <p className="mt-0.5 truncate text-[15px] font-semibold text-[color:var(--text-primary)]">
                {currentProject.title} {t('tasks.drawer.projectArchivedSuffix')}
              </p>
            </div>
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] font-semibold">
                {t('tasks.drawer.changeProject')}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[280px] rounded-[18px] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] p-2 shadow-[var(--shadow-card-lg)]"
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
        </div>
      </section>
    )
  }

  // UNASSIGNED STATE — eye-catching CTA
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'task-detail-card tdv2-section-enter group flex w-full items-center gap-3 rounded-[22px] border-2 border-dashed border-[color-mix(in_srgb,var(--text-primary)_15%,transparent)] bg-[color:var(--bg-muted)] p-4 text-left transition-all duration-200 hover:border-emerald-400/60 hover:bg-emerald-50/40',
          )}
          style={{ animationDelay: '20ms' }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--bg-elevated)] text-[color:var(--text-secondary)] transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-600">
            <FolderPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[color:var(--text-primary)]">
              {t('tasks.drawer.assignProjectTitle')}
            </p>
            <p className="mt-0.5 text-[12px] text-[color:var(--text-secondary)]">
              {t('tasks.drawer.assignProjectHint')}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-secondary)] transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[320px] rounded-[18px] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] p-2 shadow-[var(--shadow-card-lg)]"
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
            className="h-8 rounded-[12px] border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] bg-[color:var(--bg-muted)] pl-7 text-[12px]"
            autoFocus
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={cn(
          'flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[13px] transition-colors hover:bg-[color:var(--surface-hover)]',
          !currentProjectId && 'bg-[color:var(--surface-hover)] font-semibold',
        )}
      >
        <span className="inline-flex items-center gap-2 text-[color:var(--text-secondary)]">
          <X className="h-3.5 w-3.5" />
          {t('tasks.drawer.projectUnassigned')}
        </span>
        {!currentProjectId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
      </button>
      <div className="max-h-[260px] space-y-0.5 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-[color:var(--text-secondary)]">
            {t('tasks.drawer.noMatchingProjects')}
          </p>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[13px] transition-colors hover:bg-[color:var(--surface-hover)]',
                currentProjectId === project.id && 'bg-[color:var(--surface-hover)] font-semibold',
              )}
            >
              <span className="inline-flex items-center gap-2 truncate">
                <Folder className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="truncate">{project.title}</span>
              </span>
              {currentProjectId === project.id ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default TaskProjectAssignCard
