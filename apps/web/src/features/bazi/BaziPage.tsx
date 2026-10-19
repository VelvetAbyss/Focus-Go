import { useMemo, useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { BirthWorkspace, ProfileVersions } from '../symbolic/BirthWorkspace'
import { SymbolicTabs } from '../symbolic/SymbolicShell'
import { ForecastControls } from '../symbolic/ForecastControls'
import { ReportView } from '../symbolic/ReportView'
import { useSymbolicCopy, useSymbolicNow } from '../symbolic/useSymbolic'
import type { BirthProfile } from '../symbolic/types'
import { dateAtNoon } from '../symbolic/time'
import { calculateBazi } from './engine'
import { baziDateKey, baziForecast, baziNatalReport } from './reports'
import { baziAdjacentPeriodDate } from './periodNavigation'
import './reading.css'

type Tab='today'|'chart'|'cycles'
type Stage='month'|'year'|'decade'
export default function BaziPage() {
  const {text}=useSymbolicCopy()
  return <BirthWorkspace module="bazi" title={text('八字 · 四时','BaZi · Four Seasons')} subtitle={text('读懂自己的结构，找到此刻适合的节奏。','Understand your patterns and find a pace for the present.')}>{(profile,versions)=><BaziReading key={profile.id+':'+profile.version} profile={profile} versions={versions}/>}</BirthWorkspace>
}
function BaziReading({profile,versions}:{profile:BirthProfile;versions:BirthProfile[]}) {
  const {text,language}=useSymbolicCopy(),now=useSymbolicNow()
  const [tab,setTab]=useState<Tab>('today'),[stage,setStage]=useState<Stage>('month'),[selectedDate,setSelectedDate]=useState('')
  const today=baziDateKey(now,profile.zi),date=selectedDate||today,cycle=tab==='today'?'day':stage
  const result=useMemo(()=>{
    try {return {chart:calculateBazi(profile),report:tab==='chart'?baziNatalReport(profile,language):baziForecast(profile,date,cycle,language)}}
    catch {return null}
  },[profile,language,tab,date,cycle])
  const names=[text('年柱','Year'),text('月柱','Month'),text('日柱','Day'),text('时柱','Hour')]
  return <>
    <SymbolicTabs value={tab} onChange={setTab} items={[{id:'today',label:text('今日运势','Today')},{id:'chart',label:text('命盘与解读','Chart & interpretation')},{id:'cycles',label:text('阶段运势','Longer cycles')}]}/>
    {tab!=='chart'&&<>
      <ForecastControls date={date} onDate={setSelectedDate} cycle={cycle} onCycle={value=>{if(value!=='day')setStage(value)}} cycles={tab==='today'?['day']:['month','year','decade']} onToday={()=>setSelectedDate('')} onShift={tab==='cycles'&&result?.report.period?direction=>{const next=baziAdjacentPeriodDate(result.report.period!,direction);if(next)setSelectedDate(next)}:undefined}/>
      <p className="bazi-calendar-note">{text('北京标准时间 UTC+08', 'Beijing standard time UTC+08')} · {profile.zi===1?text('子初23:00换日，日期标记已经进入的干支日。','The GanZhi day changes at 23:00; the date identifies that day.'):text('子正00:00换日。','The day changes at midnight.')}</p>
    </>}
    {!result?<p className="symbolic-report-error" role="alert">{text('本次资料或日期暂时无法计算，请检查出生档案后重试。','This profile or date could not be calculated. Check the birth details and try again.')}</p>:<>
      {tab==='chart'&&<>
        {!profile.time&&<p className="symbolic-notice">{text('出生时刻待补。以下保留稳定的柱与解读，受时刻影响的部分会单独说明。','Birth time is missing. Stable pillars and interpretations remain available; time-dependent parts are identified separately.')}</p>}
        <div className="bazi-chart-grid">
          <section className="bazi-daymaster"><span className="symbolic-eyebrow">{text('日主 / 命局参照','DAY MASTER')}</span><div className="bazi-master-character">{result.chart.pillars[2].stem||'—'}</div><h2>{result.chart.dayElement?`${result.chart.pillars[2].stem}${result.chart.dayElement}`:text('时刻待确认','Time to confirm')}</h2><p>{text('把月令、根气与其他天干地支放在一起，阅读整个结构。','Read the season, roots and the other stems and branches together.')}</p><span className="bazi-seal" aria-hidden="true">四時</span></section>
          <section className="bazi-pillars" aria-label={text('四柱排盘','Four pillars')}>{result.chart.pillars.map((p,i)=><article key={i} className={'bazi-pillar'+(i===2?' bazi-pillar--day':'')}><span className="symbolic-eyebrow">{names[i]}</span><span className="bazi-god">{p.god||'—'}</span><strong>{p.stem||'—'}</strong><strong>{p.branch||'—'}</strong><span>{p.hidden.join(' · ')||'—'}</span><dl><div><dt>{text('纳音','Na Yin')}</dt><dd>{p.naYin||'—'}</dd></div><div><dt>{text('十二长生','Life stage')}</dt><dd>{p.phase||'—'}</dd></div><div><dt>{text('旬空','Void')}</dt><dd>{p.void||'—'}</dd></div></dl>{p.candidates.length>1&&<small>{text('候选：','Candidates: ')}{p.candidates.join(' / ')}</small>}</article>)}</section>
        </div>
        <details className="bazi-element-details"><summary>{text('查看表层五行分布','Visible element distribution')}</summary><div className="bazi-elements">{Object.entries(result.chart.counts).map(([element,count])=><div key={element}><span>{element}</span><div><i style={{width:count/8*100+'%'}}/></div><b>{count}</b></div>)}</div><p className="symbolic-note">{text('每个已知干支本气计1；完整报告另以月令、藏干和透干解释旺衰与喜忌。','Each known stem or main branch element counts once; the full report separately uses season, hidden stems and exposed stems for balance analysis.')}</p></details>
      </>}
      {tab==='cycles'&&<section className="bazi-stage-context">
        <div className="symbolic-section-head"><h2>{text('大运时间轴','Luck-cycle timeline')}</h2><span className="symbolic-note">{result.chart.forward===null?'':result.chart.forward?text('顺行','Forward'):text('逆行','Reverse')}</span></div>
        {result.chart.periods.length?<div className="bazi-luck-picker">{result.chart.periods.map(p=>{
          const active=dateAtNoon(date,'+08:00').getTime()>=Date.parse(p.startInstant)&&dateAtNoon(date,'+08:00').getTime()<Date.parse(p.endInstant)
          const openDate=Temporal.PlainDate.from(p.startDate).add({days:1}).toString(),supported=openDate<='2100-12-31'&&openDate>='1901-01-01'
          return <button type="button" key={p.startInstant} disabled={!supported} aria-pressed={active} onClick={()=>{if(supported){setStage('decade');setSelectedDate(openDate)}}}><small>{p.startDate} → {p.endDate}</small><strong>{p.value}</strong><span>{supported?`${p.age} ${text('岁起 · 传统岁序','traditional age')}`:text('超出1901—2100支持范围','Outside the 1901–2100 range')}</span></button>
        })}</div>:<p className="symbolic-note">{text('补充出生时刻及大运顺逆参数后，这里会出现可切换的大运。流年与流月仍可查看已知部分。','Add a birth time and direction parameter to view luck cycles. Available yearly and monthly themes remain readable.')}</p>}
      </section>}
      <ReportView report={result.report} daily={tab==='today'}/>
      {tab==='chart'&&<details className="bazi-element-details"><summary>{text('查看档案修改记录','Profile revision history')}</summary><ProfileVersions versions={versions}/></details>}
    </>}
  </>
}
