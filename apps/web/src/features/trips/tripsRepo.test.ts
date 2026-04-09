import { beforeEach, describe, expect, it, vi } from 'vitest'

const listMock = vi.fn()
const createMock = vi.fn()
const updateMock = vi.fn()
const removeMock = vi.fn()

vi.mock('../../data/repositories/tripsRepo', () => ({
  tripsRepo: {
    list: (...args: unknown[]) => listMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    remove: (...args: unknown[]) => removeMock(...args),
  },
}))

import { tripsRepo } from './tripsRepo'

const makeTrip = (id: string, updatedAt: number) => ({
  id,
  createdAt: updatedAt - 1000,
  updatedAt,
  title: id,
  destination: 'Tokyo',
  startDate: '2026-04-18',
  endDate: '2026-04-24',
  status: 'Planning' as const,
  travelers: 2,
  budgetPlanned: 3200,
  budgetCurrency: 'USD',
  heroImage: 'https://example.com/hero.jpg',
  coverEmoji: '🗼',
  itinerary: [],
  transport: [],
  stays: [],
  food: [],
  budget: [],
  checklist: [],
  notes: '',
})

describe('feature tripsRepo', () => {
  beforeEach(() => {
    listMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    removeMock.mockReset()
  })

  it('returns the last updated trip for dashboard', async () => {
    listMock.mockResolvedValue([
      makeTrip('older', 10),
      makeTrip('newer', 20),
      makeTrip('latest', 30),
    ])

    await expect(tripsRepo.getDashboardTrip()).resolves.toMatchObject({ id: 'latest' })
  })

  it('returns trip by id when it exists', async () => {
    listMock.mockResolvedValue([
      makeTrip('trip_a', 10),
      makeTrip('trip_b', 20),
    ])

    await expect(tripsRepo.getById('trip_b')).resolves.toMatchObject({ id: 'trip_b' })
  })

  it('creates the demo trip when storage is empty', async () => {
    listMock.mockResolvedValue([])
    createMock.mockImplementation(async (input) => ({
      id: 'created',
      createdAt: 1,
      updatedAt: 1,
      ...input,
    }))

    const trip = await tripsRepo.getPrimary()

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(trip.id).toBe('created')
  })
})
