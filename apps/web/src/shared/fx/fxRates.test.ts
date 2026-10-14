// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchApiMock = vi.fn()
vi.mock('../apiBase', () => ({ fetchApi: (...args: unknown[]) => fetchApiMock(...args) }))

import { liveCnyPer, loadFxRates, resetFxMemo } from './fxRates'
import { convertToBase } from '../../lib/currency'

const upstream = { result: 'success', base_code: 'USD', time_last_update_unix: 1791590400, rates: { USD: 1, CNY: 7.1, CAD: 1.42 } }

beforeEach(() => {
  localStorage.clear()
  resetFxMemo()
  fetchApiMock.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('fx rates', () => {
  it('uses the fixed rate until live rates arrive, then the live one', async () => {
    expect(liveCnyPer('USD')).toBeNull()
    expect(convertToBase(10, 'USD', 'CNY')).toBe(72)

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(upstream), { status: 200 })))
    const snapshot = await loadFxRates()
    expect(snapshot?.rates.CNY).toBe(7.1)
    expect(liveCnyPer('USD')).toBe(7.1)
    expect(liveCnyPer('CAD')).toBeCloseTo(5, 5)
    expect(convertToBase(10, 'USD', 'CNY')).toBe(71)
  })

  it('goes through our API when the public source is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('blocked') }))
    fetchApiMock.mockResolvedValue(new Response(JSON.stringify({ base: 'USD', rates: { USD: 1, CNY: 7.2 }, updatedAt: 1 }), { status: 200 }))
    expect((await loadFxRates())?.rates.CNY).toBe(7.2)
    expect(fetchApiMock).toHaveBeenCalledWith('/fx/latest')
  })

  it('keeps the last rates when both sources fail', async () => {
    localStorage.setItem('focusgo.fx.v1', JSON.stringify({ rates: { USD: 1, CNY: 7.05 }, updatedAt: 1, fetchedAt: 1 }))
    resetFxMemo()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    fetchApiMock.mockRejectedValue(new TypeError('offline'))
    expect((await loadFxRates())?.rates.CNY).toBe(7.05)
  })
})
