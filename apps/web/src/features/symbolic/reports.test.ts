import { describe, expect, it } from 'vitest'
import { baziAdjacentPeriodDate } from '../bazi/periodNavigation'
import { Body } from 'astronomy-engine'
import { emptyBirthInput } from './types'
import type { BirthInput } from './types'
import { calculateBazi } from '../bazi/engine'
import { analyzeBazi, baziDateKey, baziForecast, baziNatalReport } from '../bazi/reports'
import { calculateAstrology, longitude } from '../astrology/engine'
import { astrologyForecast, astrologyNatalReport, astrologyPeriod, personalTransitSignals, solarSignSignals } from '../astrology/reports'

const input=(patch:Partial<BirthInput>={}):BirthInput=>({...emptyBirthInput(),name:'Public test fixture',date:'2005-12-23',time:'08:37',timeZone:'Asia/Shanghai',latitude:31.23,longitude:121.47,direction:'male',...patch})

describe('BaZi full interpretations',()=>{
  it('keeps the verified four pillars and produces distinct supported themes',()=>{
    const report=baziNatalReport(input(),'zh')
    expect(calculateBazi(input()).pillars.map(p=>p.value)).toEqual(['乙酉','戊子','辛巳','壬辰'])
    expect(report.sections.map(s=>s.id)).toEqual(['overview','balance','personality','career','money','love'])
    expect(new Set(report.sections.slice(2).map(s=>s.summary)).size).toBe(4)
    expect(report.method.join('')).toContain('藏干')
    expect(report.scores).toBeUndefined()
  })
  it('uses roots and exposed stems instead of visible element counts',()=>{
    const chart=calculateBazi(input()),original=analyzeBazi(chart)
    expect(analyzeBazi({...chart,counts:{木:100,火:0,土:0,金:0,水:0}})).toEqual(original)
    expect(original.roots.length).toBeGreaterThan(0)
    expect(original.visible.some(s=>s.rooted)).toBe(true)
    const noRoots=analyzeBazi({...chart,pillars:chart.pillars.map(p=>({...p,hidden:p.hidden.filter(h=>!['庚','辛'].includes(h))}))})
    expect(noRoots.share).not.toBe(original.share)
  })
  it('does not fabricate a day master, strength, scores or luck cycle for an unknown late-Zi time',()=>{
    const birth=input({time:'',zi:1})
    expect(analyzeBazi(calculateBazi(birth)).strength).toBe('unknown')
    expect(baziNatalReport(birth,'en').sections.find(s=>s.id==='balance')?.summary).toContain('day master')
    expect(Object.values(baziForecast(birth,'2026-10-12','day','en').scores!)).toEqual([null,null,null,null])
    expect(baziForecast(birth,'2026-10-12','decade','zh').period).toBeUndefined()
  })
  it('keeps known pillars readable when only the hour is absent',()=>{
    const report=baziNatalReport(input({time:'',zi:2}),'en')
    expect(report.summary).toContain('Incomplete')
    expect(report.sections.find(s=>s.id==='career')!.summary).not.toContain('day master is not stable')
    expect(report.limitations.join(' ')).toContain('Unknown birth time')
  })
  it('uses a solar-term month and Li-Chun year rather than calendar labels',()=>{
    const month=baziForecast(input(),'2024-02-03','month','zh')
    expect(month.period!.start).toMatch(/^2024-01-06T/)
    expect(month.period!.end).toMatch(/^2024-02-04T16:2/)
    expect(month.title).toContain('乙丑')
    const before=baziForecast(input(),'2024-02-03','year','zh'),after=baziForecast(input(),'2024-02-05','year','zh')
    expect(before.period!.start).toMatch(/^2023-02-04T/)
    expect(before.period!.end).toBe(after.period!.start)
    expect(before.title).toContain('癸卯');expect(after.title).toContain('甲辰')
    expect(month.scores).toBeUndefined();expect(before.scores).toBeUndefined()
  })
  it('changes daily ranges with the selected Zi convention',()=>{
    const early=baziForecast(input({zi:1}),'2026-10-12','day','en'),midnight=baziForecast(input({zi:2}),'2026-10-12','day','en')
    expect(early.period).toMatchObject({start:'2026-10-11T23:00:00+08:00',end:'2026-10-12T23:00:00+08:00'})
    expect(midnight.period).toMatchObject({start:'2026-10-12T00:00:00+08:00',end:'2026-10-13T00:00:00+08:00'})
    expect(Object.values(midnight.scores!).every(s=>s===null||(s>=15&&s<=90))).toBe(true)
  })
  it('selects actual luck-cycle instants instead of the start-year shortcut',()=>{
    const birth=input({date:'2022-03-09',time:'20:51',direction:'male'})
    expect(baziForecast(birth,'2030-01-01','decade','zh').period).toBeUndefined()
    const decade=baziForecast(birth,'2031-01-01','decade','zh')
    expect(decade.period!.start).toMatch(/^2030-12-12T/);expect(decade.period!.end).toMatch(/^2040-12-12T/)
    expect(decade.scores).toBeUndefined();expect(decade.sections.map(s=>s.id)).toEqual(['overview','career','money','love'])
  })
  it('uses the same full-period luck background before and after a mid-period start',()=>{
    const birth=input({date:'2022-03-09',time:'20:51',direction:'male'})
    for(const [cycle,first,last] of [['year','2030-06-01','2030-12-20'],['month','2030-12-10','2030-12-20']] as const){
      const before=baziForecast(birth,first,cycle,'en'),after=baziForecast(birth,last,cycle,'en')
      expect(before).toEqual(after)
      expect(before.sections[0].paragraphs.join(' ')).toContain('2030-12-12')
      expect(before.sections[0].paragraphs.join(' ')).toContain('falls before or outside')
    }
  })
  it('labels the early-Zi day consistently for page and widget at 23:30',()=>{
    const now=new Date('2026-10-12T15:30:00Z')
    expect(baziDateKey(now,1)).toBe('2026-10-13')
    expect(baziDateKey(now,2)).toBe('2026-10-12')
    const report=baziForecast(input({zi:1}),baziDateKey(now,1),'day','en')
    expect(Date.parse(report.period!.start)).toBeLessThan(now.getTime())
    expect(Date.parse(report.period!.end)).toBeGreaterThan(now.getTime())
    expect(report.period!.timeZone).toBe('+08:00')
  })
  it('depends on natal structure and calendar facts, never nickname hashes',()=>{
    const original=baziForecast(input(),'2026-10-12','day','en')
    expect(baziForecast(input({name:'Renamed'}),'2026-10-12','day','en')).toEqual(original)
    expect(baziForecast(input({date:'1990-07-01'}),'2026-10-12','day','en').sections).not.toEqual(original.sections)
    expect(baziForecast(input(),'2026-10-13','day','en').sections[0].evidence).not.toEqual(original.sections[0].evidence)
  })
})

describe('astrology synthesis and period forecasts',()=>{
  it('builds a full natal report with house rulers and independent MC',()=>{
    const report=astrologyNatalReport(input(),'zh')
    expect(report.sections.map(s=>s.id)).toEqual(['overview','personality','career','money','love'])
    expect(report.sections.find(s=>s.id==='career')!.paragraphs.join('')).toContain('守护星')
    expect(report.summary).toContain('MC');expect(report.method.join('')).toContain('MC 独立')
    expect(report.scores).toBeUndefined()
  })
  it('includes a theme planet’s outer-planet aspect without admitting unrelated outer pairs',()=>{
    const birth=input({date:'1993-01-01'})
    const chart=calculateAstrology(birth)
    expect(chart.aspects.some(a=>[a.a,a.b].includes(Body.Uranus)&&[a.a,a.b].includes(Body.Neptune))).toBe(true)
    const career=astrologyNatalReport(birth,'en').sections.find(s=>s.id==='career')!
    expect(career.evidence.some(e=>e.includes('Sun')&&(e.includes('Neptune')||e.includes('Uranus')))).toBe(true)
    expect(career.evidence.some(e=>e.includes('Uranus')&&e.includes('Neptune'))).toBe(false)
  })
  it('explains every tied element and mode instead of selecting the first array item',()=>{
    const p=astrologyNatalReport(input({date:'1988-09-15'}),'en').sections.find(s=>s.id==='personality')!
    expect(p.summary).toContain('Fire / Earth / Air / Water')
    expect(p.summary).toContain('Cardinal / Fixed')
    for(const element of ['Fire','Earth','Air','Water'])expect(p.paragraphs.some(v=>v.startsWith(element))).toBe(true)
    for(const mode of ['Cardinal','Fixed'])expect(p.paragraphs.some(v=>v.startsWith(mode))).toBe(true)
  })
  it('does not invent houses or fixed changing placements for unknown time',()=>{
    const birth=input({time:''}),report=astrologyNatalReport(birth,'en')
    expect(report.summary).not.toContain('Ascendant ·')
    expect(report.sections.flatMap(s=>s.paragraphs).join(' ')).not.toMatch(/its ruler .* is in house/)
    expect(report.limitations.join(' ')).toContain('Unknown birth time')
    const forecast=astrologyForecast(birth,'2026-10-12','day','en')
    expect(Object.values(forecast.scores!)).toEqual([null,null,null,null])
    expect(forecast.method.join(' ')).toContain('without personal scores')
    expect(forecast.method.join(' ')).not.toContain('Daily scoring:')
    expect(forecast.sections.flatMap(s=>s.paragraphs).join(' ')).not.toContain('Scores account for both')
    expect(report.sections.find(s=>s.id==='career')!.evidence.length).toBeGreaterThan(0)
  })
  it('uses report-zone calendar bounds through daylight saving and leap years',()=>{
    const day=astrologyPeriod('2024-03-10','day','America/New_York')
    expect((day.end.getTime()-day.start.getTime())/3_600_000).toBe(23)
    expect(astrologyPeriod('2024-02-29','month','Asia/Shanghai').lastDate).toBe('2024-02-29')
    const week=astrologyPeriod('2026-10-14','week','Asia/Shanghai')
    expect(week.firstDate).toBe('2026-10-12');expect(week.lastDate).toBe('2026-10-18')
  })
  it('aggregates annual transits throughout the year instead of the nearest instantaneous five',()=>{
    const data=personalTransitSignals(calculateAstrology(input()),'2026-10-12','year','Asia/Shanghai')
    expect(data.sampleCount).toBeGreaterThan(120);expect(data.stepHours).toBe(72)
    expect(data.signals.length).toBeGreaterThan(5)
    expect(data.signals.every(s=>[Body.Jupiter,Body.Saturn,Body.Uranus,Body.Neptune,Body.Pluto].includes(s.body))).toBe(true)
    const dates=data.signals.flatMap(s=>s.windows.flatMap(w=>[w.first.getTime(),w.last.getTime()]))
    expect(Math.max(...dates)-Math.min(...dates)).toBeGreaterThan(250*86400000)
    expect(data.signals.some(s=>s.windows.length>1)).toBe(true)
    for(const signal of data.signals) for(const window of signal.windows) {
      expect(window.first.getTime()).toBeGreaterThanOrEqual(data.period.start.getTime())
      expect(window.last.getTime()).toBeLessThan(data.period.end.getTime());expect(window.minOrb).toBeLessThanOrEqual(2)
    }
  })
  it('uses different ranges and samples, and scores only daily reports',()=>{
    const reports=(['day','week','month','year'] as const).map(cycle=>astrologyForecast(input(),'2026-10-12',cycle,'en'))
    expect(Object.keys(reports[0].scores!)).toEqual(['overall','career','money','love'])
    expect(reports.slice(1).map(r=>r.scores)).toEqual([undefined,undefined,undefined])
    for(const report of reports.slice(1))expect(report.method.join(' ')).not.toMatch(/Daily scoring:|Grouped daily scores/)
    expect(astrologyForecast(0,'2026-10-12','year','en').method.join(' ')).not.toContain('Grouped daily scores')
    expect(new Set(reports.map(r=>r.period!.end)).size).toBe(4)
    expect(reports[1].sections).not.toEqual(reports[0].sections);expect(reports[3].sections).not.toEqual(reports[2].sections)
    expect(reports[3].method.join(' ')).toContain('not root-solved')
  })
  it('computes zodiac content from actual sign positions, without an invented natal midpoint',()=>{
    const generic=solarSignSignals(0,'2026-10-12','day','Asia/Shanghai'),sun=generic.signals.find(s=>s.body===Body.Sun)!
    const actualSign=Math.floor(longitude(Body.Sun,generic.period.start)/30)
    expect(sun.sign).toBe(actualSign);expect(sun.house).toBe(actualSign+1)
    const libra=solarSignSignals(6,'2026-10-12','day','Asia/Shanghai').signals.find(s=>s.body===Body.Sun)!
    expect(libra.house).toBe((actualSign-6+12)%12+1)
    expect(astrologyForecast(0,'2026-10-12','day','en').method.join(' ')).toContain('no fictitious 15°')
  })
  it('labels generic yearly reports and keeps all topic interpretations',()=>{
    const report=astrologyForecast(8,'2026-10-12','year','zh')
    expect(report.title).toContain('太阳星座速览')
    expect(report.sections.map(s=>s.id)).toEqual(['overall','career','money','love'])
    expect(report.scores).toBeUndefined();expect(report.limitations.join('')).toContain('不能替代个人星盘')
  })
  it('derives daily action suggestions from actual period signals, keeping disclaimers outside widget content',()=>{
    const bazi=baziForecast(input(),'2026-10-12','day','zh')
    const tomorrow=baziForecast(input(),'2026-10-13','day','zh')
    expect(bazi.dos).not.toEqual(tomorrow.dos)
    expect(bazi.donts.join('')).not.toMatch(/分数|运势|投资/)
    const horoscope=astrologyForecast(input(),'2026-10-12','day','zh')
    expect(horoscope.dos.length).toBeGreaterThan(0)
    expect(horoscope.donts.join('')).not.toMatch(/分数|相位|象征/)
    expect(astrologyForecast(input(),'2026-10-12','year','zh').dos).toEqual([])
    expect(baziForecast(input(),'2026-10-12','month','zh').donts).toEqual([])
  })
  it('rejects invalid dates and solar-sign groups instead of returning invented content',()=>{
    expect(()=>astrologyForecast(12,'2026-10-12','day','zh')).toThrow(RangeError)
    expect(()=>astrologyForecast(1,'2200-10-12','day','zh')).toThrow(RangeError)
    expect(()=>baziForecast(input(),'1800-01-01','day','zh')).toThrow(RangeError)
  })
})


describe('solar-term period navigation',()=>{
 it('moves to a different actual BaZi period even when term boundaries fall after noon',()=>{
  for(const [date,cycle,direction,expected] of [
   ['2024-05-05','month',1,'2024-06-06'],['2024-06-05','month',-1,'2024-05-04'],
   ['2024-02-04','year',-1,'2023-02-03'],['2027-02-04','year',1,'2028-02-05'],
  ] as const){
   const current=baziForecast(input(),date,cycle,'zh')
   const next=baziAdjacentPeriodDate(current.period!,direction)
   expect(next).toBe(expected)
   expect(baziForecast(input(),next!,cycle,'zh').period!.start).not.toBe(current.period!.start)
  }
 })
})
