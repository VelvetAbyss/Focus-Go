import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectItem, ProjectPerson } from '../../../data/models/types'
import ProgressRing from '../../../shared/ui/ProgressRing'
import Avatar from '../../../shared/ui/Avatar'
import { useProjectsI18n } from '../projectsI18n'
import { EASE } from '../../../shared/motion/tokens'
import { resolveProjectColor } from '../../../shared/design/tokens'

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

const HEALTH_SLUG: Record<Health, 'track' | 'risk' | 'blocked'> = {
  'on-track': 'track',
  'at-risk': 'risk',
  blocked: 'blocked',
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
  const i18n = useProjectsI18n()
  const cardVariant = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE.emphasized } },
  }
  const visibleMembers = members.slice(0, 3)
  const overflow = Math.max(0, members.length - visibleMembers.length)
  const healthLabel =
    project.health === 'on-track' ? i18n.health.onTrack
    : project.health === 'at-risk' ? i18n.health.atRisk
    : i18n.health.blocked
  // One ink meta line (DESIGN.md › Metadata): only what needs action takes a tone.
  const metaItems = [
    <span key="status" className="pj-card-hero__meta-item">
      <span className={`pj-card-hero__health pj-card-hero__health--${HEALTH_SLUG[project.health]}`} aria-hidden />
      {i18n.status[project.status]}
    </span>,
    project.health !== 'on-track' ? (
      <span key="health" className={`pj-card-hero__meta-item pj-card-hero__meta-item--${HEALTH_SLUG[project.health]}`}>
        {healthLabel}
      </span>
    ) : null,
    project.priority ? (
      <span key="priority" className={`pj-card-hero__meta-item pj-card-hero__meta-item--pri-${project.priority}`}>
        {i18n.page.cardPriority.replace('{p}', i18n.filter[project.priority])}
      </span>
    ) : null,
    overdueCount > 0 ? (
      <span key="overdue" className="pj-card-hero__meta-item pj-card-hero__meta-item--blocked">
        {overdueCount} {overdueLabel}
      </span>
    ) : null,
  ].filter(Boolean)

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
      <div className="pj-card-hero__body">
        {/* Header: meta line + title + goal, progress ring on the right */}
        <div className="pj-card-hero__header">
          <div className="pj-card-hero__heading">
            <p className="pj-card-hero__meta" title={healthLabel}>
              {metaItems.map((item, i) => (
                <span key={i} className="pj-card-hero__meta-slot">
                  {i > 0 ? <span className="pj-card-hero__meta-sep" aria-hidden>·</span> : null}
                  {item}
                </span>
              ))}
            </p>
            <h2 className="pj-card-hero__title">
              <span className="pj-project-dot" style={{ background: resolveProjectColor(project) }} aria-hidden />
              {project.title}
            </h2>
            {(project.goal || project.description) ? (
              <p className="pj-card-hero__goal">{project.goal || project.description}</p>
            ) : null}
          </div>
          <ProgressRing progress={project.progress} size={56} strokeWidth={4} label={`${project.progress}%`} />
        </div>

        {/* What's next — the card's one accent mark */}
        {project.nextAction ? (
          <div className="pj-card-hero__next">
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
