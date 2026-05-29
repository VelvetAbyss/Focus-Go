import type { TripTemplate } from '../../../data/models/types'

export const paris4d: TripTemplate = {
  id: 'tpl-paris-4d',
  title: 'Paris Long Weekend',
  destination: 'Paris, France',
  countryCode: 'FR',
  coverEmoji: '🗼',
  days: 4,
  tags: ['city', 'romance', 'art', 'food'],
  summary: 'Classic four-day Paris loop: Louvre, Eiffel sunset, Marais wander, day in Versailles.',
  itinerary: [
    {
      day: 1,
      date: '',
      label: 'Arrival · Île de la Cité',
      items: [
        { id: 'tpl-paris-1-1', title: 'CDG → hotel via RER B', time: '11:00', startTime: '11:00', endTime: '13:00', location: 'CDG Airport', type: 'transport', geo: { lat: 49.0097, lng: 2.5479 } },
        { id: 'tpl-paris-1-2', title: 'Notre-Dame exterior + Sainte-Chapelle', time: '15:00', startTime: '15:00', endTime: '17:00', location: 'Île de la Cité', type: 'spot', geo: { lat: 48.8530, lng: 2.3499 } },
        { id: 'tpl-paris-1-3', title: 'Dinner — bistro in the Marais', time: '19:30', startTime: '19:30', endTime: '22:00', location: 'Le Marais', type: 'food', geo: { lat: 48.8566, lng: 2.3622 } },
      ],
    },
    {
      day: 2,
      date: '',
      label: 'Louvre · Tuileries',
      items: [
        { id: 'tpl-paris-2-1', title: 'Louvre (pre-booked timed entry)', time: '09:00', startTime: '09:00', endTime: '13:00', location: 'Louvre Museum', type: 'spot', geo: { lat: 48.8606, lng: 2.3376 } },
        { id: 'tpl-paris-2-2', title: 'Lunch at Tuileries', time: '13:30', startTime: '13:30', endTime: '14:30', location: 'Jardin des Tuileries', type: 'food', geo: { lat: 48.8635, lng: 2.3275 } },
        { id: 'tpl-paris-2-3', title: 'Walk Champs-Élysées → Arc de Triomphe', time: '15:30', startTime: '15:30', endTime: '17:30', location: 'Arc de Triomphe', type: 'spot', geo: { lat: 48.8738, lng: 2.295 } },
        { id: 'tpl-paris-2-4', title: 'Eiffel Tower at sunset', time: '20:00', startTime: '20:00', endTime: '22:00', location: 'Tour Eiffel', type: 'spot', geo: { lat: 48.8584, lng: 2.2945 } },
      ],
    },
    {
      day: 3,
      date: '',
      label: 'Versailles day trip',
      items: [
        { id: 'tpl-paris-3-1', title: 'RER C → Versailles', time: '08:30', startTime: '08:30', endTime: '09:30', location: 'Château de Versailles', type: 'transport', geo: { lat: 48.8049, lng: 2.1204 } },
        { id: 'tpl-paris-3-2', title: 'Palace + Hall of Mirrors', time: '10:00', startTime: '10:00', endTime: '13:00', location: 'Versailles Palace', type: 'spot', geo: { lat: 48.8049, lng: 2.1204 } },
        { id: 'tpl-paris-3-3', title: 'Gardens & Trianon', time: '14:00', startTime: '14:00', endTime: '17:00', location: 'Versailles Gardens', type: 'spot', geo: { lat: 48.806, lng: 2.115 } },
      ],
    },
    {
      day: 4,
      date: '',
      label: 'Montmartre · Departure',
      items: [
        { id: 'tpl-paris-4-1', title: 'Sacré-Cœur + Montmartre wander', time: '09:00', startTime: '09:00', endTime: '12:00', location: 'Sacré-Cœur', type: 'spot', geo: { lat: 48.8867, lng: 2.343 } },
        { id: 'tpl-paris-4-2', title: 'Crêpe lunch', time: '12:30', startTime: '12:30', endTime: '13:30', location: 'Montmartre', type: 'food', geo: { lat: 48.886, lng: 2.34 } },
        { id: 'tpl-paris-4-3', title: 'RER B → CDG → flight home', time: '16:00', startTime: '16:00', endTime: '18:00', location: 'CDG Airport', type: 'transport', geo: { lat: 49.0097, lng: 2.5479 } },
      ],
    },
  ],
  budget: [
    { id: 'tpl-paris-b-1', label: 'Flights', emoji: '✈️', planned: 800, actual: 0 },
    { id: 'tpl-paris-b-2', label: 'Hotel', emoji: '🏨', planned: 900, actual: 0 },
    { id: 'tpl-paris-b-3', label: 'Food & wine', emoji: '🥐', planned: 400, actual: 0 },
    { id: 'tpl-paris-b-4', label: 'Metro / RER', emoji: '🚇', planned: 60, actual: 0 },
    { id: 'tpl-paris-b-5', label: 'Museums', emoji: '🎨', planned: 150, actual: 0 },
  ],
  checklist: [
    {
      id: 'tpl-paris-c-1',
      label: 'Before trip',
      emoji: '📋',
      items: [
        { id: 'tpl-paris-c-1-1', label: 'Book Louvre + Versailles tickets', done: false },
        { id: 'tpl-paris-c-1-2', label: 'Reserve Eiffel Tower summit', done: false },
        { id: 'tpl-paris-c-1-3', label: 'Comfortable walking shoes', done: false },
      ],
    },
  ],
}
