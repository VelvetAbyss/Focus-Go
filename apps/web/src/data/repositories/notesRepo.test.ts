// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteItem } from '../models/types'

const { listMock, updateMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('../services/dbService', () => ({
  dbService: { notes: { list: listMock, update: updateMock } },
}))

import { notesRepo } from './notesRepo'

beforeEach(() => {
  listMock.mockReset()
  updateMock.mockReset()
})

describe('notes repository cache', () => {
  it('does not let a late stale list replace a newer saved note', async () => {
    const before = { id: 'note-race', contentMd: 'Before' } as NoteItem
    const after = { ...before, contentMd: 'After' }
    let resolveOldList: (notes: NoteItem[]) => void = () => {}
    listMock.mockReturnValueOnce(new Promise<NoteItem[]>((resolve) => { resolveOldList = resolve }))
      .mockResolvedValue([after])
    updateMock.mockResolvedValue(after)

    const staleRead = notesRepo.list()
    await notesRepo.update(before.id, { contentMd: after.contentMd })
    resolveOldList([before])

    expect((await staleRead)[0].contentMd).toBe('Before')
    expect((await notesRepo.list())[0].contentMd).toBe('After')
  })
})
