// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { syncedPreferencesRepo as repo, SYNCED_PREFERENCES_ID } from './syncedPreferencesRepo'
import { normalizeHangingNotes, normalizeHangingAnchor } from '../models/hangingNotes'
import type { HangingNote } from '../models/types'
import { writeLanguage } from '../../shared/prefs/preferences'
vi.mock('../sync/repository', () => ({ requestSyncHandoff: vi.fn(), enqueueSyncOperationInBackground: vi.fn() }))
const a: HangingNote = { id:'a', text:'A', color:'butter' }, b: HangingNote = { id:'b', text:'B', color:'sage' }
beforeEach(async () => { localStorage.clear(); await db.delete({ disableAutoOpen:false }); await db.open() })
describe('persisting dashboard notes', () => {
  it('preserves notes and preferences during concurrent saves', async () => {
    await repo.saveHangingNotes([a], [])
    writeLanguage('en')
    await Promise.all([repo.persistFromLocal(), repo.saveHangingNotes([a,b],[a]), repo.markInitialSeedCompleted(123)])
    const saved=await repo.get()
    expect(saved?.hangingNotes).toEqual([a,b]); expect(saved?.language).toBe('en'); expect(saved?.initialSeedCompletedAt).toBe(123)
  })
  it('merges separate-sheet edits from stale tabs without changing order', async () => {
    await repo.saveHangingNotes([a,b],[])
    await Promise.all([repo.saveHangingNotes([{...a,text:'new A'},b],[a,b]),repo.saveHangingNotes([a,{...b,pin:{u:.4,y:350,tilt:0}}],[a,b])])
    expect((await repo.get())?.hangingNotes).toEqual([{...a,text:'new A'},{...b,pin:{u:.4,y:350,tilt:0}}])
  })
  it('deletes only the removed ID and preserves remote additions', async () => {
    await repo.saveHangingNotes([a,b],[])
    await repo.saveHangingNotes([],[a])
    expect((await repo.get())?.hangingNotes).toEqual([b])
  })
  it('refuses a queued save after the account changes', async () => {
    await expect(repo.saveHangingNotes([a],[],()=>false)).rejects.toThrow('Account changed')
    expect(await repo.get()).toBeNull()
  })
  it('recovers a malformed stored field without dropping preferences', async () => {
    await repo.persistFromLocal()
    await db.syncedPreferences.update(SYNCED_PREFERENCES_ID, { hangingNotes: { invalid:true } as unknown as HangingNote[] })
    await repo.saveHangingNotes([a],[])
    expect((await repo.get())?.hangingNotes).toEqual([a])
  })
  it('validates restored content and positions', () => {
    expect(normalizeHangingNotes([null,a,a,{...b,pin:{u:5,y:-1,tilt:2}},{id:'bad',text:'x',color:'unknown'}])).toEqual([a,{...b,pin:{u:1,y:0,tilt:.08}}])
  })
})


describe('persisting the hanging anchor', () => {
  it('validates optional positions while leaving legacy placement automatic', () => {
    expect([undefined, null, NaN, Infinity, '0.5'].map(normalizeHangingAnchor)).toEqual([undefined, undefined, undefined, undefined, undefined])
    expect([-.2, .4, 2].map(normalizeHangingAnchor)).toEqual([0, .4, 1])
  })
  it('merges anchor, note, and preference changes from stale tabs', async () => {
    await repo.saveHangingNotes([a], [], () => true, { next: .3 })
    writeLanguage('en')
    await Promise.all([
      repo.saveHangingNotes([a], [a], () => true, { next: .7, previous: .3 }),
      repo.saveHangingNotes([{ ...a, text: 'edited' }], [a], () => true, { next: .3, previous: .3 }),
      repo.persistFromLocal(),
    ])
    const saved = await repo.get()
    expect(saved?.hangingNotesAnchor).toBe(.7)
    expect(saved?.hangingNotes).toEqual([{ ...a, text: 'edited' }])
    expect(saved?.language).toBe('en')
  })
  it('saves an empty hanger and restores its automatic position without creating a note', async () => {
    await repo.saveHangingNotes([], [], () => true, { next: .7 })
    await repo.saveHangingNotes([], [], () => true, { next: undefined, previous: .7 })
    expect((await repo.get())?.hangingNotesAnchor).toBeUndefined()
    expect((await repo.get())?.hangingNotes).toEqual([])
  })
})
