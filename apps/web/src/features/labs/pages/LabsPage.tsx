import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Archive, LayoutGrid, Sparkles, Brain, Zap, Target, Share2, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ROUTES } from '../../../app/routes/routes'
import { useLabs } from '../LabsContext'
import { useLabsI18n } from '../labsI18n'
import type { FeatureCatalogItem } from '../labsApi'
import { useToast } from '../../../shared/ui/toast/toast'
import { useUpgradeModal } from '../UpgradeModalContext'

const FEATURE_ICONS: Record<string, React.ElementType> = {
  'ai-digest': Brain,
  'automation': Zap,
  'habit-tracker': Target,
  'mind-map': Share2,
}

const LabsPage = () => {
  const i18n = useLabsI18n()
  const toast = useToast()
  const { ready, catalog, subscription, install, remove, restore } = useLabs()
  const { openModal: openUpgradeModal } = useUpgradeModal()
  const [removingFeature, setRemovingFeature] = useState<FeatureCatalogItem | null>(null)

  if (!ready) {
    return <div className="module-page-shell">Loading Labs…</div>
  }

  const available = catalog.filter((item) => item.state === 'available')
  const installed = catalog.filter((item) => item.state === 'installed')
  const removed = catalog.filter((item) => item.state === 'removed')

  return (
    <div className="labs-page">
      <header className="labs-page__header">
        <div className="labs-page__header-inner">
          <div className="labs-page__intro">
            <div className="labs-page__eyebrow-row">
              <span className="labs-page__eyebrow">
                {subscription?.tier === 'premium' ? 'Premium Labs' : 'Labs'}
              </span>
              <Badge variant="secondary" className="labs-page__tier-badge">
                {subscription?.tier === 'premium' ? 'Premium' : 'Free'}
              </Badge>
            </div>
            <h1 className="labs-page__title">{i18n.labs.title}</h1>
            <p className="labs-page__subtitle">{i18n.labs.subtitle}</p>
          </div>
          <div className="labs-page__stats" aria-label="Labs summary">
            <div className="labs-page__stat">
              <Sparkles size={14} strokeWidth={1.8} />
              <span className="labs-page__stat-value">{available.length}</span>
              <span className="labs-page__stat-label">{i18n.labs.available}</span>
            </div>
            <div className="labs-page__stat">
              <LayoutGrid size={14} strokeWidth={1.8} />
              <span className="labs-page__stat-value">{installed.length}</span>
              <span className="labs-page__stat-label">{i18n.labs.installed}</span>
            </div>
            <div className="labs-page__stat">
              <Archive size={14} strokeWidth={1.8} />
              <span className="labs-page__stat-value">{removed.length}</span>
              <span className="labs-page__stat-label">{i18n.labs.removed}</span>
            </div>
          </div>
        </div>
      </header>

      {available.length > 0 && (
        <section className="labs-page__section" aria-label={i18n.labs.available}>
          <div className="labs-page__section-label">
            <span>{i18n.labs.available}</span>
            <span className="labs-page__section-count">{available.length}</span>
          </div>
          <div className="labs-page__grid--available">
            {available.map((feature, i) => {
              const Icon = FEATURE_ICONS[feature.featureKey] ?? Sparkles
              return (
                <div
                  key={feature.featureKey}
                  className="labs-card"
                  style={{ '--card-index': i } as React.CSSProperties}
                >
                  <div className="labs-card__icon-zone">
                    <div className="labs-card__icon-wrap">
                      <Icon size={22} strokeWidth={1.5} />
                    </div>
                    {feature.comingSoon && (
                      <span className="labs-card__chip labs-card__chip--soon">{i18n.labs.comingSoon}</span>
                    )}
                    {feature.requiresPremium && !feature.comingSoon && (
                      <span className="labs-card__chip labs-card__chip--premium">{i18n.labs.premiumLocked}</span>
                    )}
                  </div>
                  <div className="labs-card__body">
                    <h3 className="labs-card__title">{feature.title}</h3>
                    <p className="labs-card__desc">{feature.description}</p>
                  </div>
                  <div className="labs-card__foot">
                    {feature.requiresPremium ? (
                      <Button size="sm" onClick={() => openUpgradeModal(feature.title)}>
                        {i18n.labs.upgrade}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={feature.comingSoon}
                        onClick={() => {
                          void install(feature.featureKey).then(() => {
                            toast.push({ variant: 'success', message: i18n.toast.installed })
                          })
                        }}
                      >
                        {feature.comingSoon ? i18n.labs.comingSoon : i18n.labs.install}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {installed.length > 0 && (
        <section className="labs-page__section" aria-label={i18n.labs.installed}>
          <div className="labs-page__section-label">
            <span>{i18n.labs.installed}</span>
            <span className="labs-page__section-count">{installed.length}</span>
          </div>
          <div className="labs-page__list">
            {installed.map((feature, i) => {
              const Icon = FEATURE_ICONS[feature.featureKey] ?? LayoutGrid
              return (
                <div
                  key={feature.featureKey}
                  className="labs-row labs-row--installed rounded-xl"
                  style={{ '--card-index': i } as React.CSSProperties}
                >
                  <div className="labs-row__icon">
                    <Icon size={16} strokeWidth={1.6} />
                  </div>
                  <div className="labs-row__info">
                    <span className="labs-row__title">{feature.title}</span>
                    <span className="labs-row__desc">{feature.description}</span>
                  </div>
                  <div className="labs-row__actions">
                    {feature.featureKey === 'habit-tracker' ? (
                      feature.requiresPremium ? (
                        <Button size="sm" onClick={() => openUpgradeModal(feature.title)}>
                          {i18n.labs.upgrade}
                        </Button>
                      ) : (
                        <Button size="sm" asChild>
                          <Link to={ROUTES.HABITS}>{i18n.labs.openHabits}</Link>
                        </Button>
                      )
                    ) : (
                      <Button size="sm" disabled>{i18n.labs.comingSoon}</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setRemovingFeature(feature)}>
                      {i18n.labs.remove}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {removed.length > 0 && (
        <section className="labs-page__section" aria-label={i18n.labs.removed}>
          <div className="labs-page__section-label">
            <span>{i18n.labs.removed}</span>
            <span className="labs-page__section-count">{removed.length}</span>
          </div>
          <div className="labs-page__list labs-page__list--removed">
            {removed.map((feature, i) => {
              const Icon = FEATURE_ICONS[feature.featureKey] ?? Archive
              return (
                <div
                  key={feature.featureKey}
                  className="labs-row labs-row--removed"
                  style={{ '--card-index': i } as React.CSSProperties}
                >
                  <div className="labs-row__icon">
                    <Icon size={16} strokeWidth={1.6} />
                  </div>
                  <div className="labs-row__info">
                    <span className="labs-row__title">{feature.title}</span>
                    <span className="labs-row__desc">{feature.description}</span>
                  </div>
                  <div className="labs-row__actions">
                    {feature.comingSoon ? (
                      <Button size="sm" variant="secondary" disabled>{i18n.labs.comingSoon}</Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void restore(feature.featureKey)
                          toast.push({ variant: 'success', message: i18n.toast.restored })
                        }}
                      >
                        <RotateCcw size={13} strokeWidth={2} />
                        {i18n.labs.restore}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <AlertDialog open={Boolean(removingFeature)} onOpenChange={(open: boolean) => (open ? null : setRemovingFeature(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.labs.removeTitle}</AlertDialogTitle>
            <AlertDialogDescription>{i18n.labs.removeDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.labs.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!removingFeature) return
                void remove(removingFeature.featureKey)
                toast.push({ variant: 'info', message: i18n.toast.removed })
                setRemovingFeature(null)
              }}
            >
              {i18n.labs.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default LabsPage
