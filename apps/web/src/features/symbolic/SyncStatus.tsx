import { useState } from 'react'
import { useSymbolic, useSymbolicCopy } from './useSymbolic'
import { resolveSymbolicConflict, symbolicCloudEnabled, syncSymbolicNow } from './sync'
import { TAROT_DECK } from '../tarot/deck'
export function SymbolicSyncStatus() {
 const {owner,sync,conflicts}=useSymbolic(),{text}=useSymbolicCopy()
 const [busy,setBusy]=useState(''),[error,setError]=useState('')
 const issue=sync.message==='cloud_storage_quota_exceeded'?text('云端空间不足，请先管理存储空间。','Cloud storage is full; manage storage before syncing.'):sync.message?.includes('auth')?text('登录状态需要更新。','Your sign-in needs refreshing.'):sync.status==='error'?text('网络可用后会自动重试；本机内容仍保留。','Will retry when connected; local changes are retained.') : ''
 const labels={local:text(owner==='guest'?'访客档案 · 保存在此设备':symbolicCloudEnabled()?'记录保存在本机':'云同步已关闭 · 保存在此设备',owner==='guest'?'Guest records · On this device':symbolicCloudEnabled()?'Records saved here':'Cloud sync off · On this device'),pending:text('已保存在本机 · 等待同步','Saved here · Waiting to sync'),syncing:text('正在同步…','Syncing…'),synced:text('已与账号同步','Synced with your account'),error:text('同步暂未完成 · 本地记录仍保留','Sync incomplete · Local records retained')}
 const resolve=async(id:string,choice:'local'|'remote'|'keep-both')=>{setBusy(id);setError('');try{await resolveSymbolicConflict(owner,id,choice)}catch{setError(text('处理失败，记录仍保留，请重试。','Could not resolve. Both records remain; please retry.'))}finally{setBusy('')}}
 return <div className="symbolic-sync"><p role="status">{labels[sync.status]}{issue?' · '+issue:''}</p>{sync.status==='error'&&<button type="button" className="symbolic-text-button" disabled={!!busy} onClick={async()=>{setBusy('sync');try{await syncSymbolicNow(owner)}catch{/* Status is displayed above. */}finally{setBusy('')}}}>{text('重试同步','Retry sync')}</button>}{conflicts.length>0&&<details open><summary>{text('有不同设备的编辑需要处理','Edits from different devices need review')} ({conflicts.length})</summary>{conflicts.map(row=><div className="symbolic-conflict" key={row.id}><p>{row.kind==='birth-profile'?text('出生档案','Birth profile'):row.kind==='tarot'?text('塔罗记录','Tarot reading'):row.kind==='tarot-session'?text('抽牌进度','Card selection progress'):text('档案与页面设置','Profile and page settings')}</p><details><summary>{text('比较两份内容','Compare both records')}</summary><div className="symbolic-conflict-diff"><div><h4>{text('本机','This device')}</h4><ConflictPreview value={row.payload}/></div><div><h4>{text('云端','Cloud')}</h4><ConflictPreview value={row.conflict?.payload??null}/></div></div></details><div className="symbolic-profile-buttons"><button className="symbolic-button" disabled={!!busy} onClick={()=>void resolve(row.id,'local')}>{row.kind==='tarot-session'?text('保留本机进度副本','Keep a copy of this progress'):text('采用本机版本','Use this device')}</button><button className="symbolic-button" disabled={!!busy} onClick={()=>void resolve(row.id,'remote')}>{text('采用云端版本','Use cloud version')}</button>{(row.kind==='birth-profile'||row.kind==='tarot')&&<button className="symbolic-button" disabled={!!busy} onClick={()=>void resolve(row.id,'keep-both')}>{text('两份都保留','Keep both')}</button>}</div></div>)}</details>}{error&&<p role="alert" className="symbolic-error">{error}</p>}</div>
}

function ConflictPreview({value}:{value:unknown}) {
 const {text,zh}=useSymbolicCopy()
 if(!value||typeof value!=='object')return <p>{text('此版本中没有这条记录','Record absent from this version')}</p>
 const v=value as Record<string,unknown>
 const fields:Array<[string,string]>=[]
 for(const [key,label] of [['name',text('称呼','Name')],['date',text('出生日期','Birth date')],['time',text('时刻','Time')],['calendar',text('历法','Calendar')],['place',text('地点','Place')],['timeZone',text('时区','Time zone')],['latitude',text('纬度','Latitude')],['longitude',text('经度','Longitude')],['direction',text('顺逆参数','Direction rule')],['zi',text('换日参数','Day boundary')],['question',text('问题','Question')],['reflection',text('心得','Reflection')],['activeProfileId',text('所选档案','Selected profile')]]) {
  if(v[key]!==undefined&&v[key]!==null&&v[key]!=='')fields.push([label,String(v[key])])
 }
 if(Array.isArray(v.selected))fields.push([text('抽牌进度','Selection progress'),text('已选 '+v.selected.length+' 张；本机进度会另存为副本，不覆盖云端顺序。',v.selected.length+' cards selected; local progress will be kept as a separate copy.')])
 if(v.context&&typeof v.context==='object'&&typeof (v.context as {question?:unknown}).question==='string'&&!v.question)fields.push([text('问题','Question'),(v.context as {question:string}).question])
 if(Array.isArray(v.cards))fields.push([text('牌面','Cards'),v.cards.map(c=>{const card=c as {id?:string;reversed?:boolean;revealed?:boolean};if(!card.revealed)return text('尚未翻开的牌','Unrevealed card');return (TAROT_DECK.find(d=>d.id===card.id)?.name[zh?0:1]??card.id??'')+(card.reversed?text('（逆位）',' (reversed)'):text('（正位）',' (upright)'))}).join(' · ')])
 if(v.reports&&typeof v.reports==='object'){
  const reports=v.reports as Record<string,{summary?:string}>
  const allRevealed=Array.isArray(v.cards)&&v.cards.length>0&&v.cards.every(card=>card&&typeof card==='object'&&card.revealed===true)
  if(reports[zh?'zh':'en']?.summary)fields.push([text('原始解读','Original reading'),allRevealed?reports[zh?'zh':'en'].summary!:text('全部翻开后可比较解读','Reveal every card to compare the reading')])
 }
 return <dl>{fields.map(([label,content])=><div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>
}
