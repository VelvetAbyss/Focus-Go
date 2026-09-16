// The plugin mirrors a subset of the domain model rather than importing it, so that
// it bundles standalone without pulling the app's module graph in (see src/types.ts).
//
// A mirror that can drift silently is worse than no mirror. `packages/core` is the
// single definition of task status and priority; this test fails the moment the two
// disagree, which is what makes extending the status enum a one-place change.
//
// The import is dev-only: it never reaches the esbuild bundle.
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { TASK_PRIORITIES, TASK_STATUSES } from '../../../../packages/core/src/models.ts'
import {
  TASK_PRIORITIES as PLUGIN_TASK_PRIORITIES,
  TASK_STATUSES as PLUGIN_TASK_STATUSES,
} from '../types.ts'

test('plugin task statuses match packages/core', () => {
  assert.deepEqual([...PLUGIN_TASK_STATUSES], [...TASK_STATUSES])
})

test('plugin task priorities match packages/core', () => {
  assert.deepEqual([...PLUGIN_TASK_PRIORITIES], [...TASK_PRIORITIES])
})
