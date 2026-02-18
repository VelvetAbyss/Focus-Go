import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { createFileAccessGuard } from '../electron/fs/accessGuard'

describe('file access guard', () => {
  it('allows files under appData dir by default', () => {
    const appData = path.resolve('/tmp/focus-go-appData')
    const guard = createFileAccessGuard(appData)

    expect(guard.canReadPath(path.join(appData, 'logs/audit.log'))).toBe(true)
  })

  it('allows user-selected files outside appData dir', () => {
    const appData = path.resolve('/tmp/focus-go-appData')
    const outside = path.resolve('/tmp/import.json')
    const guard = createFileAccessGuard(appData)

    expect(guard.canReadPath(outside)).toBe(false)
    guard.allowUserSelectedPath(outside)
    expect(guard.canReadPath(outside)).toBe(true)
  })

  it('rejects unselected files outside appData dir', () => {
    const appData = path.resolve('/tmp/focus-go-appData')
    const guard = createFileAccessGuard(appData)

    expect(guard.canReadPath(path.resolve('/tmp/secret.txt'))).toBe(false)
  })
})
