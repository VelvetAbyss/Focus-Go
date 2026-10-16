import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSyncEvents } from './events.js'

test('sync invalidations are scoped to the authenticated account and stop after cleanup', () => {
  const events = createSyncEvents()
  const received = []
  let otherAccountEvents = 0
  const unsubscribe = events.subscribe('a', event => received.push(event))
  events.subscribe('b', () => { otherAccountEvents += 1 })
  events.publish('a', 'notes')
  unsubscribe()
  events.publish('a', 'tasks')
  assert.deepEqual(received, [{ type: 'changed', entityType: 'notes' }])
  assert.equal(otherAccountEvents, 0)
})

test('stream subscription cap prevents unbounded account connections and releases capacity', () => {
  const events = createSyncEvents()
  const unsubscribes = Array.from({ length: 8 }, () => events.subscribe('a', () => {}))
  assert.throws(() => events.subscribe('a', () => {}), /sync_stream_limit/)
  unsubscribes[0]()
  assert.doesNotThrow(() => events.subscribe('a', () => {}))
})
