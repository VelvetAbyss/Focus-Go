import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Download, MapPin, X } from 'lucide-react'
import type { TripItineraryDay, TripRecord } from '../../../data/models/types'
import type { LifeTranslate } from '../../life/lifeI18n'
import { tripAttachmentsRepo } from '../tripAttachmentsRepo'
import { dayJournalKey, journalEntryFor, journaledDayCount, upsertJournalEntry } from '../tripJournal'
import { cardBg, ink, muted, paper, pf, subtleBorder, textareaStyle, tx } from '../ui'

type Props = {
  trip: TripRecord
  t: LifeTranslate
  onPatch: (patch: Partial<TripRecord>) => void
  onClose: () => void
  onExport: () => void
}

const MOODS = ['🌞', '⛅', '🌧️', '😍', '😌', '🤩', '😴', '🍜']

/** Photos uploaded against a day's activities, rendered as a thumbnail row. */
const DayPhotos = ({ day }: { day: TripItineraryDay }) => {
  const ids = useMemo(
    () => day.items.flatMap((item) => item.attachmentIds ?? []),
    [day],
  )
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    if (!ids.length) { setUrls([]); return }
    let cancelled = false
    const made: string[] = []
    void (async () => {
      const metas = await tripAttachmentsRepo.listByIds(ids)
      const images = metas.filter((m) => m.kind === 'image')
      for (const meta of images) {
        const blob = await tripAttachmentsRepo.getBlob(meta.id)
        if (!blob) continue
        made.push(URL.createObjectURL(blob))
      }
      if (cancelled) { made.forEach(URL.revokeObjectURL); return }
      setUrls(made)
    })()
    return () => { cancelled = true; made.forEach(URL.revokeObjectURL) }
  }, [ids])

  if (!urls.length) return null
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
      {urls.map((url, i) => (
        <img
          key={i}
          src={url}
          alt=""
          style={{ width: 132, height: 96, objectFit: 'cover', borderRadius: 10, border: `1px solid ${subtleBorder}`, boxShadow: '0 1px 5px rgba(0, 0, 0, 0.10)' }}
        />
      ))}
    </div>
  )
}

/** Full-screen post-trip journal: day-by-day activities, photos, reflections. */
export const JourneyMode = ({ trip, t, onPatch, onClose, onExport }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const written = journaledDayCount(trip)

  const setEntry = (key: string, patch: Parameters<typeof upsertJournalEntry>[2]) =>
    onPatch({ journal: upsertJournalEntry(trip.journal, key, patch) })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: paper, overflowY: 'auto' }}>
      {/* Sticky top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 24px', background: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${subtleBorder}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, ...tx(12, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          <BookOpen size={15} /> {t('life.trips.journey.title')}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onExport}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${subtleBorder}`, background: cardBg, borderRadius: 999, padding: '8px 14px', cursor: 'pointer', ...tx(12, 600, ink) }}
          >
            <Download size={14} /> {t('life.trips.journey.exportMemory')}
          </button>
          <button
            onClick={onClose}
            aria-label={t('life.trips.journey.close')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${subtleBorder}`, background: 'transparent', borderRadius: 999, padding: '8px 14px', cursor: 'pointer', ...tx(12, 600, muted) }}
          >
            <X size={14} /> {t('life.trips.journey.close')}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 96px' }}>
        {/* Cover */}
        <div style={{ position: 'relative', height: 260, borderRadius: 24, overflow: 'hidden', margin: '28px 0 36px' }}>
          {trip.heroImage ? (
            <img src={trip.heroImage} alt={trip.destination || trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.74) saturate(0.7)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #6E7F73, #3A4A42)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(40,36,30,0.7) 100%)' }} />
          <div style={{ position: 'absolute', left: 28, bottom: 24, right: 28 }}>
            <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>{trip.coverEmoji || '✈️'}</div>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 34, fontWeight: 600, color: 'rgba(255,255,255,0.97)', lineHeight: 1.1 }}>{trip.title}</p>
            <p style={{ ...tx(13, 400, 'rgba(255,255,255,0.78)'), marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              {trip.destination ? <><MapPin size={13} /> {trip.destination} · </> : null}
              {trip.startDate} — {trip.endDate}
            </p>
          </div>
        </div>

        <p style={{ ...tx(12, 500, muted), marginBottom: 28 }}>
          {t('life.trips.journey.summary', { count: written, total: trip.itinerary.length })}
        </p>

        {/* Day by day */}
        {trip.itinerary.length === 0 ? (
          <div style={{ display: 'grid', gap: 8, justifyItems: 'center', padding: '60px 0', textAlign: 'center' }}>
            <BookOpen size={28} style={{ opacity: 0.35 }} />
            <p style={pf(18, 600, ink)}>{t('life.trips.journey.emptyTitle')}</p>
            <p style={tx(13, 400, muted)}>{t('life.trips.journey.emptyDesc')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 36 }}>
            {trip.itinerary.map((day) => {
              const key = dayJournalKey(day)
              const entry = journalEntryFor(trip, key)
              return (
                <article key={key} style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: `1px solid ${subtleBorder}`, paddingBottom: 10 }}>
                    <span style={pf(22, 600, ink)}>{t('life.trips.card.dayOf', { count: day.day })}</span>
                    <span style={{ ...tx(13, 500, ink), flex: 1 }}>{day.label}</span>
                    <span style={tx(12, 400, muted)}>{day.date}</span>
                  </div>

                  {/* Actual activities (read-only) */}
                  {day.items.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {day.items.map((item) => {
                        const time = item.startTime ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ''}` : item.time
                        return (
                          <div key={item.id} style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                            <span style={{ ...tx(12, 500, muted), width: 92, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{time || '—'}</span>
                            <div style={{ display: 'grid', gap: 2 }}>
                              <span style={tx(14, 500, ink)}>{item.title || '—'}</span>
                              {item.location || item.geo?.address ? (
                                <span style={{ ...tx(12, 400, muted), display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <MapPin size={11} /> {item.location || item.geo?.address}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p style={tx(12, 400, muted)}>{t('life.trips.journey.noActivities')}</p>
                  )}

                  {/* Photos */}
                  <DayPhotos day={day} />

                  {/* Reflection */}
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {MOODS.map((mood) => {
                        const active = entry?.mood === mood
                        return (
                          <button
                            key={mood}
                            onClick={() => setEntry(key, { mood: active ? undefined : mood })}
                            aria-pressed={active}
                            style={{ fontSize: 16, lineHeight: 1, padding: '5px 8px', borderRadius: 9, cursor: 'pointer', background: active ? 'rgba(124,90,58,0.14)' : 'transparent', border: `1px solid ${active ? 'rgba(124,90,58,0.35)' : subtleBorder}`, opacity: active ? 1 : 0.6 }}
                          >
                            {mood}
                          </button>
                        )
                      })}
                    </div>
                    <textarea
                      value={entry?.body ?? ''}
                      onChange={(e) => setEntry(key, { body: e.target.value })}
                      placeholder={t('life.trips.journey.reflectionPlaceholder')}
                      style={{ ...textareaStyle, minHeight: 92, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 15, lineHeight: 1.7 }}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default JourneyMode
