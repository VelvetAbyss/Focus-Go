import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ROUTES } from '../../../app/routes/routes'
import { useLabs } from '../LabsContext'
import { useLabsI18n } from '../labsI18n'
import type { FeatureCatalogItem } from '../labsApi'
import { useToast } from '../../../shared/ui/toast/toast'

const LabsPage = () => {
  const i18n = useLabsI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const { ready, catalog, subscription, install, remove, restore, upgradeMock } = useLabs()
  const [removingFeature, setRemovingFeature] = useState<FeatureCatalogItem | null>(null)

  if (!ready) {
    return <div className="module-page-shell">Loading Labs…</div>
  }

  const available = catalog.filter((item) => item.state === 'available')
  const installed = catalog.filter((item) => item.state === 'installed')
  const removed = catalog.filter((item) => item.state === 'removed')

  const handleUpgrade = async () => {
    await upgradeMock()
    toast.push({ variant: 'success', message: i18n.toast.upgraded })
  }

  return (
    <div className="labs-page">
      <header className="labs-page__header">
        <div>
          <h1>{i18n.labs.title}</h1>
          <p className="muted">{i18n.labs.subtitle}</p>
        </div>
        <Badge variant="secondary">{subscription?.tier === 'premium' ? 'Premium' : 'Free'}</Badge>
      </header>

      <section className="labs-page__section" aria-label={i18n.labs.available}>
        <h2>{i18n.labs.available}</h2>
        <div className="labs-page__grid">
          {available.map((feature) => (
            <Card key={feature.featureKey}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {feature.comingSoon ? <Badge variant="outline">{i18n.labs.comingSoon}</Badge> : null}
                {feature.requiresPremium ? <Badge variant="outline">{i18n.labs.premiumLocked}</Badge> : null}
              </CardContent>
              <CardFooter className="labs-page__card-actions">
                {feature.requiresPremium ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button>{i18n.labs.upgrade}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{i18n.labs.upgradeTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{i18n.labs.upgradeDesc}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{i18n.labs.cancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleUpgrade()}>{i18n.labs.upgradeConfirm}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    disabled={feature.comingSoon}
                    onClick={() => {
                      void install(feature.featureKey).then(() => {
                        toast.push({ variant: 'success', message: i18n.toast.installed })
                        if (feature.featureKey === 'rss') navigate(ROUTES.RSS)
                        if (feature.featureKey === 'habit-tracker') navigate(ROUTES.HABITS)
                      })
                    }}
                  >
                    {i18n.labs.install}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="labs-page__section" aria-label={i18n.labs.installed}>
        <h2>{i18n.labs.installed}</h2>
        <div className="labs-page__grid">
          {installed.map((feature) => (
            <Card key={feature.featureKey}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardFooter className="labs-page__card-actions">
                {feature.featureKey === 'rss' ? (
                  feature.requiresPremium ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button>{i18n.labs.upgrade}</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{i18n.labs.upgradeTitle}</AlertDialogTitle>
                          <AlertDialogDescription>{i18n.labs.upgradeDesc}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{i18n.labs.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleUpgrade()}>{i18n.labs.upgradeConfirm}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button asChild>
                      <Link to={ROUTES.RSS}>{i18n.labs.openRss}</Link>
                    </Button>
                  )
                ) : feature.featureKey === 'habit-tracker' ? (
                  feature.requiresPremium ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button>{i18n.labs.upgrade}</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{i18n.labs.upgradeTitle}</AlertDialogTitle>
                          <AlertDialogDescription>{i18n.labs.upgradeDesc}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{i18n.labs.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleUpgrade()}>{i18n.labs.upgradeConfirm}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button asChild>
                      <Link to={ROUTES.HABITS}>{i18n.labs.openHabits}</Link>
                    </Button>
                  )
                ) : (
                  <Button disabled>{i18n.labs.comingSoon}</Button>
                )}
                <Button variant="outline" onClick={() => setRemovingFeature(feature)}>
                  {i18n.labs.remove}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="labs-page__section" aria-label={i18n.labs.removed}>
        <h2>{i18n.labs.removed}</h2>
        <div className="labs-page__grid">
          {removed.map((feature) => (
            <Card key={feature.featureKey}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardFooter className="labs-page__card-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    void restore(feature.featureKey)
                    toast.push({ variant: 'success', message: i18n.toast.restored })
                  }}
                >
                  {i18n.labs.restore}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

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
