import 'fake-indexeddb/auto'
import { beforeEach,afterAll,describe,it,expect,vi } from 'vitest'
const auth=vi.hoisted(()=>({owner:'guest'}))
vi.mock('../../store/auth',()=>({getAuth:()=>auth.owner==='guest'?null:{user:{id:auth.owner}}}))
import { db } from '../../data/db'
import { liveQuery } from 'dexie'
import { saveBirthProfile,createReading,updateReading,readSymbolicState,querySymbolicState,migrateSymbolicRecords } from './storage'
import { validReading } from './validation'
import { emptyBirthInput } from './types'
import { createTableDatabaseAdapter } from '../../shared/backup/localBackup'
import { TABLES } from '../../data/db/schema'
import { SYNC_ENTITY_TABLES } from '../../data/sync/constants'
beforeEach(async()=>{auth.owner='guest';await db.localSymbolic.clear()})
afterAll(()=>db.close())
describe('private local symbolic records',()=>{
  it('loads an empty account through a real read-only live query and observes profile changes',async()=>{
    await migrateSymbolicRecords('guest')
    const names:(string|null)[]=[]
    let error:unknown
    const subscription=liveQuery(()=>querySymbolicState('guest')).subscribe({next:state=>names.push(state.profile?.name??null),error:value=>{error=value}})
    try{
      await vi.waitFor(()=>expect(names).toEqual([null]))
      await saveBirthProfile('guest',{...emptyBirthInput(),name:'Live profile',date:'2005-12-23',time:'08:37'})
      await vi.waitFor(()=>expect(names.at(-1)).toBe('Live profile'))
      expect(error).toBeUndefined()
    }finally{subscription.unsubscribe()}
  })
  it('preserves profile versions without crossing owners or sync tables',async()=>{
    const profile={...emptyBirthInput(),date:'2005-12-23',time:'08:37',timeZone:'+08:00'}
    const first=await saveBirthProfile('guest',profile);await saveBirthProfile('guest',{...profile,name:'Test'})
    await expect(saveBirthProfile('guest',{...profile,name:'Stale draft'},first.version)).rejects.toThrow('another tab')
    expect((await readSymbolicState('guest')).versions).toHaveLength(2)
    auth.owner='account-b';expect((await readSymbolicState('account-b')).profile).toBeNull()
    await expect(saveBirthProfile('guest',profile)).rejects.toThrow('Account changed')
    expect(Object.values(SYNC_ENTITY_TABLES)).not.toContain(TABLES.localSymbolic)
  })
  it('serializes concurrent daily draws and keeps reveal monotonic',async()=>{
    const date=new Date('2026-10-10T08:00:00Z')
    const readings=await Promise.all(Array.from({length:8},()=>createReading('guest','daily','Asia/Shanghai',true,'',date)))
    expect(new Set(readings.map(r=>JSON.stringify(r.cards))).size).toBe(1);expect(await db.localSymbolic.count()).toBe(1)
    await updateReading('guest',readings[0].id,{reveal:0});await updateReading('guest',readings[0].id,{reflection:'Keep this',expectedReflection:''})
    expect((await readSymbolicState('guest')).readings[0].cards[0].revealed).toBe(true)
    await expect(updateReading('guest',readings[0].id,{reflection:'stale',expectedReflection:''})).rejects.toThrow('another tab')
    expect((await readSymbolicState('guest')).readings[0].reflection).toBe('Keep this')
    const tomorrow=await createReading('guest','daily','Asia/Shanghai',false,'',new Date('2026-10-11T08:00:00Z'));expect(tomorrow.id).not.toBe(readings[0].id)
  })
  it('exports only this owner and rejects foreign restores without erasing records',async()=>{
    await createReading('guest','daily','UTC',true,'guest');auth.owner='account-b';await createReading('account-b','daily','UTC',true,'private')
    const adapter=createTableDatabaseAdapter(db,[TABLES.localSymbolic]),exported=await adapter.exportTables([TABLES.localSymbolic])
    expect(exported[TABLES.localSymbolic]).toHaveLength(1);expect(exported[TABLES.localSymbolic][0]).toMatchObject({ownerId:'account-b'})
    auth.owner='guest';await expect(adapter.replaceTables(exported)).rejects.toThrow('incompatible');expect(await db.localSymbolic.count()).toBe(2)
    await adapter.replaceTables({});expect(await db.localSymbolic.count()).toBe(2)
    const own=await adapter.exportTables([TABLES.localSymbolic]);await adapter.replaceTables(own);expect(await db.localSymbolic.count()).toBe(2)
  })
  it('rejects malformed zone and record identity data',async()=>{
    const reading=await createReading('guest','daily','UTC',false,'')
    expect(validReading({...reading,timeZone:'not-a-zone'})).toBe(false);expect(validReading({...reading,id:'wrong'})).toBe(false);expect(validReading({...reading,createdAt:NaN})).toBe(false)
    const row=(await db.localSymbolic.toArray())[0];await db.localSymbolic.put({...row,payload:{...reading,id:'wrong'}})
    await expect(readSymbolicState('guest')).rejects.toThrow('Invalid')
  })
})
