import { Lightbulb, X } from 'lucide-react'
import { useDiscoveryHint } from '../discovery/useDiscoveryHint'
import { HINTS, type HintId, type HintRegion } from '../discovery/hints'
import { useI18n } from '../i18n/useI18n'
import './DiscoveryHint.css'

interface Props {
  region: HintRegion
}

/**
 * Renders the highest-priority undismissed hint for a given region.
 * Returns null when no hint is active — drop-in, takes no space.
 */
export function DiscoveryHint({ region }: Props) {
  const { t } = useI18n()
  const { activeHintId, dismiss } = useDiscoveryHint(region)

  if (!activeHintId) return null

  const hint = HINTS[activeHintId as HintId]

  return (
    <div className="discovery-hint" role="status" aria-live="polite">
      <Lightbulb className="discovery-hint__icon" aria-hidden="true" size={15} />
      <span className="discovery-hint__text">{t(hint.i18nKey)}</span>
      <button
        className="discovery-hint__dismiss"
        onClick={() => dismiss(activeHintId as HintId)}
        aria-label={t('discovery.hint.dismiss')}
        type="button"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  )
}
