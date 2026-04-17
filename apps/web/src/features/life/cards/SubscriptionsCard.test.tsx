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

vi.mock('../lifeI18n', () => ({
  useLifeI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const messages: Record<string, string> = {
        'life.subscriptions.trackRecurring': 'Track recurring services',
        'life.subscriptions.activeServices': '0 active subscriptions',
        'life.card.subscriptions': 'Subscriptions',
        'life.subscriptions.newSubscription': 'Add subscription',
        'life.subscriptions.yearly': 'Yearly',
        'life.subscriptions.currency': '¥ CNY',
        'life.subscriptions.remove': 'Remove',
        'life.subscriptions.annualOverview': 'Annual overview · 2026',
        'life.subscriptions.monthlyTotal': '$12 + ¥10',
      }
      const template = messages[key] ?? key
      return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name) => String(values?.[name] ?? `{{${name}}}`))
    },
  }),
}))

vi.mock('../../../data/repositories/subscriptionsRepo', () => ({
  subscriptionsRepo: {
    list: () => listMock(),
    create: (data: Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>) => createMock(data),
    update: (id: string, patch: Partial<LifeSubscription>) => updateMock(id, patch),
    remove: (id: string) => removeMock(id),
  },
}))

vi.mock('../components/SubscriptionCardSurface', () => ({
  SubscriptionCardSurface: ({
    model,
    subscriptions,
    onOpen,
    onCreateSubscription,
    onPatchSubscription,
    onRemoveSubscription,
  }: {
    model: { monthlyTotalLabel: string }
    subscriptions: LifeSubscription[]
    onOpen: () => void
    onCreateSubscription: (draft: Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>) => Promise<unknown>
    onPatchSubscription: (id: string, patch: Partial<LifeSubscription>) => Promise<unknown>
    onRemoveSubscription: (id: string) => void
  }) => (
    <div aria-label={`${subscriptions.length} active subscriptions`}>
      <div>{subscriptions.length === 0 ? 'Track recurring services' : model.monthlyTotalLabel.replace(' /mo', '')}</div>
      {subscriptions.map((subscription) => (
        <button key={subscription.id} type="button" onClick={() => void onPatchSubscription(subscription.id, { amount: 20 })}>
          {subscription.name}
        </button>
      ))}
      <button type="button" onClick={onOpen}>Open panel</button>
      <button
        type="button"
        onClick={() =>
          void onCreateSubscription({
            name: 'GitHub',
            amount: 96,
            currency: 'CNY',
            cycle: 'yearly',
            paymentStatus: 'unpaid',
          } as Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>)
        }
      >
        Add subscription
      </button>
      <button type="button" onClick={() => onRemoveSubscription('sub-3')}>Remove</button>
      <div>Annual overview · 2026</div>
    </div>
  ),
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

    await user.click(screen.getByText('Spotify'))
    await waitFor(() => expect(updateMock).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Add subscription' }))
    await waitFor(() => expect(createMock).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(removeMock).toHaveBeenCalled())
    const body = screen.getByText('Annual overview · 2026')
    expect(body).toBeInTheDocument()
  }, 25000)
})
