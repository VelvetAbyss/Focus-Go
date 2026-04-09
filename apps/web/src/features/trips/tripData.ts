import type {
  BookingStatus,
  FoodStatus,
  ItineraryType,
  TransportMethod,
  TripRecord,
  TripStatus,
} from '../../data/models/types'
import type { TripCreateInput } from '@focus-go/core'

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const moveDateKey = (dateKey: string, offset: number) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const next = new Date(year, month - 1, day)
  next.setDate(next.getDate() + offset)
  return toDateKey(next)
}

export const demoTrip: TripCreateInput = {
  title: 'Tokyo Trip',
  destination: 'Tokyo, Japan',
  startDate: '2026-04-18',
  endDate: '2026-04-24',
  status: 'Planning',
  travelers: 2,
  budgetPlanned: 3200,
  budgetCurrency: 'USD',
  heroImage: 'https://images.unsplash.com/photo-1612977420019-0284a333eefb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  coverEmoji: '🗼',
  itinerary: [
    { day: 1, date: 'Apr 18', label: 'Arrival · Shinjuku', items: [
      { id: 'i1', title: 'Arrive at Narita Airport', time: '14:30', location: 'Narita International Airport', type: 'transport' },
      { id: 'i2', title: 'Check in — Hotel Gracery Shinjuku', time: '18:00', location: 'Shinjuku, Tokyo', type: 'hotel' },
      { id: 'i3', title: 'Kabukicho walk & Omoide Yokocho dinner', time: '19:30', location: 'Shinjuku', type: 'food', notes: 'Try yakitori at the alley' },
    ] },
    { day: 2, date: 'Apr 19', label: 'Harajuku · Shibuya', items: [
      { id: 'i4', title: 'Meiji Shrine', time: '09:00', location: 'Harajuku', type: 'spot' },
      { id: 'i5', title: 'Lunch at Afuri Ramen', time: '12:30', location: 'Harajuku', type: 'food' },
      { id: 'i6', title: 'Shibuya Sky Observation', time: '17:00', location: 'Shibuya Scramble Square', type: 'spot' },
    ] },
    { day: 3, date: 'Apr 20', label: 'Asakusa · Ueno', items: [
      { id: 'i7', title: 'Senso-ji Temple', time: '08:30', location: 'Asakusa', type: 'spot' },
      { id: 'i8', title: 'Tokyo National Museum', time: '11:30', location: 'Ueno', type: 'spot' },
    ] },
    { day: 4, date: 'Apr 21', label: 'Day Trip · Nikko', items: [
      { id: 'i9', title: 'Shinkansen to Nikko', time: '07:30', location: 'Ueno Station', type: 'transport' },
      { id: 'i10', title: 'Tosho-gu Shrine', time: '10:00', location: 'Nikko', type: 'spot' },
    ] },
    { day: 5, date: 'Apr 22', label: 'Ginza · teamLab', items: [
      { id: 'i11', title: 'teamLab Planets', time: '10:00', location: 'Toyosu', type: 'spot', notes: 'Pre-booked tickets required' },
      { id: 'i12', title: 'Dinner at Sushi Saito', time: '19:00', location: 'Roppongi', type: 'food', notes: 'Dress smart casual' },
    ] },
    { day: 6, date: 'Apr 23', label: 'Yanaka · Shimokitazawa', items: [
      { id: 'i13', title: 'Yanaka Ginza walk', time: '10:00', location: 'Yanaka', type: 'spot' },
      { id: 'i14', title: 'Shimokitazawa vintage shops', time: '15:00', location: 'Shimokitazawa', type: 'spot' },
    ] },
    { day: 7, date: 'Apr 24', label: 'Departure', items: [
      { id: 'i15', title: 'Morning checkout', time: '10:00', location: 'Hotel Gracery Shinjuku', type: 'hotel' },
      { id: 'i16', title: 'Depart NRT', time: '17:30', location: 'Narita International Airport', type: 'transport' },
    ] },
  ],
  transport: [
    { id: 't1', category: 'intercity', method: 'Flight', from: 'San Francisco SFO', to: 'Tokyo NRT', departTime: '11:00', arriveTime: '14:30+1', date: 'Apr 18', status: 'Pending', cost: 980, currency: 'USD', notes: 'United UA837' },
    { id: 't2', category: 'intercity', method: 'Train', from: 'Tokyo (Ueno)', to: 'Nikko', departTime: '07:30', arriveTime: '09:10', date: 'Apr 21', status: 'Not booked', cost: 55, currency: 'USD' },
    { id: 't3', category: 'local', method: 'Subway', from: 'Hotel', to: 'Everywhere', departTime: '—', arriveTime: '—', date: 'Daily', status: 'Confirmed', cost: 60, currency: 'USD', notes: 'Suica — 7-day pass' },
  ],
  stays: [
    { id: 's1', name: 'Hotel Gracery Shinjuku', address: '1 Chome-19-1 Kabukicho, Shinjuku City, Tokyo', checkIn: 'Apr 18', checkOut: 'Apr 24', nights: 6, status: 'Pending', cost: 960, currency: 'USD', notes: 'Superior room, Godzilla view floor preferred' },
  ],
  food: [
    { id: 'f1', name: 'Omoide Yokocho', area: 'Shinjuku', cuisine: 'Yakitori', status: 'Planned', priceRange: '¥¥' },
    { id: 'f2', name: 'Afuri Ramen', area: 'Harajuku', cuisine: 'Ramen', status: 'Saved', priceRange: '¥¥' },
    { id: 'f3', name: 'Sushi Saito', area: 'Roppongi', cuisine: 'Omakase Sushi', status: 'Planned', priceRange: '¥¥¥', notes: 'Reservation confirmed for Apr 22' },
  ],
  budget: [
    { id: 'b1', label: 'Flights', emoji: '✈️', planned: 1960, actual: 0 },
    { id: 'b2', label: 'Stay', emoji: '🏨', planned: 960, actual: 0 },
    { id: 'b3', label: 'Transport', emoji: '🚇', planned: 163, actual: 60 },
    { id: 'b4', label: 'Food', emoji: '🍜', planned: 420, actual: 0 },
    { id: 'b5', label: 'Activities', emoji: '🎟️', planned: 180, actual: 0 },
  ],
  checklist: [
    { id: 'cl1', label: 'Before Trip', emoji: '📋', items: [
      { id: 'cl1-1', label: 'Apply for Japan eVisa', done: true },
      { id: 'cl1-2', label: 'Confirm travel insurance', done: false },
      { id: 'cl1-3', label: 'Notify bank of travel dates', done: true },
    ] },
    { id: 'cl2', label: 'Packing', emoji: '🧳', items: [
      { id: 'cl2-1', label: 'Portable charger', done: true },
      { id: 'cl2-2', label: 'Walking shoes', done: false },
      { id: 'cl2-3', label: 'Light rain jacket', done: false },
    ] },
  ],
  notes: `Tokyo Trip\n\nSlow mornings, long walks, no rush. This is a reset trip.\n\n- Carry some cash for small restaurants.\n- Suica for transit.\n- Bring a light layer for evenings.`,
}

export const createEmptyTripInput = (overrides: Partial<TripCreateInput> = {}): TripCreateInput => {
  const startDate = overrides.startDate ?? toDateKey(new Date())
  const endDate = overrides.endDate ?? moveDateKey(startDate, 3)

  return {
    title: 'Untitled Trip',
    destination: '',
    startDate,
    endDate,
    status: 'Planning',
    travelers: 1,
    budgetPlanned: 0,
    budgetCurrency: 'USD',
    heroImage: demoTrip.heroImage,
    coverEmoji: '✈️',
    itinerary: [],
    transport: [],
    stays: [],
    food: [],
    budget: [],
    checklist: [],
    notes: '',
    ...overrides,
  }
}

export const fmtUSD = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`)
export const tripDuration = (trip: TripRecord) => trip.itinerary.length
export const budgetEstimated = (trip: TripRecord) => trip.budget.reduce((sum, item) => sum + item.planned, 0)
export const budgetActual = (trip: TripRecord) => trip.budget.reduce((sum, item) => sum + item.actual, 0)
export const checklistProgress = (trip: TripRecord) => {
  let done = 0
  let total = 0
  trip.checklist.forEach((group) => group.items.forEach((item) => {
    total += 1
    if (item.done) done += 1
  }))
  return { done, total }
}

export const statusColor = (status: TripStatus) => {
  switch (status) {
    case 'Planning': return { bg: 'rgba(232,168,95,0.14)', text: '#B07830', border: 'rgba(232,168,95,0.28)' }
    case 'Booked': return { bg: 'rgba(110,171,122,0.14)', text: '#3D7A4E', border: 'rgba(110,171,122,0.28)' }
    case 'Ready': return { bg: 'rgba(122,173,229,0.14)', text: '#2E6EA6', border: 'rgba(122,173,229,0.28)' }
    case 'Ongoing': return { bg: 'rgba(192,122,192,0.14)', text: '#7A3A7A', border: 'rgba(192,122,192,0.28)' }
    case 'Done': return { bg: 'rgba(58,55,51,0.07)', text: 'rgba(58,55,51,0.45)', border: 'rgba(58,55,51,0.12)' }
  }
}

export const bookingStatusColor = (status: BookingStatus) => {
  switch (status) {
    case 'Confirmed': return { text: '#3D7A4E', dot: '#6EAB7A' }
    case 'Pending': return { text: '#B07830', dot: '#E8A85F' }
    case 'Not booked': return { text: 'rgba(58,55,51,0.40)', dot: 'rgba(58,55,51,0.20)' }
  }
}

export const foodStatusColor = (status: FoodStatus) => {
  switch (status) {
    case 'Visited': return { bg: 'rgba(110,171,122,0.12)', text: '#3D7A4E' }
    case 'Planned': return { bg: 'rgba(232,168,95,0.12)', text: '#B07830' }
    case 'Saved': return { bg: 'rgba(58,55,51,0.06)', text: 'rgba(58,55,51,0.50)' }
  }
}

export const itineraryTypeStyle = (type: ItineraryType) => {
  switch (type) {
    case 'spot': return { bg: 'rgba(122,173,229,0.14)', text: '#2E6EA6' }
    case 'food': return { bg: 'rgba(232,168,95,0.14)', text: '#B07830' }
    case 'transport': return { bg: 'rgba(58,55,51,0.08)', text: 'rgba(58,55,51,0.55)' }
    case 'hotel': return { bg: 'rgba(192,122,192,0.14)', text: '#7A3A7A' }
  }
}

export const transportMethodEmoji = (method: TransportMethod) => {
  switch (method) {
    case 'Flight': return '✈️'
    case 'Train': return '🚄'
    case 'Bus': return '🚌'
    case 'Taxi': return '🚕'
    case 'Subway': return '🚇'
    case 'Walk': return '🚶'
    case 'Car': return '🚗'
  }
}
