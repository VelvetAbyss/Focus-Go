import { useState, type ReactNode, type FormEvent } from 'react'
import { PencilLine, Plus, X } from 'lucide-react'
import { useSymbolic, useSymbolicCopy } from './useSymbolic'
import { emptyBirthInput, type BirthInput, type BirthProfile } from './types'
import { BirthInputError } from './time'
import { saveBirthProfile, selectBirthProfile } from './storage'
import { DataStatus, SymbolicShell } from './SymbolicShell'
import { SymbolicSyncStatus } from './SyncStatus'
import { BIRTHPLACES } from './birthPlaces'

export function BirthWorkspace({module,title,subtitle,children,bare=false}:{module:'bazi'|'astrology';title:string;subtitle:string;children:(profile:BirthProfile,versions:BirthProfile[])=>ReactNode;bare?:boolean}) {
  const state=useSymbolic(),{text}=useSymbolicCopy()
  const [editor,setEditor]=useState<'closed'|'new'|'edit'>('closed')
  const [draft,setDraft]=useState<{owner:string;profile:BirthProfile|null}|null>(null)
  const activeEditor=draft?.owner===state.owner?editor:'closed'
  const draftProfile=draft?.owner===state.owner?draft.profile:null
  const [error,setError]=useState('')
  const profile=state.data.profile
  const switchProfile=async(id:string)=>{try{setError('');await selectBirthProfile(state.owner,id);setEditor('closed')}catch{setError(text('切换失败，请重试。','Could not switch profile. Please retry.'))}}
  const content=!state.ready||state.error?<DataStatus ready={state.ready} error={state.error}/>:<>
    <div className="symbolic-profile-toolbar">
      {profile && <label>{text('当前档案','Viewing')}<select aria-label={text('切换出生档案','Switch birth profile')} value={profile.id??''} onChange={e=>void switchProfile(e.target.value)}>{state.data.profiles.map(p=><option key={p.id??p.version} value={p.id??''}>{p.name||text('未命名档案','Unnamed profile')}{p.relationship?' · '+p.relationship:''}</option>)}</select></label>}
      <div className="symbolic-profile-buttons">{profile&&<button className="symbolic-button" onClick={()=>{setDraft({owner:state.owner,profile});setEditor(activeEditor==='edit'?'closed':'edit')}}><PencilLine size={14}/>{text('编辑档案','Edit profile')}</button>}<button className="symbolic-button" onClick={()=>{setDraft({owner:state.owner,profile:null});setEditor('new')}}><Plus size={14}/>{text('添加档案','Add profile')}</button></div>
    </div>
    <SymbolicSyncStatus/>
    {error&&<p className="symbolic-error" role="alert">{error}</p>}
    {(activeEditor!=='closed'||!profile)&&<BirthForm key={state.owner+':'+(draftProfile?.id??draftProfile?.version??'empty')} owner={state.owner} initial={activeEditor==='edit'?draftProfile:null} onDraftStarted={()=>{if(activeEditor==='closed'){setDraft({owner:state.owner,profile:null});setEditor('new')}}} onSaved={()=>setDraft(current=>current?.owner===state.owner?null:current)} onCancel={profile?()=>setEditor('closed'):undefined}/>}
    {profile&&<><div className="symbolic-profile-line"><span>{profile.name||text('我的档案','My profile')}</span><span>{profile.date} · {profile.calendar==='lunar'?text('农历','Lunar'):text('公历','Gregorian')} · {profile.time||text('时刻未知','Time unknown')} · {profile.place??''} · {profile.timeZone}</span></div>{children(profile,state.data.versions.filter(p=>!profile.id||p.id===profile.id||(!p.id&&profile.id==='birth:legacy')))}</>}
  </>
  return bare?<>{content}</>:<SymbolicShell module={module} title={title} subtitle={subtitle}>{content}</SymbolicShell>
}

export function BirthForm({ owner, initial, onSaved, onCancel, onDraftStarted }: { owner: string; initial: BirthProfile|null; onSaved: () => void; onCancel?: () => void; onDraftStarted?: () => void }) {
  const { text } = useSymbolicCopy()
  const [input,setInput] = useState<BirthInput>(() => initial ?? emptyBirthInput())
  const [baseVersion] = useState(() => initial?.version ?? null)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [placeNeedsReview,setPlaceNeedsReview] = useState(false)
  const [advanced,setAdvanced] = useState(false)
  const change = <K extends keyof BirthInput>(key: K,value: BirthInput[K]) => setInput(prev=>({...prev,[key]:value}))
  const submit = async (event: FormEvent) => {
    event.preventDefault();if(placeNeedsReview)return;setBusy(true);setError('')
    try { await saveBirthProfile(owner,input,baseVersion,initial?.id??null);onSaved() } catch (e) {
      const errors: Record<string,[string,string]> = { date:['请输入有效日期，格式为 YYYY-MM-DD。','Enter a valid YYYY-MM-DD date.'],range:['首版支持 1901—2100 年。','Supported years: 1901–2100.'],lunar:['该农历日期或闰月不存在，请核对。','This lunar date or leap month does not exist.'],time:['请输入有效的 24 小时时刻。','Enter a valid 24-hour time.'],zone:['请填写有效的 IANA 时区或 UTC 偏移。','Enter a valid IANA zone or UTC offset.'],coordinates:['纬度范围 −90 至 90，经度范围 −180 至 180。','Latitude must be −90 to 90; longitude −180 to 180.'],ambiguous:['该时刻受夏令时切换影响，不存在或重复。核对后用当时明确的 UTC 偏移（例如 −04:00）。','This time is missing or repeated due to a clock change. Verify and enter its exact UTC offset (e.g. −04:00).'] }
      const copy=e instanceof BirthInputError?errors[e.code]:null
      setError(e instanceof Error && e.message === 'Profile changed in another tab' ? text('另一页面已更新档案。你的草稿仍在，请先复制需要的内容，再关闭编辑核对最新版本。','Another page updated this profile. Your draft is retained. Copy anything you need, then close the editor to review the latest version.') : copy?text(...copy):text('保存失败。请检查存储权限或账户是否已切换，再重试。','Save failed. Check storage permissions or account changes and retry.'))
    } finally {setBusy(false)}
  }
  return <form className="symbolic-form" onFocus={onDraftStarted} onSubmit={event=>void submit(event)}>
    <div className="symbolic-section-head"><div><span className="symbolic-eyebrow">01 / {text('建立档案','YOUR DETAILS')}</span><h2>{initial ? text('编辑出生档案','Edit birth profile') : text('从你的出生时刻开始','Begin with your birth details')}</h2></div>{onCancel && <button type="button" className="symbolic-icon-button" aria-label={text('关闭编辑','Close editor')} onClick={onCancel}><X size={18}/></button>}</div>
    <div className="symbolic-form-grid">
      <label>{text('称呼（可选）','Name (optional)')}<input value={input.name} maxLength={60} onChange={e=>change('name',e.target.value)} autoComplete="off"/></label>
      <label>{text('与我的关系（可选）','Relationship (optional)')}<input value={input.relationship??''} maxLength={40} placeholder={text('自己、家人、朋友…','Self, family, friend…')} onChange={e=>change('relationship',e.target.value)}/></label>
      <label>{text('历法','Calendar')}<select value={input.calendar} onChange={e=>change('calendar',e.target.value as BirthInput['calendar'])}><option value="solar">{text('公历','Gregorian')}</option><option value="lunar">{text('中国农历','Chinese lunar')}</option></select></label>
      <label>{text('出生日期 · YYYY-MM-DD','Birth date · YYYY-MM-DD')}<input required value={input.date} placeholder="YYYY-MM-DD" inputMode="numeric" onChange={e=>change('date',e.target.value)}/></label>
      <label>{text('出生时刻（可留空）','Birth time (optional)')}<input type="time" value={input.time} onChange={e=>change('time',e.target.value)}/></label>
      <BirthplaceSearch value={input.place??''} onChange={place=>{change('place',place);setPlaceNeedsReview(true)}} onManual={()=>setAdvanced(true)} onSelect={place=>{setInput(prev=>({...prev,place:place.name,latitude:place.lat,longitude:place.lon,timeZone:place.zone}));setPlaceNeedsReview(false)}}/>
<label>{text('大运顺逆计算参数','Luck-cycle direction parameter')}<select value={input.direction} onChange={e=>change('direction',e.target.value as BirthInput['direction'])}><option value="">{text('不提供 · 暂不计算大运','Unspecified · no luck cycles')}</option><option value="male">{text('男命规则','Traditional male rule')}</option><option value="female">{text('女命规则','Traditional female rule')}</option></select></label>
    </div>
    {placeNeedsReview&&<p className="symbolic-note" role="status">{text('地点名称已改变。请选择下方匹配城市，或展开校正项，核对时区与坐标。','The place name changed. Choose a matching city or open the adjustments to verify its time zone and coordinates.')} <button type="button" className="symbolic-text-button" onClick={()=>setAdvanced(true)}>{text('展开校正','Open adjustments')}</button></p>}
    <details className="birth-advanced" open={advanced} onToggle={event=>setAdvanced(event.currentTarget.open)}><summary>{text('校正时区、坐标与排盘规则','Adjust time zone, coordinates and chart rules')}</summary><div className="symbolic-form-grid">
      <label>{text('出生地时区','Birthplace time zone')}<input required list="symbolic-zones" value={input.timeZone} onChange={e=>change('timeZone',e.target.value)}/><datalist id="symbolic-zones">{['Asia/Shanghai','Asia/Hong_Kong','Asia/Tokyo','Europe/London','America/New_York','America/Los_Angeles','+08:00','+00:00'].map(v=><option key={v} value={v}/>)}</datalist></label>
      <label>{text('纬度（北为正，可留空）','Latitude (north positive, optional)')}<input type="number" step="any" min={-90} max={90} value={input.latitude ?? ''} onChange={e=>change('latitude',e.target.value===''?null:Number(e.target.value))}/></label>
      <label>{text('经度（东为正，可留空）','Longitude (east positive, optional)')}<input type="number" step="any" min={-180} max={180} value={input.longitude ?? ''} onChange={e=>change('longitude',e.target.value===''?null:Number(e.target.value))}/></label>
<label>{text('日柱换日规则','Day-pillar boundary')}<select value={input.zi} onChange={e=>change('zi',Number(e.target.value) as 1|2)}><option value={2}>{text('子正 · 00:00 换日','Midnight · 00:00')}</option><option value={1}>{text('子初 · 23:00 换日','Early Zi · 23:00')}</option></select></label>
    </div>{placeNeedsReview&&<button type="button" className="symbolic-button" onClick={()=>setPlaceNeedsReview(false)}>{text('已核对时区与坐标','Time zone and coordinates verified')}</button>}</details>
    {input.calendar === 'lunar' && <label className="symbolic-check"><input type="checkbox" checked={input.leapMonth} onChange={e=>change('leapMonth',e.target.checked)}/>{text('这是闰月','This is a leap month')}</label>}
    <p className="symbolic-note">{text('不知道时刻可以留空：不推定时柱、上升或宫位。八字以北京标准时间排盘；星座以出生地时区换算。','Leave unknown time blank: no hour pillar, ascendant or houses will be inferred. BaZi uses Beijing standard time; astrology converts your birthplace time zone.')}</p>
    <p className="symbolic-note">{text('八字与星座共用此档案。登录并开启云同步后，档案随账号同步。每次修改保留旧版本。城市选项使用市中心近似坐标，可在上方修正为实际出生地点。','Shared by BaZi and Astrology. Profiles sync with your account when cloud sync is enabled. Edits retain previous versions. City presets use approximate city-center coordinates; adjust them to the actual birthplace above.')}</p>
    {error && <p className="symbolic-error" role="alert">{error}</p>}
    <button className="symbolic-button symbolic-button--primary" disabled={busy||placeNeedsReview}>{busy?text('正在保存…','Saving…'):text('保存并排盘','Save and calculate')}</button>
  </form>
}

export function ProfileVersions({ versions }: { versions: BirthProfile[] }) {
  const { text,language }=useSymbolicCopy()
  return <section className="symbolic-panel"><h2>{text('档案版本','Profile history')}</h2><p className="symbolic-note">{text('每次保存均保留原始输入。当前结果使用最新档案；旧版本仅供核对。','Each save retains the original input. Results use the latest profile; older versions are shown for reference.')}</p><div className="symbolic-table-wrap"><table><thead><tr>{[text('保存时间','Saved'),text('输入日期','Input date'),text('时刻 / 时区','Time / zone'),text('排盘口径','Rules')].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{versions.map(p=><tr key={p.version}><td>{new Date(p.savedAt).toLocaleString(language==='zh'?'zh-CN':'en-US')}</td><td>{p.date} · {p.calendar==='solar'?text('公历','Gregorian'):text('农历','Lunar')}{p.leapMonth?text(' / 闰月',' / leap'):''}</td><td>{p.time||'—'} · {p.timeZone}</td><td>{p.zi===2?'00:00':'23:00'} · {p.direction||'—'} · {p.latitude??'—'}, {p.longitude??'—'}</td></tr>)}</tbody></table></div></section>
}


function BirthplaceSearch({value,onChange,onSelect,onManual}:{value:string;onChange:(place:string)=>void;onSelect:(place:typeof BIRTHPLACES[number])=>void;onManual:()=>void}) {
 const {text}=useSymbolicCopy(),[open,setOpen]=useState(false)
 const query=value.trim().toLowerCase()
 const matches=BIRTHPLACES.filter(p=>!query||p.name.includes(query)||p.en.toLowerCase().includes(query)).slice(0,8)
 return <div className="birthplace-search"><label>{text('出生城市','Birthplace')}<input aria-label={text('搜索出生城市','Search birthplace')} placeholder={text('搜索常用城市，支持中文或英文','Search common cities in Chinese or English')} value={value} maxLength={100} onChange={e=>{onChange(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}} autoComplete="off"/></label>{open&&<div className="birthplace-results">{matches.map(p=><button type="button" key={p.name} onClick={()=>{onSelect(p);setOpen(false)}}>{text(p.name,p.en)}</button>)}<button type="button" onClick={()=>{setOpen(false);onManual()}}>{text('手动填写坐标与时区','Enter coordinates and zone manually')}</button></div>}<small className="symbolic-note">{text('内置23个常用城市，选中后填入市中心坐标与时区；其他地点可手动填写。','23 common city presets fill approximate center coordinates and time zone; enter other places manually.')}</small></div>
}
