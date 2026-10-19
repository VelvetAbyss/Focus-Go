import { useMemo, useSyncExternalStore } from 'react'

export type AstrologySelection = { source:'personal'|'sign'|null; sign:number|null }
const PREFIX='focusgo:astrology-selection:v2:'
const CHANGED='focusgo:astrology-selection-changed'
const fallback=new Map<string,string>()
const keyFor=(owner:string)=>PREFIX+encodeURIComponent(owner)
function rawSelection(owner:string) {
  const key=keyFor(owner)
  if(fallback.has(key)) return fallback.get(key)!
  try { return typeof window==='undefined'?null:window.localStorage.getItem(key) } catch {return null}
}
function parseSelection(raw:string|null):AstrologySelection {
  try {
    const value:unknown=raw?JSON.parse(raw):null
    if(!value||typeof value!=='object') return {source:null,sign:null}
    const data=value as Record<string,unknown>
    return {source:data.source==='personal'||data.source==='sign'?data.source:null,sign:typeof data.sign==='number'&&Number.isInteger(data.sign)&&data.sign>=0&&data.sign<12?data.sign:null}
  } catch {return {source:null,sign:null}}
}
export const readAstrologySelection=(owner:string)=>parseSelection(rawSelection(owner))
export function saveAstrologySelection(owner:string,patch:Partial<AstrologySelection>) {
  const key=keyFor(owner),value=parseSelection(JSON.stringify({...readAstrologySelection(owner),...patch})),raw=JSON.stringify(value)
  try {window.localStorage.setItem(key,raw);fallback.delete(key)} catch {fallback.set(key,raw)}
  if(typeof window!=='undefined') window.dispatchEvent(new Event(CHANGED))
}
export function clearAstrologySelection(owner:string) {
  const key=keyFor(owner)
  fallback.delete(key)
  try { if(typeof window!=='undefined') window.localStorage.removeItem(key) } catch { /* Storage can be unavailable in private mode. */ }
  if(typeof window!=='undefined') window.dispatchEvent(new Event(CHANGED))
}
export const resolveAstrologySource=(selection:AstrologySelection,hasProfile:boolean):'personal'|'sign'=>selection.source??(hasProfile?'personal':'sign')
function subscribe(listener:()=>void) {
  const onStorage=(event:StorageEvent)=>{
    if(event.key===null){fallback.clear();listener()}
    else if(event.key.startsWith(PREFIX)){fallback.delete(event.key);listener()}
  }
  window.addEventListener('storage',onStorage)
  window.addEventListener(CHANGED,listener)
  return ()=>{window.removeEventListener('storage',onStorage);window.removeEventListener(CHANGED,listener)}
}
/** One account-scoped source for page and widget, including same-tab updates. */
export function useAstrologySelection(owner:string) {
  const raw=useSyncExternalStore(subscribe,()=>rawSelection(owner),()=>null)
  const selection=useMemo(()=>parseSelection(raw),[raw])
  return {...selection,setSelection:(patch:Partial<AstrologySelection>)=>saveAstrologySelection(owner,patch)}
}
