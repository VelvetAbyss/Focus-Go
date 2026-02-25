import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { triggerTabGroupSwitchAnimation, triggerTabPressAnimation } from '../../../shared/ui/tabPressAnimation'
import TasksBoard from '../TasksBoard'
import { useI18n } from '../../../shared/i18n/useI18n'

type TasksPageViewMode = 'board' | 'list'

const STORAGE_VIEW_KEY = 'tasks_page_view_mode'

const TasksPage = () => {
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<TasksPageViewMode>(() => {
    if (typeof window === 'undefined') return 'board'
    const stored = window.localStorage.getItem(STORAGE_VIEW_KEY)
    return stored === 'list' || stored === 'board' ? stored : 'board'
  })

  const tabs: { key: TasksPageViewMode; label: string }[] = [
    { key: 'board', label: t('modules.tasks.board') },
    { key: 'list', label: t('modules.tasks.list') },
  ]

  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex((tab) => tab.key === viewMode)
    return idx >= 0 ? idx : 0
  }, [tabs, viewMode])

  const tabMotionStyle = useMemo(
    () =>
      ({
        '--tab-count': `${tabs.length}`,
        '--tab-active-index': `${activeIndex}`,
      }) as CSSProperties,
    [activeIndex, tabs.length]
  )

  const handleSwitchView = (nextView: TasksPageViewMode) => {
    setViewMode(nextView)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_VIEW_KEY, nextView)
  }

  return (
    <section className="tasks-page">
      <header className="tasks-page-shell__header">
        <h1 className="tasks-page-shell__title">{t('modules.tasks.title')}</h1>

        <div className="tasks-page-shell__switch tab-motion-group" role="tablist" aria-label={t('modules.tasks.viewAria')} style={tabMotionStyle}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={viewMode === tab.key}
              className={`tasks-page-shell__tab tab-motion-tab ${viewMode === tab.key ? 'is-active' : ''}`}
              onClick={(event) => {
                triggerTabPressAnimation(event.currentTarget)
                triggerTabGroupSwitchAnimation(event.currentTarget)
                handleSwitchView(tab.key)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="tasks-page-shell__panel">
        {viewMode === 'board' ? (
          <TasksBoard asCard={false} />
        ) : (
          <section className="tasks-page-shell__list-placeholder" aria-label={t('modules.tasks.listScaffoldAria')}>
            <h2>{t('modules.tasks.listScaffoldTitle')}</h2>
            <p className="muted">{t('modules.tasks.listScaffoldDescription')}</p>
          </section>
        )}
      </div>
    </section>
  )
}

export default TasksPage
