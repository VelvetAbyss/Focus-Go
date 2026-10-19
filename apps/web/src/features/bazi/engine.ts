import { Solar } from 'lunar-typescript'
import { resolveBirth, zonedParts } from '../symbolic/time'
import type { BirthInput } from '../symbolic/types'
export const BAZI_RULE_VERSION = 'lunar-typescript 1.8.6 · BZ-1'
const ELEMENTS: Record<string,string> = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水',子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' }
export type Pillar = { value: string; stem: string; branch: string; hidden: string[]; god: string; naYin: string; phase: string; void: string; candidates: string[] }
function eightChar(date: Date, sect: 1|2) {
  const p = zonedParts(date,'+08:00')
  const ec = Solar.fromYmdHms(p.year,p.month,p.day,p.hour,p.minute,p.second).getLunar().getEightChar()
  ec.setSect(sect)
  return ec
}
function readPillars(ec: ReturnType<typeof eightChar>): Pillar[] {
  return [
    [ec.getYear(),ec.getYearHideGan(),ec.getYearShiShenGan(),ec.getYearNaYin(),ec.getYearDiShi(),ec.getYearXunKong()],
    [ec.getMonth(),ec.getMonthHideGan(),ec.getMonthShiShenGan(),ec.getMonthNaYin(),ec.getMonthDiShi(),ec.getMonthXunKong()],
    [ec.getDay(),ec.getDayHideGan(),'日主',ec.getDayNaYin(),ec.getDayDiShi(),ec.getDayXunKong()],
    [ec.getTime(),ec.getTimeHideGan(),ec.getTimeShiShenGan(),ec.getTimeNaYin(),ec.getTimeDiShi(),ec.getTimeXunKong()],
  ].map(([value,hidden,god,naYin,phase,empty]) => ({ value: value as string, stem: (value as string)[0], branch: (value as string)[1], hidden: hidden as string[], god: god as string, naYin: naYin as string, phase: phase as string, void: empty as string, candidates: [value as string] }))
}
export function calculateBazi(input: BirthInput) {
  const resolved = resolveBirth(input)
  const first = eightChar(resolved.instant ?? resolved.start,input.zi)
  const pillars = readPillars(first)
  if (!resolved.instant) {
    const last = readPillars(eightChar(resolved.end,input.zi))
    pillars.forEach((p,i) => {
      p.candidates = i === 3 ? [] : [...new Set([p.value,last[i].value])]
      if (i === 3 || p.candidates.length !== 1) { p.value='';p.stem='';p.branch='';p.hidden=[];p.god='';p.naYin='';p.phase='';p.void='' }
    })
    // Derived relations all depend on the day stem; do not keep a sampled one.
    if (!pillars[2].value) pillars.forEach(p => { p.god='';p.phase='';p.void='' })
  }
  const counts = Object.fromEntries(['木','火','土','金','水'].map(e => [e,0]))
  pillars.forEach(p => { for (const char of p.value) counts[ELEMENTS[char]]++ })
  const yun = resolved.instant && input.direction ? first.getYun(input.direction === 'male' ? 1 : 0,2) : null
  const periods = yun ? yun.getDaYun(9).filter(p => p.getIndex()>0).map(p => ({ value:p.getGanZhi(), startYear:p.getStartYear(), endYear:p.getEndYear(), age:p.getStartAge(), startDate:yun.getStartSolar().nextYear((p.getIndex()-1)*10).toYmd(), endDate:yun.getStartSolar().nextYear(p.getIndex()*10).toYmd(), startInstant:yun.getStartSolar().nextYear((p.getIndex()-1)*10).toYmdHms().replace(' ', 'T')+'+08:00', endInstant:yun.getStartSolar().nextYear(p.getIndex()*10).toYmdHms().replace(' ', 'T')+'+08:00' })) : []
  const normalized = resolved.instant ? zonedParts(resolved.instant,'+08:00') : null
  return { zi:input.zi,pillars,counts,periods,dayElement: ELEMENTS[pillars[2].stem] ?? null, start:yun?.getStartSolar().toYmd() ?? null, forward:yun?.isForward() ?? null, normalized, resolved, ruleVersion:BAZI_RULE_VERSION }
}
const combinations = ['子丑','寅亥','卯戌','辰酉','巳申','午未']
const clashes = ['子午','丑未','寅申','卯酉','辰戌','巳亥']
export function baziDayTheme(chart: ReturnType<typeof calculateBazi>, date: Date) {
  const today = eightChar(date,chart.zi)
  const target = today.getDay()
  const relationships = chart.pillars.flatMap<{pillar:number;kind:'clash'|'combine';pair:string}>((p,i) => {
    if (!p.branch) return []
    const pair = p.branch+target[1], reversed = target[1]+p.branch
    if (clashes.some(v=>v===pair||v===reversed)) return [{ pillar:i, kind:'clash' as const, pair }]
    if (combinations.some(v=>v===pair||v===reversed)) return [{ pillar:i, kind:'combine' as const, pair }]
    return []
  })
  return { target, year:today.getYear(),month:today.getMonth(),relationships, kind: relationships.some(r=>r.kind==='clash')?'adapt':relationships.length?'connect':'steady' }
}
