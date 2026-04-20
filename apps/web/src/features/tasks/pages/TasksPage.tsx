import { useState } from 'react'
import type { CSSProperties } from 'react'
import { BarChart3, LayoutGrid, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import TasksBoard from '../TasksBoard'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslationKey } from '../../../shared/i18n/types'
import { useTasksViewportProfile } from './tasksViewport'

type TasksPageViewMode = 'board' | 'today' | 'analytics'

const STORAGE_VIEW_KEY = 'tasks_page_view_mode'

type ViewModeConfig = { key: TasksPageViewMode; icon: React.ComponentType<{ className?: string }>; labelKey: TranslationKey }
const VIEW_MODES: ViewModeConfig[] = [
  { key: 'board', icon: LayoutGrid, labelKey: 'modules.tasks.board' },
  { key: 'today', icon: ListTodo, labelKey: 'modules.tasks.today' },
  { key: 'analytics', icon: BarChart3, labelKey: 'modules.tasks.analytics' },
]

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
    return stored === 'analytics' || stored === 'board' || stored === 'today' ? stored : 'board'
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
            {VIEW_MODES.map(({ key, icon: Icon, labelKey }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={viewMode === key}
                className={cn(
                  'tasks-page-shell__tab flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs',
                  viewMode === key ? 'is-active' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => switchView(key)}
              >
                <Icon className={cn(
                  'size-3.5 transition-transform duration-300',
                  viewMode === key ? 'scale-110' : 'scale-90',
                )} />
                {t(labelKey)}
              </button>
            ))}
          </div>
      </div>

      <div className="tasks-page-shell__panel min-h-0 flex flex-1 px-6 pt-4">
        <div key={viewMode} className="tasks-page-shell__panel-frame tasks-page__view-panel min-h-0 flex-1 pb-8">
          <TasksBoard asCard={false} topView={viewMode} />
        </div>
      </div>
    </section>
  )
}

export default TasksPage
