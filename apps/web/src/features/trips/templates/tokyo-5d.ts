import type { TripTemplate } from '../../../data/models/types'

export const tokyo5d: TripTemplate = {
  id: 'tpl-tokyo-5d',
  title: 'Tokyo Essentials',
  destination: 'Tokyo, Japan',
  countryCode: 'JP',
  coverEmoji: '🗼',
  days: 5,
  tags: ['city', 'food', 'first-time', 'culture'],
  summary: 'Five-day first-timer loop through Shinjuku, Harajuku, Asakusa, Ginza and a teamLab afternoon.',
  itinerary: [
    {
      day: 1,
      date: '',
      label: 'Arrival · Shinjuku',
      items: [
        { id: 'tpl-tokyo-1-1', title: 'Land at Haneda → train to hotel', time: '14:00', startTime: '14:00', endTime: '16:00', location: 'Haneda Airport', type: 'transport', geo: { lat: 35.5494, lng: 139.7798, address: 'Haneda Airport' } },
        { id: 'tpl-tokyo-1-2', title: 'Walk Shinjuku Gyoen', time: '16:30', startTime: '16:30', endTime: '18:00', location: 'Shinjuku Gyoen', type: 'spot', geo: { lat: 35.6852, lng: 139.71, address: 'Shinjuku Gyoen National Garden' } },
        { id: 'tpl-tokyo-1-3', title: 'Dinner — Omoide Yokocho', time: '19:00', startTime: '19:00', endTime: '21:00', location: 'Omoide Yokocho', type: 'food', geo: { lat: 35.6938, lng: 139.6993, address: 'Omoide Yokocho, Shinjuku' } },
      ],
    },
    {
      day: 2,
      date: '',
      label: 'Harajuku · Shibuya',
      items: [
        { id: 'tpl-tokyo-2-1', title: 'Meiji Jingu', time: '09:00', startTime: '09:00', endTime: '10:30', location: 'Meiji Shrine', type: 'spot', geo: { lat: 35.6764, lng: 139.6993, address: 'Meiji Jingu' } },
        { id: 'tpl-tokyo-2-2', title: 'Takeshita Street stroll', time: '11:00', startTime: '11:00', endTime: '12:30', location: 'Takeshita Street', type: 'spot', geo: { lat: 35.6707, lng: 139.7028, address: 'Takeshita Street, Harajuku' } },
        { id: 'tpl-tokyo-2-3', title: 'Lunch — Afuri ramen', time: '13:00', startTime: '13:00', endTime: '14:00', location: 'Afuri Harajuku', type: 'food', geo: { lat: 35.6671, lng: 139.7065 } },
        { id: 'tpl-tokyo-2-4', title: 'Shibuya Crossing + Sky', time: '17:00', startTime: '17:00', endTime: '19:00', location: 'Shibuya Sky', type: 'spot', geo: { lat: 35.6595, lng: 139.7005, address: 'Shibuya Sky' } },
      ],
    },
    {
      day: 3,
      date: '',
      label: 'Asakusa · Ueno',
      items: [
        { id: 'tpl-tokyo-3-1', title: 'Sensoji Temple', time: '09:00', startTime: '09:00', endTime: '11:00', location: 'Senso-ji', type: 'spot', geo: { lat: 35.7148, lng: 139.7967, address: 'Senso-ji Temple' } },
        { id: 'tpl-tokyo-3-2', title: 'Nakamise Street snacks', time: '11:00', startTime: '11:00', endTime: '12:00', location: 'Nakamise', type: 'food', geo: { lat: 35.7129, lng: 139.7963 } },
        { id: 'tpl-tokyo-3-3', title: 'Ueno Park + museums', time: '14:00', startTime: '14:00', endTime: '17:30', location: 'Ueno Park', type: 'spot', geo: { lat: 35.7156, lng: 139.7732, address: 'Ueno Park' } },
      ],
    },
    {
      day: 4,
      date: '',
      label: 'Ginza · teamLab',
      items: [
        { id: 'tpl-tokyo-4-1', title: 'Tsukiji outer market breakfast', time: '08:00', startTime: '08:00', endTime: '10:00', location: 'Tsukiji', type: 'food', geo: { lat: 35.6654, lng: 139.7708, address: 'Tsukiji Outer Market' } },
        { id: 'tpl-tokyo-4-2', title: 'Ginza shopping', time: '11:00', startTime: '11:00', endTime: '13:00', location: 'Ginza', type: 'spot', geo: { lat: 35.6717, lng: 139.7649 } },
        { id: 'tpl-tokyo-4-3', title: 'teamLab Planets', time: '15:00', startTime: '15:00', endTime: '17:30', location: 'teamLab Planets', type: 'spot', geo: { lat: 35.6491, lng: 139.7901, address: 'teamLab Planets TOKYO' } },
      ],
    },
    {
      day: 5,
      date: '',
      label: 'Departure',
      items: [
        { id: 'tpl-tokyo-5-1', title: 'Last-minute shopping in Tokyo Station', time: '09:00', startTime: '09:00', endTime: '10:30', location: 'Tokyo Station', type: 'spot', geo: { lat: 35.6812, lng: 139.7671 } },
        { id: 'tpl-tokyo-5-2', title: 'Train to Haneda → flight home', time: '12:00', startTime: '12:00', endTime: '14:00', location: 'Haneda Airport', type: 'transport', geo: { lat: 35.5494, lng: 139.7798 } },
      ],
    },
  ],
  budget: [
    { id: 'tpl-tokyo-b-1', label: 'Flights', emoji: '✈️', planned: 1200, actual: 0 },
    { id: 'tpl-tokyo-b-2', label: 'Hotels', emoji: '🏨', planned: 1000, actual: 0 },
    { id: 'tpl-tokyo-b-3', label: 'Food', emoji: '🍣', planned: 500, actual: 0 },
    { id: 'tpl-tokyo-b-4', label: 'Transit / IC card', emoji: '🚇', planned: 80, actual: 0 },
    { id: 'tpl-tokyo-b-5', label: 'Sights & activities', emoji: '🎟', planned: 200, actual: 0 },
  ],
  checklist: [
    {
      id: 'tpl-tokyo-c-1',
      label: 'Before trip',
      emoji: '📋',
      items: [
        { id: 'tpl-tokyo-c-1-1', label: 'Passport valid >6mo', done: false },
        { id: 'tpl-tokyo-c-1-2', label: 'Book pocket Wi-Fi or SIM', done: false },
        { id: 'tpl-tokyo-c-1-3', label: 'Reserve teamLab Planets tickets', done: false },
        { id: 'tpl-tokyo-c-1-4', label: 'Withdraw JPY cash at airport', done: false },
      ],
    },
  ],
}
