import { useState } from 'react'
import type { CSSProperties } from 'react'
import { BarChart3, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import TasksBoard from '../TasksBoard'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useTasksViewportProfile } from './tasksViewport'

type TasksPageViewMode = 'board' | 'analytics'

const STORAGE_VIEW_KEY = 'tasks_page_view_mode'

const TasksPage = () => {
  const { t } = useI18n()
  const viewportProfile = useTasksViewportProfile()
  const [viewMode, setViewMode] = useState<TasksPageViewMode>(() => {
    if (typeof window === 'undefined') return 'board'
    const stored = window.localStorage.getItem(STORAGE_VIEW_KEY)
    if (stored === 'list') {
      window.localStorage.setItem(STORAGE_VIEW_KEY, 'analytics')
      return 'analytics'
    }
    return stored === 'analytics' || stored === 'board' ? stored : 'board'
  })

  const switchView = (nextView: TasksPageViewMode) => {
    setViewMode(nextView)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_VIEW_KEY, nextView)
  }

  return (
    <section
      className="tasks-page flex h-full min-h-0 flex-col bg-background"
      data-height-band={viewportProfile.heightBand}
      data-ratio-band={viewportProfile.ratioBand}
      style={{ '--tasks-page-viewport-height': `${viewportProfile.viewportHeight}px` } as CSSProperties}
    >
      <div className="flex items-center justify-between px-6 pb-0 pt-5">
        <div className="flex items-center gap-4">
          <h1 className="tasks-page-shell__title text-xl tracking-tight text-foreground">{t('modules.tasks.title')}</h1>
        </div>

        <div className="tasks-page-shell__switch flex items-center gap-0.5 rounded-lg bg-muted p-0.5" role="tablist" aria-label={t('modules.tasks.viewAria')}>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'board'}
            className={cn(
              'tasks-page-shell__tab flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all',
              viewMode === 'board' ? 'is-active' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => switchView('board')}
          >
            <LayoutGrid className="size-3.5" />
            {t('modules.tasks.board')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'analytics'}
            className={cn(
              'tasks-page-shell__tab flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all',
              viewMode === 'analytics' ? 'is-active' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => switchView('analytics')}
          >
            <BarChart3 className="size-3.5" />
            {t('modules.tasks.analytics')}
          </button>
        </div>
      </div>

      <div className="tasks-page-shell__panel min-h-0 flex flex-1 px-6 pt-4">
        <div className="tasks-page-shell__panel-frame min-h-0 flex-1 pb-8">
          <TasksBoard asCard={false} topView={viewMode} />
        </div>
      </div>
    </section>
  )
}

export default TasksPage
