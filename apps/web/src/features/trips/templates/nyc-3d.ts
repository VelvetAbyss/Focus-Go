import type { TripTemplate } from '../../../data/models/types'

export const nyc3d: TripTemplate = {
  id: 'tpl-nyc-3d',
  title: 'NYC Long Weekend',
  destination: 'New York City, USA',
  countryCode: 'US',
  coverEmoji: '🗽',
  days: 3,
  tags: ['city', 'food', 'art', 'fast'],
  summary: 'High-density three-day Manhattan loop: Midtown, downtown, Brooklyn dinner.',
  itinerary: [
    {
      day: 1,
      date: '',
      label: 'Midtown · Central Park',
      items: [
        { id: 'tpl-nyc-1-1', title: 'Hotel check-in', time: '13:00', startTime: '13:00', endTime: '14:00', location: 'Midtown', type: 'hotel', geo: { lat: 40.7549, lng: -73.984 } },
        { id: 'tpl-nyc-1-2', title: 'Top of the Rock', time: '15:00', startTime: '15:00', endTime: '17:00', location: 'Rockefeller Center', type: 'spot', geo: { lat: 40.7587, lng: -73.9787 } },
        { id: 'tpl-nyc-1-3', title: 'Walk Central Park to The Met', time: '17:00', startTime: '17:00', endTime: '19:00', location: 'Central Park', type: 'spot', geo: { lat: 40.7794, lng: -73.9632 } },
        { id: 'tpl-nyc-1-4', title: 'Dinner — Carbone or local pick', time: '20:00', startTime: '20:00', endTime: '22:30', location: 'Greenwich Village', type: 'food', geo: { lat: 40.7307, lng: -73.9999 } },
      ],
    },
    {
      day: 2,
      date: '',
      label: 'Downtown · MoMA',
      items: [
        { id: 'tpl-nyc-2-1', title: 'MoMA', time: '10:00', startTime: '10:00', endTime: '13:00', location: 'Museum of Modern Art', type: 'spot', geo: { lat: 40.7614, lng: -73.9776 } },
        { id: 'tpl-nyc-2-2', title: 'Walk to High Line + Chelsea Market', time: '14:00', startTime: '14:00', endTime: '17:00', location: 'High Line', type: 'spot', geo: { lat: 40.748, lng: -74.0048 } },
        { id: 'tpl-nyc-2-3', title: 'Sunset at Brooklyn Bridge', time: '18:00', startTime: '18:00', endTime: '20:00', location: 'Brooklyn Bridge', type: 'spot', geo: { lat: 40.7061, lng: -73.9969 } },
      ],
    },
    {
      day: 3,
      date: '',
      label: 'Brooklyn · Departure',
      items: [
        { id: 'tpl-nyc-3-1', title: 'Brunch in Williamsburg', time: '10:00', startTime: '10:00', endTime: '12:00', location: 'Williamsburg', type: 'food', geo: { lat: 40.7081, lng: -73.9571 } },
        { id: 'tpl-nyc-3-2', title: 'DUMBO photo walk', time: '12:30', startTime: '12:30', endTime: '14:00', location: 'DUMBO', type: 'spot', geo: { lat: 40.7033, lng: -73.9881 } },
        { id: 'tpl-nyc-3-3', title: 'AirTrain → JFK → flight home', time: '16:00', startTime: '16:00', endTime: '18:00', location: 'JFK Airport', type: 'transport', geo: { lat: 40.6413, lng: -73.7781 } },
      ],
    },
  ],
  budget: [
    { id: 'tpl-nyc-b-1', label: 'Flights', emoji: '✈️', planned: 400, actual: 0 },
    { id: 'tpl-nyc-b-2', label: 'Hotel', emoji: '🏨', planned: 900, actual: 0 },
    { id: 'tpl-nyc-b-3', label: 'Food', emoji: '🍕', planned: 400, actual: 0 },
    { id: 'tpl-nyc-b-4', label: 'Subway / Uber', emoji: '🚇', planned: 80, actual: 0 },
    { id: 'tpl-nyc-b-5', label: 'Tickets', emoji: '🎫', planned: 150, actual: 0 },
  ],
  checklist: [
    {
      id: 'tpl-nyc-c-1',
      label: 'Before trip',
      emoji: '📋',
      items: [
        { id: 'tpl-nyc-c-1-1', label: 'Book MoMA + Top of the Rock', done: false },
        { id: 'tpl-nyc-c-1-2', label: 'Tap-to-pay card for subway', done: false },
      ],
    },
  ],
}
