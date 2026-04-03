import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import Card from '../../../shared/ui/Card'
import { AppNumber, AppNumberGroup } from '../../../shared/ui/AppNumber'

const MOCK_SUBS = {
  monthlyTotal: 127,
  activeCount: 7,
  dots: [
    { label: 'Netflix', color: '#e50914' },
    { label: 'Spotify', color: '#1db954' },
    { label: 'Claude', color: '#d97706' },
    { label: 'iCloud', color: '#147efb' },
    { label: 'YouTube', color: '#ff0000' },
    { label: 'Figma', color: '#a259ff' },
    { label: 'GitHub', color: '#6e5494' },
  ],
}

const SubscriptionsCard = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <Card
      eyebrow="Monthly"
      title="Subscriptions"
      className="life-card life-card--subs"
      onClick={() => console.log('open full page')}
      style={{ cursor: 'pointer' }}
    >
      <div className="life-card__body life-card__body--subs">
        {/* Big number */}
        <motion.div
          className="life-subs__total"
          initial={{ opacity: 0, y: 6 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.36, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <AppNumberGroup>
            <span className="life-subs__currency">$</span>
            <AppNumber
              value={MOCK_SUBS.monthlyTotal}
              animated
              className="life-subs__amount"
            />
            <span className="life-subs__period">/mo</span>
          </AppNumberGroup>
        </motion.div>

        {/* Service dots */}
        <div className="life-subs__dots" aria-label={`${MOCK_SUBS.activeCount} active subscriptions`}>
          {MOCK_SUBS.dots.map((dot, i) => (
            <motion.span
              key={dot.label}
              className="life-subs__dot"
              style={{ background: dot.color }}
              title={dot.label}
              initial={{ scale: 0, opacity: 0 }}
              animate={mounted ? { scale: 1, opacity: 1 } : {}}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 24,
                delay: 0.12 + i * 0.04,
              }}
            />
          ))}
        </div>

        {/* Stat */}
        <div className="life-card__stats life-card__stats--inline">
          <div className="life-stat">
            <span className="life-stat__value">
              <AppNumber value={MOCK_SUBS.activeCount} animated />
            </span>
            <span className="life-stat__label">active services</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default SubscriptionsCard
