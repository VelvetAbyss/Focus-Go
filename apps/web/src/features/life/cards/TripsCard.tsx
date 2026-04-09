import { useEffect, useState } from 'react'
import { Calendar, ChevronRight, MapPin, Users, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildTripDetailRoute, ROUTES } from '../../../app/routes/routes'
import type { TripRecord } from '../../../data/models/types'
import { tripsRepo } from '../../trips/tripsRepo'
import { checklistProgress, fmtUSD, statusColor, tripDuration } from '../../trips/tripData'

const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TripsCard = () => {
  const navigate = useNavigate()
  const [trip, setTrip] = useState<TripRecord | null>(null)

  useEffect(() => {
    void tripsRepo.getDashboardTrip().then(setTrip)
  }, [])

  if (!trip) return null

  const sc = statusColor(trip.status)
  const { done, total } = checklistProgress(trip)
  const progress = total === 0 ? 0 : Math.round((done / total) * 100)
  const duration = tripDuration(trip)
  const startMonth = months[Number(trip.startDate.split('-')[1])]
  const startDay = Number(trip.startDate.split('-')[2])
  const endDay = Number(trip.endDate.split('-')[2])

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 24,
        cursor: 'pointer',
        background: '#FDFAF7',
        border: '1px solid rgba(58,55,51,0.10)',
        boxShadow: '0 2px 16px rgba(58,55,51,0.07), 0 1px 4px rgba(58,55,51,0.05)',
        height: '100%',
      }}
      onClick={() => navigate(trip ? buildTripDetailRoute(trip.id) : ROUTES.TRIPS)}
    >
      <div style={{ position: 'relative', height: 108, overflow: 'hidden' }}>
        <img src={trip.heroImage} alt={trip.destination} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.82) saturate(0.75)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(58,55,51,0.10) 0%, rgba(58,55,51,0.55) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={10} color="rgba(255,255,255,0.80)" />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.04em' }}>{trip.destination}</span>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', color: sc.text, background: 'rgba(253,250,247,0.90)', border: `1px solid ${sc.border}`, borderRadius: 999, padding: '3px 8px', backdropFilter: 'blur(4px)' }}>
            {trip.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px 14px', borderBottom: '1px solid rgba(58,55,51,0.07)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13 }}>{trip.coverEmoji}</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(58,55,51,0.38)' }}>Trips</span>
          </div>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 500, color: '#3A3733', lineHeight: 1.2 }}>{trip.title}</h3>
        </div>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(58,55,51,0.38)' }}>
          <ChevronRight size={15} />
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'grid', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={11} color="rgba(58,55,51,0.35)" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(58,55,51,0.60)' }}>{`${startMonth} ${startDay} – ${endDay}`}</span>
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(58,55,51,0.40)' }}>{duration} days</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={11} color="rgba(58,55,51,0.35)" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(58,55,51,0.60)' }}>{trip.travelers} travelers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wallet size={10} color="rgba(58,55,51,0.35)" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#3A3733' }}>{fmtUSD(trip.budgetPlanned)}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(58,55,51,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 500, color: 'rgba(58,55,51,0.40)', letterSpacing: '0.04em' }}>Checklist</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(58,55,51,0.40)' }}>{done}/{total}</span>
        </div>
        <div style={{ height: 3, borderRadius: 999, overflow: 'hidden', background: 'rgba(58,55,51,0.08)' }}>
          <div style={{ height: '100%', width: `${progress}%`, borderRadius: 999, background: progress === 100 ? '#6EAB7A' : 'rgba(58,55,51,0.35)' }} />
        </div>
      </div>
    </div>
  )
}

export default TripsCard
