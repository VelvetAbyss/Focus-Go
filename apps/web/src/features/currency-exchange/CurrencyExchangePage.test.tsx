// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CurrencyExchangePage from './CurrencyExchangePage'

let installed = true
vi.mock('../labs/LabsContext', () => ({ useLabs: () => ({ ready: true, catalog: [{ featureKey: 'currency-exchange', state: installed ? 'installed' : 'available' }] }) }))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'zh' }) }))
vi.mock('recharts', () => ({ ResponsiveContainer: () => <div>chart</div>, LineChart: () => null, Line: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }))
const mount = () => render(<MemoryRouter initialEntries={['/currency-exchange']}><Routes><Route path="/currency-exchange" element={<CurrencyExchangePage />} /><Route path="/labs" element={<div>Labs destination</div>} /></Routes></MemoryRouter>)
afterEach(() => { cleanup(); vi.unstubAllGlobals(); installed = true })
describe('currency exchange', () => {
  it('requires installation', () => { installed = false; mount(); expect(screen.getByText('Labs destination')).toBeInTheDocument() })
  it('converts amounts and fetches selected pair and range', async () => {
    const fetchMock = vi.fn(async (input: string) => ({ ok: true, json: async () => input.endsWith('/currencies') ? { USD: 'US Dollar', CNY: 'Chinese Yuan', EUR: 'Euro', GBP: 'Pound', JPY: 'Yen', CAD: 'Canadian Dollar' } : input.includes('/latest') ? { date: '2026-10-27', rates: { CNY: 7, EUR: 0.9, GBP: 0.8, JPY: 150, CAD: 1.4 } } : { rates: { '2026-10-01': { CNY: 7, EUR: 0.9 } } } }))
    vi.stubGlobal('fetch', fetchMock); mount()
    expect(await screen.findByText('700')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'CNY · 人民币' })).toBeInTheDocument()
    expect(screen.getByText('欧元')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('基准金额与货币'))
    await userEvent.type(screen.getByLabelText('基准金额与货币'), '2')
    expect(screen.getByText('14')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^EUR欧元/ }))
    await userEvent.click(screen.getByRole('button', { name: '1年' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('symbols=EUR'))).toBe(true))
    expect(screen.getByText(/数据日期: 2026-10-27/)).toBeInTheDocument()
  })
})
