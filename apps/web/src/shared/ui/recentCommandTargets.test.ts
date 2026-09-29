// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { SearchDoc } from './commandSearch'
import { readRecentCommandTargets, rememberRecentCommandTarget, resolveRecentCommandTargets } from './recentCommandTargets'

describe('recent command targets', () => {
  beforeEach(() => window.localStorage.clear())

  it('keeps the latest eight unique targets per account without storing titles', () => {
    for (let index = 0; index < 10; index += 1) {
      rememberRecentCommandTarget('account-a', { kind: 'note', id: `note-${index}` })
    }
    rememberRecentCommandTarget('account-a', { kind: 'note', id: 'note-5' })

    const recent = readRecentCommandTargets('account-a')
    expect(recent).toHaveLength(8)
    expect(recent[0]).toEqual({ kind: 'note', id: 'note-5' })
    expect(recent.filter((item) => item.id === 'note-5')).toHaveLength(1)
    expect(readRecentCommandTargets('account-b')).toEqual([])
    expect(window.localStorage.getItem('focusgo.command.recent.v1:account-a')).not.toContain('title')
  })

  it('omits deleted targets and uses fresh titles from the current index', () => {
    const docs: SearchDoc[] = [{ kind: 'task', id: 'task-1', title: 'Updated title', body: '', updatedAt: 1 }]
    expect(resolveRecentCommandTargets([
      { kind: 'note', id: 'deleted' },
      { kind: 'task', id: 'task-1' },
    ], docs)).toEqual(docs)
  })

  it('ignores malformed storage data', () => {
    window.localStorage.setItem('focusgo.command.recent.v1:guest', JSON.stringify([{}, { kind: 'task', id: 'valid' }, { kind: 'wrong', id: 'bad' }]))
    expect(readRecentCommandTargets('guest')).toEqual([{ kind: 'task', id: 'valid' }])
  })
})
