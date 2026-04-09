import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, Calendar, MapPin, Plus, Trash2, Users, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildTripDetailRoute, ROUTES } from '../../app/routes/routes'
import type { TripRecord } from '../../data/models/types'
import { checklistProgress, fmtUSD, statusColor, tripDuration } from './tripData'
import { tripsRepo } from './tripsRepo'

const paper = '#F5F3F0'
const cardBg = '#FDFAF7'
const ink = '#3A3733'
const muted = 'rgba(58,55,51,0.5)'
const subtleBorder = 'rgba(58,55,51,0.09)'

const tx = (size = 13, weight = 400, color = ink): CSSProperties => ({ fontFamily: 'Inter, sans-serif', fontSize: size, fontWeight: weight, color })
const pf = (size = 16, weight = 500, color = ink): CSSProperties => ({ fontFamily: 'Playfair Display, serif', fontSize: size, fontWeight: weight, color })

const TripsPage = () => {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const loadTrips = async () => {
    setLoading(true)
    try {
      setTrips(await tripsRepo.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTrips()
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const created = await tripsRepo.create()
      navigate(buildTripDetailRoute(created.id))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (tripId: string) => {
    if (!window.confirm('Delete this trip?')) return
    await tripsRepo.remove(tripId)
    await loadTrips()
  }

  return (
    <div style={{ margin: -18, minHeight: '100%', flexGrow: 1, background: paper, backgroundAttachment: 'fixed', padding: 46 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <button type="button" onClick={() => navigate(ROUTES.DASHBOARD)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, ...tx(12, 500, muted) }}>
              <ArrowLeft size={14} /> Dashboard
            </button>
            <h1 style={{ ...pf(34, 500), lineHeight: 1.05 }}>Trips</h1>
            <p style={{ ...tx(13, 400, muted), marginTop: 8 }}>Build trips, open a detail workspace, and keep plans updated automatically.</p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: `1px solid ${subtleBorder}`, borderRadius: 999, background: cardBg, padding: '12px 16px', cursor: 'pointer', ...tx(13, 600) }}
          >
            <Plus size={15} />
            {creating ? 'Creating…' : 'New Trip'}
          </button>
        </div>

        {loading ? <div style={{ ...tx(13, 400, muted), padding: '24px 4px' }}>Loading trips…</div> : null}

        {!loading && trips.length === 0 ? (
          <div style={{ background: cardBg, border: `1px solid ${subtleBorder}`, borderRadius: 24, padding: 28, display: 'grid', gap: 12 }}>
            <h2 style={pf(24, 500)}>No trips yet</h2>
            <p style={tx(13, 400, muted)}>Create the first trip to open the planning workspace.</p>
            <div>
              <button type="button" onClick={handleCreate} disabled={creating} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: 'none', borderRadius: 999, background: ink, color: paper, padding: '12px 16px', cursor: 'pointer', ...tx(13, 600, paper) }}>
                <Plus size={15} />
                {creating ? 'Creating…' : 'Create Trip'}
              </button>
            </div>
          </div>
        ) : null}

        {trips.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 18 }}>
            {trips.map((trip) => {
              const progress = checklistProgress(trip)
              const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
              const status = statusColor(trip.status)
              return (
                <article key={trip.id} onClick={() => navigate(buildTripDetailRoute(trip.id))} style={{ background: cardBg, border: `1px solid ${subtleBorder}`, borderRadius: 24, overflow: 'hidden', boxShadow: '0 1px 8px rgba(58,55,51,0.05)', cursor: 'pointer' }}>
                  <div style={{ position: 'relative', height: 164, overflow: 'hidden' }}>
                    <img src={trip.heroImage} alt={trip.destination || trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.84) saturate(0.76)' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(58,55,51,0.12), rgba(58,55,51,0.6))' }} />
                    <div style={{ position: 'absolute', left: 16, right: 16, top: 16, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ ...tx(10, 600, status.text), background: 'rgba(253,250,247,0.92)', border: `1px solid ${status.border}`, borderRadius: 999, padding: '4px 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{trip.status}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDelete(trip.id)
                        }}
                        style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid rgba(253,250,247,0.32)', background: 'rgba(58,55,51,0.24)', color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{trip.coverEmoji}</span>
                        <span style={tx(11, 600, 'rgba(255,255,255,0.78)')}>{trip.destination || 'Destination pending'}</span>
                      </div>
                      <h2 style={{ ...pf(24, 500, paper), lineHeight: 1.1 }}>{trip.title}</h2>
                    </div>
                  </div>

                  <div style={{ padding: 18, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ ...tx(12, 400, muted), display: 'inline-flex', alignItems: 'center', gap: 7 }}><Calendar size={12} /> {trip.startDate} to {trip.endDate}</span>
                      <span style={tx(12, 500)}>{tripDuration(trip)} days</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ ...tx(12, 400, muted), display: 'inline-flex', alignItems: 'center', gap: 7 }}><Users size={12} /> {trip.travelers} travelers</span>
                      <span style={{ ...tx(12, 500), display: 'inline-flex', alignItems: 'center', gap: 6 }}><Wallet size={12} /> {fmtUSD(trip.budgetPlanned)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ ...tx(12, 400, muted), display: 'inline-flex', alignItems: 'center', gap: 7 }}><MapPin size={12} /> {trip.destination || 'Destination pending'}</span>
                      <span style={tx(12, 500)}>{progress.done}/{progress.total || 0}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: 'rgba(58,55,51,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#6EAB7A' : ink }} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default TripsPage
