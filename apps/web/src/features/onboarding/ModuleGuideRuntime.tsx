import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../app/routes/routes'
import { useI18n } from '../../shared/i18n/useI18n'
import ModuleGuideOverlay from '../../shared/ui/ModuleGuideOverlay'
import { isEveningHour } from '../../shared/onboarding/featureSeen'
import { completeModuleGuide, dismissModuleGuide, markModuleGuideSeen, shouldShowModuleGuide } from './moduleGuide.runtime'
import type { ModuleGuideKey } from './moduleGuide.types'
import { useSyncExternalStore } from 'react'
import { getModuleGuideSnapshot, subscribeModuleGuideRuntime } from './moduleGuide.runtime'

// ─── Module config ────────────────────────────────────────────────────────────

type ModuleConfig = {
  module: ModuleGuideKey
  routes: string[]
  anchor: string | null
  titleKey: string
  descriptionKey: string
  ctaLabelKey?: string
  ctaRoute?: string
  /** If provided, only show during evening hours (≥ 18:00) */
  eveningOnly?: boolean
  /** Weaker (daytime) variant title/description keys */
  daytimeTitleKey?: string
  daytimeDescriptionKey?: string
}

const MODULE_CONFIGS: ModuleConfig[] = [
  {
    module: 'dashboard',
    routes: [ROUTES.DASHBOARD],
    anchor: '[data-guide-anchor="dashboard"]',
    titleKey: 'guide.dashboard.title',
    descriptionKey: 'guide.dashboard.description',
    ctaLabelKey: 'guide.dashboard.cta',
  },
  {
    module: 'tasks',
    routes: [ROUTES.TASKS],
    anchor: '[data-coachmark-anchor="tasks-entry"]',
    titleKey: 'guide.tasks.title',
    descriptionKey: 'guide.tasks.description',
    ctaLabelKey: 'guide.tasks.cta',
  },
  {
    module: 'focus',
    routes: [ROUTES.FOCUS],
    anchor: '[data-coachmark-anchor="focus-page"]',
    titleKey: 'guide.focus.title',
    descriptionKey: 'guide.focus.description',
    ctaLabelKey: 'guide.focus.cta',
  },
  {
    module: 'diary',
    routes: [ROUTES.DIARY, ROUTES.REVIEW],
    anchor: '[data-coachmark-anchor="diary-page"]',
    titleKey: 'guide.diary.title',
    descriptionKey: 'guide.diary.description',
    ctaLabelKey: 'guide.diary.cta',
    daytimeTitleKey: 'guide.diary.daytimeTitle',
    daytimeDescriptionKey: 'guide.diary.daytimeDescription',
  },
  {
    module: 'calendar',
    routes: [ROUTES.CALENDAR],
    anchor: '[data-guide-anchor="calendar"]',
    titleKey: 'guide.calendar.title',
    descriptionKey: 'guide.calendar.description',
    ctaLabelKey: 'guide.calendar.cta',
  },
  {
    module: 'habits',
    routes: [ROUTES.HABITS],
    anchor: '[data-guide-anchor="habits"]',
    titleKey: 'guide.habits.title',
    descriptionKey: 'guide.habits.description',
    ctaLabelKey: 'guide.habits.cta',
  },
  {
    module: 'notes',
    routes: [ROUTES.NOTE],
    anchor: '[data-guide-anchor="notes"]',
    titleKey: 'guide.notes.title',
    descriptionKey: 'guide.notes.description',
    ctaLabelKey: 'guide.notes.cta',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

const ModuleGuideRuntime = () => {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  // Subscribe to module guide state so the component re-renders on changes
  useSyncExternalStore(subscribeModuleGuideRuntime, getModuleGuideSnapshot, getModuleGuideSnapshot)

  // Active config for current route
  const [activeConfig, setActiveConfig] = useState<ModuleConfig | null>(null)

  useEffect(() => {
    // Small delay so lazy-loaded route children can mount and register their anchor elements
    const timer = setTimeout(() => {
      const pathname = location.pathname
      const config = MODULE_CONFIGS.find((c) => c.routes.includes(pathname)) ?? null
      if (!config) {
        setActiveConfig(null)
        return
      }
      if (!shouldShowModuleGuide(config.module)) {
        setActiveConfig(null)
        return
      }
      setActiveConfig(config)
      markModuleGuideSeen(config.module)
    }, 120)
    return () => clearTimeout(timer)
  }, [location.pathname])

  if (!activeConfig) return null

  const isEvening = isEveningHour()
  const isDiary = activeConfig.module === 'diary'

  const title = isDiary && !isEvening && activeConfig.daytimeTitleKey
    ? t(activeConfig.daytimeTitleKey as Parameters<typeof t>[0])
    : t(activeConfig.titleKey as Parameters<typeof t>[0])

  const description = isDiary && !isEvening && activeConfig.daytimeDescriptionKey
    ? t(activeConfig.daytimeDescriptionKey as Parameters<typeof t>[0])
    : t(activeConfig.descriptionKey as Parameters<typeof t>[0])

  const ctaLabel = activeConfig.ctaLabelKey ? t(activeConfig.ctaLabelKey as Parameters<typeof t>[0]) : undefined

  const handleCta = activeConfig.ctaRoute
    ? () => {
        completeModuleGuide(activeConfig.module)
        navigate(activeConfig.ctaRoute!)
      }
    : undefined

  const handleDismiss = () => {
    dismissModuleGuide(activeConfig.module)
    setActiveConfig(null)
  }

  return (
    <ModuleGuideOverlay
      anchor={activeConfig.anchor}
      title={title}
      description={description}
      ctaLabel={ctaLabel}
      onCta={handleCta}
      onDismiss={handleDismiss}
    />
  )
}

export default ModuleGuideRuntime
