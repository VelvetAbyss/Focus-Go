import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import Card from '../../../shared/ui/Card'
import { AppNumber } from '../../../shared/ui/AppNumber'

const MOCK_MEDIA = {
  watching: 2,
  completed: 18,
  frames: [
    { label: 'Severance', progress: 0.6 },
    { label: 'Dune', progress: 1 },
    { label: 'Shōgun', progress: 0.3 },
  ],
}

const MediaCard = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <Card
      eyebrow="Watching"
      title="Media"
      className="life-card life-card--media"
      onClick={() => console.log('open full page')}
      style={{ cursor: 'pointer' }}
    >
      <div className="life-card__body">
        {/* Film frames visual */}
        <div className="life-media__frames" aria-hidden="true">
          {MOCK_MEDIA.frames.map((frame, i) => (
            <motion.div
              key={i}
              className="life-media__frame"
              initial={{ opacity: 0, x: -8 }}
              animate={mounted ? { opacity: 1, x: 0 } : {}}
              transition={{
                duration: 0.32,
                delay: 0.06 + i * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="life-media__frame-bar">
                <motion.div
                  className="life-media__frame-progress"
                  initial={{ scaleX: 0 }}
                  animate={mounted ? { scaleX: frame.progress } : {}}
                  transition={{
                    duration: 0.5,
                    delay: 0.2 + i * 0.07,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ transformOrigin: 'left' }}
                />
              </div>
              <span className="life-media__frame-label">{frame.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="life-card__stats">
          <div className="life-stat">
            <span className="life-stat__value">
              <AppNumber value={MOCK_MEDIA.watching} animated />
            </span>
            <span className="life-stat__label">watching now</span>
          </div>
          <div className="life-stat life-stat--muted">
            <span className="life-stat__value">
              <AppNumber value={MOCK_MEDIA.completed} animated />
            </span>
            <span className="life-stat__label">completed</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default MediaCard
