import { useMemo, useState } from 'react'
import { Body } from 'astronomy-engine'
import { BirthWorkspace, ProfileVersions } from '../symbolic/BirthWorkspace'
import { DataStatus, SymbolicShell, SymbolicTabs } from '../symbolic/SymbolicShell'
import { ForecastControls } from '../symbolic/ForecastControls'
import { ReportView } from '../symbolic/ReportView'
import { useSymbolic, useSymbolicCopy, useSymbolicNow } from '../symbolic/useSymbolic'
import type { BirthProfile } from '../symbolic/types'
import { localDateKey } from '../symbolic/time'
import { calculateAstrology, degrees, SIGNS, PLANETS, norm, type Aspect } from './engine'
import { astrologyForecast, astrologyNatalReport } from './reports'
import { resolveAstrologySource, useAstrologySelection } from './useAstrologySelection'
import './reading.css'

const GLYPHS=['♈︎','♉︎','♊︎','♋︎','♌︎','♍︎','♎︎','♏︎','♐︎','♑︎','♒︎','♓︎']
const role:Record<string,[string,string]>={Sun:['意志与自我表达','Identity and expression'],Moon:['情绪与安定感','Emotions and security'],Mercury:['思考与交流','Thinking and communication'],Venus:['喜好与关系','Values and relationships'],Mars:['行动与边界','Action and boundaries'],Jupiter:['探索与拓展','Learning and expansion'],Saturn:['责任与长期建设','Responsibility and structure'],Uranus:['变化与独立','Change and independence'],Neptune:['想象与理想','Imagination and ideals'],Pluto:['深层调整','Deep adjustment']}
const styles:[string,string][]=[['直接开始，也听见不同的节奏。','Begin directly, while noticing other people’s pace.'],['重视稳定，也给新可能留一个位置。','Value stability, and leave room for a new possibility.'],['保持好奇，把信息整理成清楚的表达。','Stay curious and turn information into clear expression.'],['看见感受，也说清自己的需要。','Notice your feelings and state your needs.'],['愿意展现自己，也为他人留出舞台。','Express yourself and leave space for others.'],['把细节做好，也允许过程并不完美。','Care for details and allow an imperfect process.'],['寻找平衡前，先辨认自己的立场。','Recognize your own position before seeking balance.'],['认真靠近，也尊重彼此的边界。','Engage deeply while respecting boundaries.'],['给探索空间，也让想法落到一步行动。','Explore freely and bring one idea into action.'],['看见长远目标，也认可眼前的进展。','Keep long-term goals in view and recognize present progress.'],['保持独立思考，也观察想法如何帮助他人。','Think independently and consider how ideas help others.'],['容纳想象，也用具体步骤照顾现实。','Make room for imagination and ground it in a concrete step.']]
const aspectName=(type:Aspect['type'],zh:boolean)=>({conjunction:zh?'合相':'Conjunction',sextile:zh?'六合':'Sextile',square:zh?'刑相':'Square',trine:zh?'拱相':'Trine',opposition:zh?'对冲':'Opposition'})[type]
type Cycle='day'|'week'|'month'|'year'
type Tab='today'|'chart'|'cycles'

export default function AstrologyPage(){
  const {owner,data,ready,error}=useSymbolic(),{text}=useSymbolicCopy()
  const selection=useAstrologySelection(owner)
  const source=resolveAstrologySource(selection,Boolean(data.profile))
  return <SymbolicShell module="astrology" title={text('星座 · 星图','Astrology · Personal Atlas')} subtitle={text('从今天的天空出发，读见自己的方向。','Begin with today’s sky and explore your own direction.')}>
    {!ready||error?<DataStatus ready={ready} error={error}/>:<>
      <nav className="astro-source-tabs" aria-label={text('星座内容来源','Astrology source')}><button type="button" aria-pressed={source==='personal'} onClick={()=>selection.setSelection({source:'personal'})}>{text('个人星盘','Personal chart')}</button><button type="button" aria-pressed={source==='sign'} onClick={()=>selection.setSelection({source:'sign'})}>{text('十二星座速览','Twelve Sun signs')}</button></nav>
      {source==='personal'?<BirthWorkspace bare module="astrology" title={text('个人星盘','Personal chart')} subtitle="">{(profile,versions)=><AstrologyReading key={profile.id+':'+profile.version} profile={profile} versions={versions} timeZone={data.timeZone}/>}</BirthWorkspace>:<SignOverview key={owner} sign={selection.sign} onSelect={sign=>selection.setSelection({source:'sign',sign})} timeZone={data.timeZone} onPersonal={()=>selection.setSelection({source:'personal'})}/>}
    </>}
  </SymbolicShell>
}
function SignOverview({sign,onSelect,timeZone,onPersonal}:{sign:number|null;onSelect:(sign:number)=>void;timeZone:string;onPersonal:()=>void}){
  const {text,language,zh}=useSymbolicCopy(),now=useSymbolicNow(),lang=zh?0:1
  const [cycle,setCycle]=useState<Cycle>('day'),[selectedDate,setSelectedDate]=useState(''),[choosing,setChoosing]=useState(false)
  const today=localDateKey(now,timeZone),date=selectedDate||today
  const report=useMemo(()=>{try{return sign===null?null:astrologyForecast(sign,date,cycle,language,timeZone)}catch{return null}},[sign,date,cycle,language,timeZone])
  return <>
    {sign!==null&&<div className="astro-sign-portrait"><span aria-hidden="true">{GLYPHS[sign]}</span><div><span className="symbolic-eyebrow">{text('太阳星座 · 大众速览','SUN-SIGN OVERVIEW')}</span><h2>{SIGNS[sign][lang]}</h2><p>{styles[sign][lang]}</p><button type="button" className="symbolic-text-button" onClick={()=>setChoosing(!choosing)}>{choosing?text('收起选择','Close selection'):text('切换星座','Choose another sign')}</button></div></div>}
    {(sign===null||choosing)&&<section aria-label={text('选择太阳星座','Choose a Sun sign')}>
      {sign===null&&<div className="astro-sign-intro"><h2>{text('先选你的太阳星座','Choose your Sun sign')}</h2><p>{text('直接查看日、周、月、年趋势。更个人化的解读，可以进入个人星盘建立出生档案。','Explore daily, weekly, monthly and yearly themes. For an individual reading, open Personal chart and add your birth details.')}</p></div>}
      <div className="astro-sign-grid">{SIGNS.map((s,i)=><button type="button" key={s[1]} aria-pressed={sign===i} onClick={()=>{onSelect(i);setChoosing(false)}}><span aria-hidden="true">{GLYPHS[i]}</span><span>{s[lang]}</span></button>)}</div>
      {sign===null&&<button type="button" className="symbolic-text-button" onClick={onPersonal}>{text('用出生资料生成个人星盘 →','Create a chart from birth details →')}</button>}
    </section>}
    {sign!==null&&<><ForecastControls date={date} onDate={setSelectedDate} cycle={cycle} onCycle={setCycle} cycles={['day','week','month','year']} onToday={()=>setSelectedDate('')}/>{report?<ReportView report={report} daily={cycle==='day'}/>:<ReportError/>}</>}
  </>
}
function ReportError(){const {text}=useSymbolicCopy();return <p role="alert" className="symbolic-report-error">{text('本次资料或日期暂时无法计算，请检查后重试。','This profile or date could not be calculated. Check the details and try again.')}</p>}
function AstrologyReading({profile,versions,timeZone}:{profile:BirthProfile;versions:BirthProfile[];timeZone:string}){
  const {text,zh,language}=useSymbolicCopy(),lang=zh?0:1,now=useSymbolicNow()
  const [tab,setTab]=useState<Tab>('today'),[stage,setStage]=useState<Exclude<Cycle,'day'>>('week'),[selectedDate,setSelectedDate]=useState(''),[selected,setSelected]=useState<Body>(Body.Sun)
  const today=localDateKey(now,timeZone),date=selectedDate||today,cycle=tab==='today'?'day':stage
  const result=useMemo(()=>{try{return {chart:calculateAstrology(profile),report:tab==='chart'?astrologyNatalReport(profile,language):astrologyForecast(profile,date,cycle,language,timeZone)}}catch{return null}},[profile,language,tab,date,cycle,timeZone])
  const name=(id:Body)=>PLANETS.find(p=>p.id===id)!.name[lang]
  const chart=result?.chart,position=chart?.positions.find(p=>p.id===selected)
  return <>
    <SymbolicTabs value={tab} onChange={setTab} items={[{id:'today',label:text('今日运势','Today')},{id:'chart',label:text('星盘与解读','Chart & interpretation')},{id:'cycles',label:text('周期运势','Longer cycles')}]}/>
    {tab!=='chart'&&<ForecastControls date={date} onDate={setSelectedDate} cycle={cycle} onCycle={value=>{if(value!=='day')setStage(value)}} cycles={tab==='today'?['day']:['week','month','year']} onToday={()=>setSelectedDate('')}/>}
    {!result||!chart||!position?<ReportError/>:<>
      {tab==='chart'&&<>
        {!chart.frame&&<p className="symbolic-notice">{!profile.time?text('出生时刻待补：完整报告会保留全天采样稳定的位置与关系，上升及宫位留空。','Birth time is missing: the report retains placements and relationships stable across daily samples; ascendant and houses remain open.'):profile.latitude===null||profile.longitude===null?text('补充出生地坐标后可计算上升与宫位。','Add birthplace coordinates to calculate the ascendant and houses.'):text('本版暂不计算绝对纬度66°及以上地点的上升与宫位。','Ascendant and houses are unavailable at absolute latitudes of 66° or more in this version.')}</p>}
        <div className="astro-layout"><section className="astro-map"><div className="symbolic-section-head"><span className="symbolic-eyebrow">{text('出生星图','NATAL SKY')}</span><span className="symbolic-note">{text('回归黄道 · 等宫制','Tropical · Equal houses')}</span></div>{chart.resolved.instant?<ZodiacWheel chart={chart} selected={selected} onSelect={setSelected}/>:<div className="astro-unknown"><span aria-hidden="true">◌</span><h2>{text('稳定的线索，先读起来','Start with the stable patterns')}</h2><p>{text('完整报告保留可判断部分。补全时刻后，再展开上升与宫位。','The full report retains what can be interpreted. Add the birth time to reveal the ascendant and houses.')}</p></div>}<div className="astro-triad">{chart.positions.slice(0,2).map(p=><div key={p.id}><small>{name(p.id)}</small><strong>{p.signCandidates.map(s=>SIGNS[s][lang]).join(' / ')}</strong></div>)}<div><small>{text('上升','Ascendant')}</small><strong>{chart.frame?SIGNS[Math.floor(chart.frame.asc/30)][lang]:'—'}</strong></div></div></section>
        <aside className="astro-interpretation"><span className="symbolic-eyebrow">{text('选择星体，逐一阅读','SELECT A PLANET')}</span><div className="astro-planet-picker">{PLANETS.map(p=><button type="button" key={p.id} aria-pressed={p.id===selected} onClick={()=>setSelected(p.id)}>{p.name[lang]}</button>)}</div><div className="astro-selection"><span className="astro-large-symbol" aria-hidden="true">{['☉','☽','☿','♀','♂','♃','♄','♅','♆','♇'][PLANETS.findIndex(p=>p.id===selected)]}</span><h2>{name(selected)} · {position.signCandidates.map(s=>SIGNS[s][lang]).join(' / ')}</h2><span>{chart.resolved.instant?degrees(position.lon):text('日内参考，时刻待补','Daily reference; time needed')}{position.house?` · ${text('第','House ')}${position.house}${text('宫','')}`:''}</span><h3>{role[selected][lang]}</h3><p>{position.signCandidates.length===1?styles[position.sign][lang]:text('当天经过星座交界，补全时刻后可确定落座。','The day crosses a sign boundary; an exact time will settle the placement.')}</p></div></aside></div>
      </>}
      <ReportView report={result.report} daily={tab==='today'}/>
      {tab==='chart'&&<>
        <details className="astro-data-details"><summary>{text('查看星体位置、宫位与相位','Planet positions, houses and aspects')}</summary><div className="symbolic-table-wrap"><table><thead><tr>{[text('星体','Planet'),text('星座 / 度数','Sign / degree'),text('宫位','House'),text('视运动','Motion')].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{chart.positions.map(p=><tr key={p.id}><th><button className="symbolic-text-button" onClick={()=>setSelected(p.id)}>{name(p.id)}</button></th><td>{SIGNS[p.sign][lang]} {degrees(p.lon)}{p.endLon!==null&&<><br/><span className="symbolic-note">→ {SIGNS[Math.floor(p.endLon/30)][lang]} {degrees(p.endLon)} {text('（日初 → 日末）','(start → end)')}</span></>}</td><td>{p.house??'—'}</td><td>{!chart.resolved.instant?'—':p.motion==='retrograde'?text('逆行','Retrograde'):p.motion==='stationary'?text('近驻留','Near station'):text('顺行','Direct')}</td></tr>)}</tbody></table></div>{chart.frame&&<p className="symbolic-note">MC · {SIGNS[Math.floor(chart.frame.mc/30)][lang]} {degrees(chart.frame.mc)}</p>}{chart.aspects.length>0&&<div className="astro-aspect-list">{chart.aspects.map(a=><div key={`${a.a}:${a.b}`}><span>{name(a.a)} · {name(a.b)}</span><b>{aspectName(a.type,zh)}</b><small>{text('容许度偏差','Orb')} {a.orb.toFixed(2)}°</small></div>)}</div>}{!chart.resolved.instant&&<p className="symbolic-note">{text('表格列出日初与日末参考位置；全文稳定性另用全天采样判断，日内驻留不由起止点直接推断。','The table lists day-start/end reference positions; the report separately checks day-wide stability and does not infer stations from endpoints.')}</p>}</details>
        <details className="astro-data-details"><summary>{text('查看档案修改记录','Profile revision history')}</summary><ProfileVersions versions={versions}/></details>
      </>}
    </>}
  </>
}
function ZodiacWheel({chart,selected,onSelect}:{chart:ReturnType<typeof calculateAstrology>;selected:Body;onSelect:(id:Body)=>void}) {
  const {zh}=useSymbolicCopy(), lang=zh?0:1
  const reference=chart.frame?.asc??0
  const point=(lon:number,r:number)=>{const a=(180-(lon-reference))*Math.PI/180;return {x:260+r*Math.cos(a),y:260-r*Math.sin(a)}}
  const sorted=[...chart.positions].sort((a,b)=>norm(a.lon-reference)-norm(b.lon-reference))
  return <svg className="astro-wheel" viewBox="0 0 520 520" role="group" aria-label={zh?'本命星图，可选择星体':'Natal chart; select a planet'}>
    <circle cx="260" cy="260" r="226" className="astro-ring"/><circle cx="260" cy="260" r="188" className="astro-ring"/><circle cx="260" cy="260" r="138" className="astro-ring astro-ring--inner"/>
    {SIGNS.map((s,i)=>{const a=point(i*30,188),b=point(i*30,226),label=point(i*30+15,208);return <g key={s[1]}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="astro-line"/><text x={label.x} y={label.y} dominantBaseline="middle" textAnchor="middle" className="astro-sign-label">{zh?s[0]:s[1].slice(0,3)}</text></g>})}
    {chart.frame?.cusps.map((c,i)=>{const a=point(c,138),b=point(c,188),label=point(c+15,150);return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="astro-line"/><text x={label.x} y={label.y} textAnchor="middle" className="astro-house-label">{i+1}</text></g>})}
    {chart.aspects.filter(a=>a.a===selected||a.b===selected).map(a=>{const p=point(chart.positions.find(p=>p.id===a.a)!.lon,137),q=point(chart.positions.find(p=>p.id===a.b)!.lon,137);return <line key={`${a.a}:${a.b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={`astro-aspect astro-aspect--${a.type}`}/>})}
    {sorted.map((p,i)=>{const target=point(p.lon,188),near=sorted.some((q,j)=>j!==i&&Math.abs(((q.lon-p.lon+540)%360)-180)<13),label=point(p.lon,near?(i%2?111:169):169);return <g key={p.id} tabIndex={0} role="button" aria-label={`${PLANETS.find(b=>b.id===p.id)!.name[lang]} ${SIGNS[p.sign][lang]}`} aria-pressed={selected===p.id} className={`astro-planet ${selected===p.id?'is-selected':''}`} onClick={()=>onSelect(p.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.id)}}}><line x1={target.x} y1={target.y} x2={label.x} y2={label.y} className="astro-line"/><circle cx={label.x} cy={label.y} r="14"/><text x={label.x} y={label.y} dominantBaseline="middle" textAnchor="middle">{zh?PLANETS.find(b=>b.id===p.id)!.short:p.id.slice(0,2)}</text></g>})}
    {chart.frame&&<text x="10" y="264" className="astro-house-label">ASC</text>}
  </svg>
}
