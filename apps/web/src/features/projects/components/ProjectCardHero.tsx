import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectItem, ProjectPerson } from '../../../data/models/types'
import ProgressRing from '../../../shared/ui/ProgressRing'
import Avatar from '../../../shared/ui/Avatar'

type Health = 'on-track' | 'at-risk' | 'blocked'

type ProjectCardHeroProps = {
  project: ProjectItem
  members: ProjectPerson[]
  ownerName?: string
  overdueCount?: number
  nextActionLabel: string
  ownerLabel: string
  timelineLabel: string
  timelineValue: string
  openLabel: string
  overdueLabel: string
  onOpen: () => void
  index: number
  shouldAnimateIn: boolean
}

const healthGradient = (health: Health): string => {
  if (health === 'at-risk') return 'linear-gradient(90deg, #F59E0B 0%, #FB923C 60%, #EF4444 100%)'
  if (health === 'blocked') return 'linear-gradient(90deg, #6B7280 0%, #9CA3AF 50%, #EF4444 100%)'
  return 'linear-gradient(90deg, #10B981 0%, #34D399 60%, #14B8A6 100%)'
}

const ProjectCardHero = ({
  project,
  members,
  ownerName,
  overdueCount = 0,
  nextActionLabel,
  ownerLabel,
  timelineLabel,
  timelineValue,
  openLabel,
  overdueLabel,
  onOpen,
  index,
  shouldAnimateIn,
}: ProjectCardHeroProps) => {
  const cardVariant = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const } },
  }
  const visibleMembers = members.slice(0, 3)
  const overflow = Math.max(0, members.length - visibleMembers.length)

  return (
    <motion.div
      key={project.id}
      className="pj-card-hero"
      style={{ '--pj-i': index } as CSSProperties}
      variants={cardVariant}
      initial={shouldAnimateIn ? 'hidden' : false}
      animate="show"
      whileHover={{ y: -2 }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      {/* Top gradient health band */}
      <span
        className="pj-card-hero__band"
        style={{ background: healthGradient(project.health) }}
        aria-hidden
      />

      <div className="pj-card-hero__body">
        {/* Header row: badges + progress ring */}
        <div className="pj-card-hero__header">
          <div className="pj-card-hero__badges">
            <span className={`pj-badge-status pj-badge-status--${project.status}`}>
              {project.status}
            </span>
            {project.priority ? (
              <span className={`pj-badge-priority pj-badge-priority--${project.priority}`}>
                {project.priority}
              </span>
            ) : null}
            {overdueCount > 0 ? (
              <span className="pj-card-hero__overdue">
                <AlertTriangle size={11} />
                {overdueCount} {overdueLabel}
              </span>
            ) : null}
          </div>
          <ProgressRing progress={project.progress} size={64} strokeWidth={5} label={`${project.progress}%`} />
        </div>

        {/* Title + goal */}
        <h2 className="pj-card-hero__title">{project.title}</h2>
        {(project.goal || project.description) ? (
          <p className="pj-card-hero__goal">{project.goal || project.description}</p>
        ) : null}

        {/* Next action pill — eye-catching */}
        {project.nextAction ? (
          <div className="pj-card-hero__next">
            <span className="pj-card-hero__next-icon" aria-hidden>
              <Sparkles size={12} />
            </span>
            <span className="pj-card-hero__next-label">{nextActionLabel}</span>
            <span className="pj-card-hero__next-text">{project.nextAction}</span>
          </div>
        ) : null}

        {/* Footer: members + meta + arrow */}
        <div className="pj-card-hero__footer">
          <div className="pj-card-hero__members">
            {visibleMembers.length > 0 ? (
              <div className="pj-card-hero__avatars">
                {visibleMembers.map((member) => (
                  <Avatar
                    key={member.id}
                    name={member.name}
                    blobHash={member.avatarBlobHash}
                    seed={member.avatarSeed ?? member.id}
                    size={24}
                    className={cn('ring-2 ring-[color:var(--pd-card-bg,white)]')}
                  />
                ))}
                {overflow > 0 ? (
                  <span className="pj-card-hero__avatar-more">+{overflow}</span>
                ) : null}
              </div>
            ) : (
              <span className="pj-card-hero__owner-only">
                <span className="pj-meta-label">{ownerLabel}</span>
                <span className="pj-meta-val">{ownerName ?? '—'}</span>
              </span>
            )}
            <span className="pj-card-hero__timeline">
              <span className="pj-meta-label">{timelineLabel}</span>
              <span className="pj-meta-val">{timelineValue}</span>
            </span>
          </div>
          <div className="pj-card-hero__cta">
            <span>{openLabel}</span>
            <ArrowRight size={13} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default ProjectCardHero
