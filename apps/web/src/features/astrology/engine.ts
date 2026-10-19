import { Body, Ecliptic, GeoVector, SiderealTime, MakeTime, e_tilt } from 'astronomy-engine'
import { resolveBirth } from '../symbolic/time'
import type { BirthInput } from '../symbolic/types'
export const ASTRO_RULE_VERSION = 'astronomy-engine 2.1.19 · AS-1'
export const SIGNS = [['白羊','Aries'],['金牛','Taurus'],['双子','Gemini'],['巨蟹','Cancer'],['狮子','Leo'],['处女','Virgo'],['天秤','Libra'],['天蝎','Scorpio'],['射手','Sagittarius'],['摩羯','Capricorn'],['水瓶','Aquarius'],['双鱼','Pisces']] as const
export const PLANETS = [{id:Body.Sun,name:['太阳','Sun'],short:'日'},{id:Body.Moon,name:['月亮','Moon'],short:'月'},{id:Body.Mercury,name:['水星','Mercury'],short:'水'},{id:Body.Venus,name:['金星','Venus'],short:'金'},{id:Body.Mars,name:['火星','Mars'],short:'火'},{id:Body.Jupiter,name:['木星','Jupiter'],short:'木'},{id:Body.Saturn,name:['土星','Saturn'],short:'土'},{id:Body.Uranus,name:['天王星','Uranus'],short:'天'},{id:Body.Neptune,name:['海王星','Neptune'],short:'海'},{id:Body.Pluto,name:['冥王星','Pluto'],short:'冥'}] as const
export const norm = (angle: number) => ((angle%360)+360)%360
export const signedDistance = (a: number,b: number) => ((a-b+540)%360)-180
export const longitude = (body: Body,date: Date) => Ecliptic(GeoVector(body,date,true)).elon
export function axes(date: Date,lat: number,lon: number) {
  // Polar horizons need separate handling; no fabricated or silent fallback ascendant.
  if (Math.abs(lat)>=66 || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const rad=Math.PI/180,theta=(SiderealTime(date)*15+lon)*rad,epsilon=e_tilt(MakeTime(date)).tobl*rad,phi=lat*rad
  const asc=norm(Math.atan2(-Math.cos(theta),Math.sin(theta)*Math.cos(epsilon)+Math.tan(phi)*Math.sin(epsilon))/rad+180)
  const mc=norm(Math.atan2(Math.sin(theta),Math.cos(theta)*Math.cos(epsilon))/rad)
  return { asc,mc,cusps:Array.from({length:12},(_,i)=>norm(asc+i*30)) }
}
export type PlanetPosition = { id: Body; lon: number; sign: number; house: number|null; motion:'direct'|'retrograde'|'stationary'|'unknown'; endLon:number|null; signCandidates:number[] }
export type Aspect = { a: Body; b: Body; angle: number; orb: number; type: 'conjunction'|'sextile'|'square'|'trine'|'opposition' }
const aspectRules: {angle:number;orb:number;type:Aspect['type']}[] = [{angle:0,orb:8,type:'conjunction'},{angle:60,orb:4,type:'sextile'},{angle:90,orb:6,type:'square'},{angle:120,orb:6,type:'trine'},{angle:180,orb:8,type:'opposition'}]
export function aspectBetween(a:PlanetPosition,b:PlanetPosition,transit=false):Aspect|null {
  const distance=Math.abs(signedDistance(a.lon,b.lon))
  const rule=aspectRules.find(r=>Math.abs(distance-r.angle)<=(transit?(a.id===Body.Moon?1:2):r.orb))
  return rule?{a:a.id,b:b.id,angle:rule.angle,orb:Math.abs(distance-rule.angle),type:rule.type}:null
}
export function planetPositions(date:Date, asc:number|null=null):PlanetPosition[] {
  return PLANETS.map(p=>{
    const lon=longitude(p.id,date)
    const speed=signedDistance(longitude(p.id,new Date(date.getTime()+3_600_000)),longitude(p.id,new Date(date.getTime()-3_600_000)))
    return {id:p.id,lon,sign:Math.floor(lon/30),house:asc===null?null:Math.floor(norm(lon-asc)/30)+1,motion:Math.abs(speed)<0.00001?'stationary':speed<0?'retrograde':'direct',endLon:null,signCandidates:[Math.floor(lon/30)]}
  })
}
export function calculateAstrology(input:BirthInput) {
  const resolved=resolveBirth(input)
  const frame=resolved.instant&&input.latitude!==null&&input.longitude!==null?axes(resolved.instant,input.latitude,input.longitude):null
  const positions=planetPositions(resolved.instant??resolved.start,frame?.asc??null)
  if (!resolved.instant) positions.forEach(p=>{p.endLon=longitude(p.id,resolved.end);p.signCandidates=[...new Set([p.sign,Math.floor(p.endLon/30)])];p.house=null;p.motion='unknown'})
  const aspects:Aspect[]=[]
  if (resolved.instant) positions.forEach((a,i)=>positions.slice(i+1).forEach(b=>{const found=aspectBetween(a,b);if(found)aspects.push(found)}))
  return {resolved,frame,positions,aspects:aspects.sort((a,b)=>a.orb-b.orb),ruleVersion:ASTRO_RULE_VERSION}
}
export function currentTransits(chart:ReturnType<typeof calculateAstrology>,date:Date) {
  if (!chart.resolved.instant) return []
  const result:Aspect[]=[]
  planetPositions(date).forEach(a=>chart.positions.forEach(b=>{const match=aspectBetween(a,b,true);if(match)result.push(match)}))
  return result.sort((a,b)=>a.orb-b.orb).slice(0,5)
}
export const degrees = (angle:number) => { const min=Math.floor(norm(angle)%30*60);return `${String(Math.floor(min/60)).padStart(2,'0')}° ${String(min%60).padStart(2,'0')}′` }
