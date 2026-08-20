// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  discoveryNewStorageKey,
  isDiscoveryNewSeen,
  markDiscoveryNewSeen,
  resetDiscovery,
} from './resetDiscovery'

describe('discovery reset and new targets', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    resetDiscovery()
  })

  it('clears only discovery keys', () => {
    window.localStorage.setItem('focusgo.discovery.hint.task-detail.v1', '1')
    window.localStorage.setItem('focusgo.discovery.nav.trips.v1', '1')
    window.localStorage.setItem(discoveryNewStorageKey('tasks-analytics-tab'), '1')
    window.localStorage.setItem('focusgo.tasks.v1', 'keep')

    resetDiscovery()

    expect(window.localStorage.getItem('focusgo.discovery.hint.task-detail.v1')).toBeNull()
    expect(window.localStorage.getItem('focusgo.discovery.nav.trips.v1')).toBeNull()
    expect(window.localStorage.getItem(discoveryNewStorageKey('tasks-analytics-tab'))).toBeNull()
    expect(window.localStorage.getItem('focusgo.tasks.v1')).toBe('keep')
  })

  it('keeps new targets dismissed for the session when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    markDiscoveryNewSeen('notes-info-panel')

    expect(isDiscoveryNewSeen('notes-info-panel')).toBe(true)
  })
})
