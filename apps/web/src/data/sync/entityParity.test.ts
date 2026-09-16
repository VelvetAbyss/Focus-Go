// The client decides what to push; the server decides what it can store. Those two
// lists used to drift: the server had sync_dashboard_layout and
// sync_life_dashboard_layout for entities the client never sent, so dashboard layout
// silently stayed on one device while the tables sat empty.
//
// Drift here does not throw at runtime — an unknown entity just never round-trips —
// so it needs a test rather than a type. This imports the API's real config, the way
// the Obsidian plugin's parity test imports the API's real protocol.
import { describe, expect, it } from 'vitest'
import { SYNC_TABLES } from '../../../focus-go-api/sync/config.js'
import { SYNC_ENTITY_TABLES } from './constants'
import { SYNC_ENTITY_TYPES } from './types'

describe('sync entity parity', () => {
  const client = Object.keys(SYNC_ENTITY_TABLES).sort()
  const server = Object.keys(SYNC_TABLES).sort()

  it('client and server agree on the entity set', () => {
    expect(client).toEqual(server)
  })

  it('every declared entity type has a local table', () => {
    expect([...SYNC_ENTITY_TYPES].sort()).toEqual(client)
  })
})
