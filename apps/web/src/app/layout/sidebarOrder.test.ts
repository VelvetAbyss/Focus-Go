// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  SIDEBAR_ORDER_STORAGE_KEY,
  mergeSidebarOrder,
  moveSidebarOrder,
  readSidebarOrder,
  writeSidebarOrder,
} from './sidebarOrder'

describe('sidebarOrder', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('merges saved order with known ids and appends new ids', () => {
    expect(
      mergeSidebarOrder(['route:focus', 'route:dashboard'], ['route:dashboard', 'route:tasks', 'route:focus', 'route:labs']),
    ).toEqual(['route:focus', 'route:dashboard', 'route:tasks', 'route:labs'])
  })

  it('moves items inside the full order without dropping hidden ids', () => {
    expect(
      moveSidebarOrder(
        ['route:dashboard', 'feature:habit-tracker', 'route:tasks', 'route:labs'],
        'route:tasks',
        'route:dashboard',
      ),
    ).toEqual(['route:tasks', 'route:dashboard', 'feature:habit-tracker', 'route:labs'])
  })

  it('reads and writes persisted order for later restore', () => {
    writeSidebarOrder(['route:tasks', 'route:dashboard', 'feature:habit-tracker'])

    expect(window.localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY)).toBe(
      JSON.stringify(['route:tasks', 'route:dashboard', 'feature:habit-tracker']),
    )
    expect(
      mergeSidebarOrder(readSidebarOrder(), ['route:dashboard', 'route:tasks', 'feature:habit-tracker', 'route:labs']),
    ).toEqual(['route:tasks', 'route:dashboard', 'feature:habit-tracker', 'route:labs'])
  })
})
