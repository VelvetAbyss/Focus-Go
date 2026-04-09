// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionsCard from './SubscriptionsCard'
import type { LifeSubscription } from '../../../data/models/types'

let rows: LifeSubscription[] = []

const listMock = vi.fn(async () => [...rows])
const createMock = vi.fn(async (data: Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>) => {
  const created: LifeSubscription = {
    id: `sub-${rows.length + 1}`,
    createdAt: 1,
    updatedAt: Date.now(),
    ...data,
  }
  rows = [created, ...rows]
  return created
})
const updateMock = vi.fn(async (id: string, patch: Partial<LifeSubscription>) => {
  const current = rows.find((item) => item.id === id)
  if (!current) return undefined
  const updated = { ...current, ...patch, updatedAt: Date.now() }
  rows = [updated, ...rows.filter((item) => item.id !== id)]
  return updated
})
const removeMock = vi.fn(async (id: string) => {
  rows = rows.filter((item) => item.id !== id)
})

vi.mock('../../../data/repositories/subscriptionsRepo', () => ({
  subscriptionsRepo: {
    list: () => listMock(),
    create: (data: Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>) => createMock(data),
    update: (id: string, patch: Partial<LifeSubscription>) => updateMock(id, patch),
    remove: (id: string) => removeMock(id),
  },
}))

describe('SubscriptionsCard', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    rows = []
    listMock.mockClear()
    createMock.mockClear()
    updateMock.mockClear()
    removeMock.mockClear()
  })

  it('renders empty state when there are no subscriptions', async () => {
    render(<SubscriptionsCard />)

    expect(await screen.findByText('Track recurring services')).toBeInTheDocument()
    expect(screen.getByLabelText('0 active subscriptions')).toBeInTheDocument()
  })

  it('renders real totals and supports add edit remove flow', async () => {
    rows = [
      { id: 'sub-1', name: 'Spotify', amount: 12, currency: 'USD', cycle: 'monthly', createdAt: 1, updatedAt: 10 },
      { id: 'sub-2', name: 'Figma', amount: 120, currency: 'CNY', cycle: 'yearly', createdAt: 2, updatedAt: 20 },
    ]
    const user = userEvent.setup()

    render(<SubscriptionsCard />)

    expect(await screen.findByText('Spotify')).toBeInTheDocument()
    expect(screen.getByText('$12 + ¥10')).toBeInTheDocument()

    await user.click(screen.getAllByRole('heading', { name: 'Subscriptions' })[0])
    expect(await screen.findByRole('button', { name: 'Add subscription' })).toBeInTheDocument()

    const spotifyButton = screen
      .getAllByText('Spotify')
      .map((node) => node.closest('button'))
      .find(Boolean)
    expect(spotifyButton).toBeTruthy()
    await user.click(spotifyButton!)

    const existingAmountInput = screen.getByDisplayValue('12')
    await user.clear(existingAmountInput)
    await user.type(existingAmountInput, '20')
    await waitFor(() => expect(updateMock).toHaveBeenCalled())

    const addButtons = screen.getAllByRole('button', { name: 'Add subscription' })
    await user.click(addButtons[0]!)

    const nameInput = screen.getByPlaceholderText('e.g. Netflix, iCloud+')
    await user.type(nameInput, 'GitHub')

    const amountInput = screen.getByPlaceholderText('0.00')
    await user.type(amountInput, '96')

    await user.click(screen.getByRole('button', { name: 'Yearly' }))
    await user.click(screen.getByRole('button', { name: '¥ CNY' }))
    await user.click(screen.getAllByRole('button', { name: 'Add subscription' })[1]!)

    await waitFor(() => expect(createMock).toHaveBeenCalled())

    const githubButton = screen
      .getAllByText('GitHub')
      .map((node) => node.closest('button'))
      .find(Boolean)
    expect(githubButton).toBeTruthy()
    await user.click(githubButton!)
    expect(await screen.findByRole('button', { name: 'Remove' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(removeMock).toHaveBeenCalled())
    const body = screen.getByText('Annual overview · 2026')
    expect(body).toBeInTheDocument()
  }, 25000)
})
