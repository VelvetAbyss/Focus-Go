import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { TRIP_TEMPLATES, instantiateTemplate } from './templates'
import type { TripTemplate } from '../../data/models/types'
import { PaperCard, InkButton, JournalLabel, SerifHeading, cardBg, ink, muted, pf, subtleBorder, tx } from './ui'
import { useLifeI18n } from '../life/lifeI18n'

export type NewTripChoice =
  | { kind: 'blank' }
  | { kind: 'template'; data: ReturnType<typeof instantiateTemplate> }

type Props = {
  open: boolean
  onClose: () => void
  onPick: (choice: NewTripChoice) => void
}

const Backdrop: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <div
    onClick={onClick}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(40,36,30,0.32)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '8vh 16px 16px',
      zIndex: 100,
    }}
  >
    {children}
  </div>
)

const TemplateCard = ({ template, onPick }: { template: TripTemplate; onPick: () => void }) => {
  const { t } = useLifeI18n()
  return (
  <button
    type="button"
    onClick={onPick}
    style={{
      textAlign: 'left',
      background: cardBg,
      border: `1px solid ${subtleBorder}`,
      borderRadius: 14,
      padding: 16,
      cursor: 'pointer',
      display: 'grid',
      gap: 8,
      transition: 'transform 120ms ease, box-shadow 120ms ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-1px)'
      e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.12)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = ''
      e.currentTarget.style.boxShadow = ''
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span aria-hidden style={{ fontSize: 28 }}>{template.coverEmoji}</span>
      <div>
        <div style={pf(17, 500)}>{template.title}</div>
        <div style={tx(11, 500, muted)}>{template.destination} · {t('life.trips.days', { count: template.days })}</div>
      </div>
    </div>
    {template.summary ? <p style={{ ...tx(12, 400, ink), lineHeight: 1.5 }}>{template.summary}</p> : null}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {template.tags.map((tag) => (
        <span key={tag} style={{ ...tx(10, 600, muted), padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)' }}>{tag}</span>
      ))}
    </div>
  </button>
  )
}

export const NewTripPicker = ({ open, onClose, onPick }: Props) => {
  const { t } = useLifeI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <Backdrop onClick={onClose}>
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label={t('life.trips.picker.aria')}
        style={{
          width: '100%',
          maxWidth: 920,
          background: cardBg,
          border: `1px solid ${subtleBorder}`,
          borderRadius: 18,
          boxShadow: '0 20px 60px rgba(40,36,30,0.25)',
          padding: 24,
          display: 'grid',
          gap: 18,
          maxHeight: '82vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <SerifHeading size={26}>{t('life.trips.picker.title')}</SerifHeading>
            <p style={{ ...tx(13, 400, muted), marginTop: 6 }}>{t('life.trips.picker.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('life.trips.picker.close')}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: muted,
              padding: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <PaperCard style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <JournalLabel>{t('life.trips.picker.startDate')}</JournalLabel>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              ...tx(13, 500, ink),
              border: `1px solid ${subtleBorder}`,
              borderRadius: 10,
              padding: '6px 10px',
              background: 'var(--bg-elevated)',
              outline: 'none',
            }}
          />
          <span style={{ ...tx(11, 500, muted) }}>{t('life.trips.picker.startDateHint')}</span>
        </PaperCard>

        <div>
          <JournalLabel>{t('life.trips.picker.templates')}</JournalLabel>
          <div
            style={{
              marginTop: 10,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {TRIP_TEMPLATES.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onPick={() => onPick({ kind: 'template', data: instantiateTemplate(tpl, { startDate }) })}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6, borderTop: `1px dashed ${subtleBorder}` }}>
          <span style={{ ...tx(12, 500, muted) }}>{t('life.trips.picker.or')}</span>
          {/* The "Generate with AI" button was a placeholder that silently
              created a blank trip; removed until the feature exists. */}
          <InkButton onClick={() => onPick({ kind: 'blank' })}>
            <Plus size={13} /> {t('life.trips.picker.blank')}
          </InkButton>
        </div>
      </div>
    </Backdrop>
  )
}
