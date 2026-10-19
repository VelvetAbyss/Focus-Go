import { describe,expect,it } from 'vitest'
import { Body,Vector,MakeTime,Observer,RotateVector,Rotation_ECT_EQD,Rotation_EQD_HOR } from 'astronomy-engine'
import { emptyBirthInput } from './types'
import { resolveBirth,solarDate } from './time'
import { calculateBazi,baziDayTheme } from '../bazi/engine'
import { axes,longitude,signedDistance,aspectBetween,planetPositions,calculateAstrology } from '../astrology/engine'
import { TAROT_DECK } from '../tarot/deck'
import { drawCards,randomBelow } from '../tarot/random'
const input=(overrides:Partial<ReturnType<typeof emptyBirthInput>>={})=>({...emptyBirthInput(),date:'2005-12-23',time:'08:37',timeZone:'+08:00',...overrides})
describe('birth time conventions',()=>{
  it('uses the requested zone independently of the browser',()=>expect(resolveBirth(input()).instant?.toISOString()).toBe('2005-12-23T00:37:00.000Z'))
  it('rejects invalid dates, nonexistent leap months, DST gaps and ambiguous hours',()=>{
    for(const override of [{date:'2024-02-30'},{date:'2024-01-01',calendar:'lunar' as const,leapMonth:true},{date:'2024-03-10',time:'02:30',timeZone:'America/New_York'},{date:'2024-11-03',time:'01:30',timeZone:'America/New_York'},{date:'2011-12-30',time:'',timeZone:'Pacific/Apia'}]) expect(()=>resolveBirth(input(override))).toThrow()
    expect(resolveBirth(input({date:'2024-11-03',time:'01:30',timeZone:'-04:00'})).instant?.toISOString()).toBe('2024-11-03T05:30:00.000Z')
  })
  it('converts lunar new year and enforces the converted range',()=>{
    expect(solarDate(input({calendar:'lunar',date:'2024-01-01'}))).toBe('2024-02-10')
    expect(()=>solarDate(input({calendar:'lunar',date:'2100-12-20'}))).toThrow()
  })
})
describe('BaZi reference fixtures',()=>{
  it('matches the upstream 2005 four-pillar fixture',()=>expect(calculateBazi(input()).pillars.map(p=>p.value)).toEqual(['乙酉','戊子','辛巳','壬辰']))
  it('respects both late-Zi conventions in natal and day calculations',()=>{
    const midnight=calculateBazi(input({date:'1988-02-15',time:'23:30',zi:2})),early=calculateBazi(input({date:'1988-02-15',time:'23:30',zi:1}))
    expect(midnight.pillars[2].value).toBe('庚子');expect(early.pillars[2].value).toBe('辛丑');expect(early.pillars[3].value).toBe('戊子')
    expect(baziDayTheme(early,early.resolved.instant!).target).toBe('辛丑')
  })
  it('changes year and month at Li Chun rather than lunar new year',()=>{
    const before=calculateBazi(input({date:'2024-02-04',time:'16:26'})),after=calculateBazi(input({date:'2024-02-04',time:'16:28'}))
    expect(before.pillars.slice(0,2).map(p=>p.value)).toEqual(['癸卯','乙丑']);expect(after.pillars.slice(0,2).map(p=>p.value)).toEqual(['甲辰','丙寅'])
  })
  it('matches the upstream Yun sect-2 start date',()=>{
    const chart=calculateBazi(input({date:'2022-03-09',time:'20:51',direction:'male'}))
    expect(chart.start).toBe('2030-12-12');expect(chart.periods).toHaveLength(8)
    expect(chart.periods[0].startDate).toBe('2030-12-12');expect(chart.periods[1].startDate).toBe('2040-12-12')
  })
  it('does not invent an hour or luck cycles for incomplete profiles',()=>{
    const chart=calculateBazi(input({time:'',direction:'male',zi:1}))
    expect(chart.pillars[3].value).toBe('');expect(chart.pillars[2].value).toBe('');expect(chart.periods).toEqual([])
    expect(chart.pillars[2].candidates.length).toBe(2);expect(calculateBazi(input({direction:''})).periods).toEqual([])
  })
})
describe('geocentric tropical astronomy',()=>{
  it('places the Sun near tropical zero at the March equinox',()=>expect(signedDistance(longitude(Body.Sun,new Date('2024-03-20T03:06:00Z')),0)).toBeCloseTo(0,1))
  it('places the ascendant on the eastern geometric horizon',()=>{
    const date=new Date('2005-12-23T00:37:00Z'),time=MakeTime(date)
    for(const [lat,lon] of [[31.23,121.47],[-33.9,151.2],[51.5,-.1]]) {
      const asc=axes(date,lat,lon)!.asc*Math.PI/180
      const equatorial=RotateVector(Rotation_ECT_EQD(time),new Vector(Math.cos(asc),Math.sin(asc),0,time))
      const horizon=RotateVector(Rotation_EQD_HOR(time,new Observer(lat,lon,0)),equatorial)
      expect(Math.abs(horizon.z)).toBeLessThan(1e-10);expect(horizon.y).toBeLessThan(0)
    }
    expect(axes(date,70,20)).toBeNull()
  })
  it('handles 0/360 aspect wrap and incomplete chart boundaries',()=>{
    const [a,b]=planetPositions(new Date('2024-01-01T00:00:00Z'))
    expect(aspectBetween({...a,lon:359},{...b,lon:1})?.orb).toBe(2)
    const chart=calculateAstrology(input({time:'',latitude:31.23,longitude:121.47}))
    expect(chart.frame).toBeNull();expect(chart.aspects).toEqual([]);expect(chart.positions.every(p=>p.house===null&&p.endLon!==null&&p.motion==='unknown')).toBe(true)
    expect(calculateAstrology(input()).frame).toBeNull()
  })
})
describe('78-card draw',()=>{
  it('has a complete unique deck and both readings for every card',()=>{
    expect(TAROT_DECK).toHaveLength(78);expect(new Set(TAROT_DECK.map(c=>c.id)).size).toBe(78);expect(TAROT_DECK.filter(c=>c.arcana==='major')).toHaveLength(22)
    expect(TAROT_DECK.every(c=>c.name.every(Boolean)&&c.upright.every(Boolean)&&c.reversed.every(Boolean))).toBe(true)
  })
  it('rejects biased tail samples and avoids duplicate cards',()=>{
    const words=[0xffffffff,17];expect(randomBelow(10,()=>words.shift()!)).toBe(7)
    const drawn=drawCards(3,false,()=>17);expect(new Set(drawn.map(c=>c.id)).size).toBe(3);expect(drawn.every(c=>!c.reversed&&!c.revealed)).toBe(true)
  })
})
