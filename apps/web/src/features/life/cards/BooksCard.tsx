import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import Card from '../../../shared/ui/Card'
import { AppNumber } from '../../../shared/ui/AppNumber'

const MOCK_BOOKS = {
  currentlyReading: 3,
  finishedThisMonth: 2,
  spines: [
    { color: '#c8a97e', height: 72 },
    { color: '#a67c52', height: 88 },
    { color: '#d4b896', height: 64 },
  ],
}

const BooksCard = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <Card
      eyebrow="Reading"
      title="Books"
      className="life-card life-card--books"
      onClick={() => console.log('open full page')}
      style={{ cursor: 'pointer' }}
    >
      <div className="life-card__body">
        {/* Book spine visual */}
        <div className="life-books__spines" aria-hidden="true">
          {MOCK_BOOKS.spines.map((spine, i) => (
            <motion.div
              key={i}
              className="life-books__spine"
              style={{ background: spine.color, height: spine.height }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={mounted ? { scaleY: 1, opacity: 1 } : {}}
              transition={{
                duration: 0.38,
                delay: 0.08 + i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
          <motion.div
            className="life-books__spine life-books__spine--ghost"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={mounted ? { scaleY: 1, opacity: 1 } : {}}
            transition={{ duration: 0.38, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Stats */}
        <div className="life-card__stats">
          <div className="life-stat">
            <span className="life-stat__value">
              <AppNumber value={MOCK_BOOKS.currentlyReading} animated />
            </span>
            <span className="life-stat__label">currently reading</span>
          </div>
          <div className="life-stat life-stat--muted">
            <span className="life-stat__value">
              <AppNumber value={MOCK_BOOKS.finishedThisMonth} animated />
            </span>
            <span className="life-stat__label">finished this month</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default BooksCard
