import test from 'node:test'
import assert from 'node:assert/strict'
import { validateReleaseIdentity, resolveRestoreDirectory, buildOssCommand } from './_shared.mjs'

const identity = { app: 'focus-go', releaseDate: '2026-10-04', gitSha: 'abcdef123456' }
test('release identities reject path traversal and malformed pointer values before filesystem changes', () => {
  assert.equal(resolveRestoreDirectory('/safe/restore', identity), '/safe/restore/focus-go/2026-10-04/abcdef123456')
  for (const bad of ['../../..', '/tmp', 'x\ny', true, 123, '']) {
    for (const key of ['app', 'releaseDate', 'gitSha']) assert.throws(() => validateReleaseIdentity({ ...identity, [key]: bad }), /Invalid release identity/)
  }
  assert.throws(() => validateReleaseIdentity({ ...identity, releaseDate: '2026-02-30' }))
})

test('OSS uses rclone operations without credential command arguments', () => {
  assert.deepEqual(buildOssCommand(['cp', 'oss://bucket/a', '/safe/a', '--force']), ['copyto', 'focusgo_oss:bucket/a', '/safe/a'])
  assert.deepEqual(buildOssCommand(['stat', 'oss://bucket/a']), ['lsjson', 'focusgo_oss:bucket/a', '--stat'])
  assert.throws(() => buildOssCommand(['shell', 'anything']))
})
