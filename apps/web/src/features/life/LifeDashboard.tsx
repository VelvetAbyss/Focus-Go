import { useMemo, useState } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import { motion } from 'motion/react'  // used for card entrance animations
import { useIsBreakpoint } from '../../hooks/use-is-breakpoint'
import { getLifeCards, type DashboardCard } from '../dashboard/registry'
import type { DashboardLayoutItem } from '../../data/models/types'
import './life.css'

const LIFE_LAYOUT_KEY = 'workbench.dashboard.life.layout'

const DEFAULT_LIFE_LAYOUT: DashboardLayoutItem[] = [
  { key: 'books_card', x: 0, y: 0, w: 4, h: 3 },
  { key: 'media_card', x: 4, y: 0, w: 4, h: 3 },
  { key: 'subscriptions_card', x: 0, y: 3, w: 8, h: 2 },
]

const readLifeLayout = (): DashboardLayoutItem[] => {
  try {
    const raw = localStorage.getItem(LIFE_LAYOUT_KEY)
    if (raw) return JSON.parse(raw) as DashboardLayoutItem[]
  } catch {
    return DEFAULT_LIFE_LAYOUT
  }
  return DEFAULT_LIFE_LAYOUT
}

const LifeDashboard = () => {
  const isMobile = useIsBreakpoint('max', 768)
  const columns = isMobile ? 4 : 12
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: window.innerWidth })
  const [layout] = useState<DashboardLayoutItem[]>(readLifeLayout)

  const cards = useMemo(() => getLifeCards(), [])
  const cardsById = useMemo(() => new Map<string, DashboardCard>(cards.map((c) => [c.id, c])), [cards])

  const responsiveLayout = useMemo(() => {
    if (!isMobile) return layout
    return layout.map((item) => {
      const mobileW = Math.max(2, Math.round((item.w / 12) * 4))
      const mobileX = Math.min(4 - mobileW, Math.round((item.x / 12) * 4))
      return { ...item, w: mobileW, x: mobileX }
    })
  }, [isMobile, layout])

  const visibleCards = useMemo(
    () => layout.map((item) => cardsById.get(item.key)).filter((c): c is DashboardCard => Boolean(c)),
    [layout, cardsById]
  )

  return (
    <div className="life-dashboard" ref={containerRef}>
      {mounted && (
        <GridLayout
          className="life-dashboard__grid"
          layout={responsiveLayout.map((item) => ({
            i: item.key,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            minW: isMobile ? 2 : 3,
            minH: 2,
            maxW: columns,
          }))}
          gridConfig={{
            cols: columns,
            rowHeight: 60,
            margin: [18, 18],
            containerPadding: [18, 18],
            maxRows: 100,
          }}
          dragConfig={{ enabled: false }}
          resizeConfig={{ enabled: false }}
          positionStrategy={undefined}
          width={Math.max(width, 320)}
        >
          {visibleCards.map((card, i) => (
            <div key={card.id} className="dashboard__item">
              <motion.div
                style={{ height: '100%' }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.36,
                  delay: 0.06 + i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {card.render()}
              </motion.div>
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  )
}

export default LifeDashboard
