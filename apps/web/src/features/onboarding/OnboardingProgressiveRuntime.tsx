import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../app/routes/routes'
import { useI18n } from '../../shared/i18n/useI18n'
import Coachmark from '../../shared/ui/Coachmark'
import { FEATURE_COACHMARK_ANCHORS, isEveningHour } from '../../shared/onboarding/featureSeen'
import { clearPendingCoachmark, getFeatureSeen, getPendingCoachmark, markFeatureSeen } from './onboarding.runtime'

type VisibleCoachmark =
  | { key: 'focus-entry'; anchor: string }
  | { key: 'diary'; anchor: string }
  | null

const findAnchor = (selectors: string[]) => selectors.find((selector) => document.querySelector(selector)) ?? null

const OnboardingProgressiveRuntime = () => {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [visibleCoachmark, setVisibleCoachmark] = useState<VisibleCoachmark>(null)

  useEffect(() => {
    const syncCoachmark = () => {
      const featureSeen = getFeatureSeen()
      const pendingCoachmark = getPendingCoachmark()

      if (pendingCoachmark === 'focus' && !featureSeen.focus && location.pathname === ROUTES.TASKS) {
        const anchor = findAnchor([FEATURE_COACHMARK_ANCHORS.focus[0]])
        setVisibleCoachmark(anchor ? { key: 'focus-entry', anchor } : null)
        return
      }

      if (!featureSeen.diary && isEveningHour() && (location.pathname === ROUTES.DASHBOARD || location.pathname === ROUTES.DIARY)) {
        const anchor = findAnchor(FEATURE_COACHMARK_ANCHORS.diary)
        setVisibleCoachmark(anchor ? { key: 'diary', anchor } : null)
        return
      }

      setVisibleCoachmark(null)
    }

    syncCoachmark()
    window.addEventListener('focusgo:onboarding-runtime-change', syncCoachmark)
    window.addEventListener('resize', syncCoachmark)
    return () => {
      window.removeEventListener('focusgo:onboarding-runtime-change', syncCoachmark)
      window.removeEventListener('resize', syncCoachmark)
    }
  }, [location.pathname])

  const coachmarkProps = useMemo(() => {
    if (!visibleCoachmark) return null
    if (visibleCoachmark.key === 'focus-entry') {
      return {
        title: t('coachmark.focus.title'),
        description: t('coachmark.focus.description'),
        ctaLabel: t('coachmark.focus.cta'),
        onCta: () => navigate(ROUTES.FOCUS),
        onDismiss: () => clearPendingCoachmark(),
      }
    }
    return {
      title: t('coachmark.diary.title'),
      description: t('coachmark.diary.description'),
      ctaLabel: t('coachmark.diary.cta'),
      onCta: () => {
        markFeatureSeen('diary')
        navigate(ROUTES.REVIEW)
      },
      onDismiss: () => markFeatureSeen('diary'),
    }
  }, [navigate, t, visibleCoachmark])

  if (!visibleCoachmark || !coachmarkProps) return null

  return (
    <Coachmark
      anchor={visibleCoachmark.anchor}
      title={coachmarkProps.title}
      description={coachmarkProps.description}
      ctaLabel={coachmarkProps.ctaLabel}
      onCta={coachmarkProps.onCta}
      onDismiss={() => {
        coachmarkProps.onDismiss()
        setVisibleCoachmark(null)
      }}
    />
  )
}

export default OnboardingProgressiveRuntime
