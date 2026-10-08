// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { buildTripPdfHtml } from './pdf'
import { migrateTripIn } from '../../../data/migrations/tripMigration'
import type { TripRecord } from '../../../data/models/types'

describe('trip PDF security', () => {
  it('escapes malicious numeric fields even when the caller bypasses migration', () => {
    const payload = '<svg onload="window.__pwned=1"></svg>'
    const trip = {
      title: 'Trip', notes: '', travelers: payload,
      itinerary: [{ day: payload, items: [], date: '', label: '' }],
      transport: [], stays: [{ name: 'Hotel', nights: payload, status: 'Booked' }], journal: [],
    } as unknown as TripRecord
    const html = buildTripPdfHtml(trip)
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    expect(wrapper.querySelector('svg')).toBeNull()
    expect(html).toContain('&lt;svg')
    const migrated = migrateTripIn(trip)
    expect(migrated.itinerary[0].day).toBe(1)
    expect(migrated.stays[0].nights).toBe(0)
  })
})
