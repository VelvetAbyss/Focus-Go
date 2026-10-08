import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { BarChart3, Columns3, LayoutGrid, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import TasksBoard from '../TasksBoard'
import TaskWorkspace from '../workspace/TaskWorkspace'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslationKey } from '../../../shared/i18n/types'
import { useTasksViewportProfile } from './tasksViewport'
import { DiscoveryNewBadge } from '../../../shared/ui/DiscoveryNewBadge'
import { markDiscoveryNewTargetSeen } from '../../../shared/discovery/discoveryNewTargetActions'
import '../tasks-workspace.css'
import ActiveIndicator from '../../../shared/motion/ActiveIndicator'
import { SELECTED_TAB } from '../../../shared/motion/indicatorSelectors'

type TasksPageViewMode = 'board' | 'today' | 'list' | 'analytics'

const STORAGE_VIEW_KEY = 'tasks_page_view_mode'

type ViewModeConfig = { key: TasksPageViewMode; icon: React.ComponentType<{ className?: string }>; labelKey: TranslationKey }
// Internal keys predate the labels: 'board' is the card grid with status tabs (卡片),
// 'list' is the workflow board (看板). Stored preferences keep their original keys.
const VIEW_MODES: ViewModeConfig[] = [
  { key: 'board', icon: LayoutGrid, labelKey: 'modules.tasks.board' },
  { key: 'today', icon: ListTodo, labelKey: 'modules.tasks.today' },
  { key: 'list', icon: Columns3, labelKey: 'modules.tasks.list' },
  { key: 'analytics', icon: BarChart3, labelKey: 'modules.tasks.analytics' },
]

const TasksPage = () => {
  const { t } = useI18n()
  const viewportProfile = useTasksViewportProfile()
  const [viewMode, setViewMode] = useState<TasksPageViewMode>(() => {
    if (typeof window === 'undefined') return 'board'
    const stored = window.localStorage.getItem(STORAGE_VIEW_KEY)
    return stored === 'analytics' || stored === 'board' || stored === 'today' || stored === 'list'
      ? stored
      : 'board'
  })

  const switchView = useCallback((nextView: TasksPageViewMode) => {
    setViewMode(nextView)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_VIEW_KEY, nextView)
    if (nextView === 'analytics') markDiscoveryNewTargetSeen('tasks-analytics-tab')
  }, [])

  // The switch reflects the click immediately; the (heavy) view behind it
  // re-renders as a deferred update so the tab never waits on the board.
  const renderedView = useDeferredValue(viewMode)
  // Same element reference across the urgent render, so React skips the board.
  const viewPanel = useMemo(
    () => (
      <div id="tasks-workspace-panel" role="tabpanel" aria-labelledby={`tasks-view-${renderedView}`} className="tasks-page-shell__panel-frame tasks-page__view-panel min-h-0 flex-1">
        {renderedView === 'board' ? <TasksBoard asCard={false} topView="board" /> : <TaskWorkspace view={renderedView} onViewChange={switchView} />}
      </div>
    ),
    [renderedView, switchView],
  )


  return (
    <section
      className="tasks-page flex h-full min-h-0 flex-col"
      data-view={renderedView}
      data-height-band={viewportProfile.heightBand}
      data-ratio-band={viewportProfile.ratioBand}
      style={{ '--tasks-page-viewport-height': `${viewportProfile.viewportHeight}px` } as CSSProperties}
    >
      <div className="tasks-workspace-header">
        <div className="tasks-workspace-heading">
          <h1 className="tasks-page-shell__title text-foreground">{t(viewMode === 'board' ? 'modules.tasks.title' : viewMode === 'today' ? 'tasks.flow.planTitle' : viewMode === 'list' ? 'tasks.flow.boardTitle' : 'tasks.flow.reviewTitle')}</h1>
          <p className="tasks-workspace-intent">{t(viewMode === 'board' ? 'tasks.workspace.boardHint' : viewMode === 'today' ? 'tasks.flow.planHint' : viewMode === 'list' ? 'tasks.flow.boardHint' : 'tasks.flow.reviewHint')}</p>
        </div>

        <div className="tasks-page-shell__switch flex items-center gap-0.5 rounded-lg bg-muted p-0.5" role="tablist" aria-label={t('modules.tasks.viewAria')}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const index = VIEW_MODES.findIndex(item => item.key === viewMode)
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? VIEW_MODES.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + VIEW_MODES.length) % VIEW_MODES.length
            switchView(VIEW_MODES[nextIndex].key)
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
          }}>
            <ActiveIndicator selector={SELECTED_TAB} />
            {VIEW_MODES.map(({ key, icon: Icon, labelKey }) => (
              <button
                key={key}
                type="button"
                id={`tasks-view-${key}`}
                role="tab"
                tabIndex={viewMode === key ? 0 : -1}
                aria-controls="tasks-workspace-panel"
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
                {key === 'analytics' && (
                  <DiscoveryNewBadge target="tasks-analytics-tab" />
                )}
              </button>
            ))}
          </div>
      </div>

      <div aria-busy={viewMode !== renderedView} className="tasks-page-shell__panel min-h-0 flex flex-1">
        {viewPanel}
      </div>
    </section>
  )
}

export default TasksPage
