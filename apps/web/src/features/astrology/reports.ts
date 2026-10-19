import { Temporal } from '@js-temporal/polyfill'
import { Body } from 'astronomy-engine'
import { calculateAstrology, longitude, norm, PLANETS, SIGNS, aspectBetween } from './engine'
import type { Aspect, PlanetPosition } from './engine'
import { reportText, scoreFromEvidence, topicName, TOPICS } from '../symbolic/report'
import type { InterpretationReport, ReportSection, ReportTopic } from '../symbolic/report'
import type { BirthInput, Language } from '../symbolic/types'

export const ASTROLOGY_REPORT_VERSION = 'AS-report-2.0'
type Chart=ReturnType<typeof calculateAstrology>
type Cycle='day'|'week'|'month'|'year'
const ELEMENT_NAMES=[['火象','Fire'],['土象','Earth'],['风象','Air'],['水象','Water']]
const MODE_NAMES=[['基本','Cardinal'],['固定','Fixed'],['变动','Mutable']]
const RULERS=[Body.Mars,Body.Venus,Body.Mercury,Body.Moon,Body.Sun,Body.Mercury,Body.Venus,Body.Mars,Body.Jupiter,Body.Saturn,Body.Saturn,Body.Jupiter]
const ASPECT_NAMES:Record<Aspect['type'],[string,string]>={conjunction:['合相','conjunction'],sextile:['六合','sextile'],square:['刑相','square'],trine:['拱相','trine'],opposition:['对冲','opposition']}
const HOUSES=[['自我与表达','self-presentation'],['收入与资源','income and resources'],['沟通与学习','communication and learning'],['家与归属','home and belonging'],['创作与恋爱','creativity and romance'],['工作与日常安排','work and routines'],['伴侣与协作','partnership and cooperation'],['共同资源与承诺','shared resources and commitments'],['视野与长期学习','perspective and higher learning'],['事业与公共责任','career and public responsibility'],['同伴与长期目标','communities and long-term goals'],['独处与收尾','solitude and closure']]
const PLANET_MEANING:Partial<Record<Body,[string,string]>>={
  [Body.Sun]:['自我方向与主动投入','direction and initiative'],[Body.Moon]:['情绪节奏与安全感','emotional rhythm and reassurance'],[Body.Mercury]:['理解、沟通与协商','understanding, communication and negotiation'],[Body.Venus]:['价值感、吸引与互惠','values, attraction and reciprocity'],[Body.Mars]:['行动、竞争与边界','action, competition and boundaries'],[Body.Jupiter]:['拓展、信任与机会','expansion, trust and opportunity'],[Body.Saturn]:['结构、责任与限制','structure, responsibility and limits'],[Body.Uranus]:['变化、独立与新方法','change, independence and new methods'],[Body.Neptune]:['想象、共情与边界模糊','imagination, empathy and blurred boundaries'],[Body.Pluto]:['深层调整、控制与放下','deep adjustment, control and letting go'],
}
const SIGN_STYLE:[string,string][]=[
  ['先行动、后校准；敢于发起，也需要给协商留空间。','Start first, then adjust; initiative helps, while negotiation needs room.'],
  ['重视可持续与可触摸的成果；稳定能积累力量，也要避免把习惯当唯一办法。','Value continuity and tangible results; stability supports accumulation, but habit is not the only method.'],
  ['通过提问、比较和交流寻找方向；好奇能带来连接，也要给结论与落实留时间。','Find direction through questions, comparison and exchange; curiosity creates links, while decisions and follow-through need time.'],
  ['先感知环境与关系中的安全感；照顾能凝聚人，也需要说明自己的边界。','Sense emotional safety before acting; care can connect people, while personal boundaries still need expression.'],
  ['需要明确表达与被看见的空间；创造力适合有回应的场景，也需听到不同意见。','Need space for expression and recognition; creativity benefits from a responsive setting and differing views.'],
  ['倾向拆解问题、改进细节；精准能够提升质量，也要避免无限修正拖延完成。','Break down problems and improve details; precision supports quality, but endless revision can prevent completion.'],
  ['通过比较立场寻找合适关系；协调是优势，也要表达不愿让步的需求。','Compare perspectives to find workable relationships; coordination helps, alongside clearly stated non-negotiable needs.'],
  ['重视深度、信任和实质承诺；洞察适合深入问题，也需让对方有自主空间。','Value depth, trust and substantive commitment; insight helps with complex issues, while others need autonomy.'],
  ['通过探索、意义和更大图景保持动力；视野能带动行动，也需核对细节与承诺。','Stay engaged through exploration, meaning and the wider picture; perspective supports action, while details and promises need checking.'],
  ['把目标转成时间、责任和步骤；持续投入是优势，也要允许求助与阶段性调整。','Translate goals into time, responsibility and steps; persistence helps, alongside support and periodic adjustment.'],
  ['重视独立观点、系统与群体可能性；新想法需要适合的试验，也需要回应具体人的感受。','Value independent ideas, systems and collective possibilities; experiments help new ideas, while individual feelings deserve a response.'],
  ['容易从情绪、意象和整体氛围理解事物；共情与创造力需要清楚边界和可执行步骤。','Understand through feeling, imagery and atmosphere; empathy and creativity benefit from clear boundaries and practical steps.'],
]
const name=(body:Body,lang:Language)=>PLANETS.find(p=>p.id===body)?.name[lang==='zh'?0:1]??body
const signName=(sign:number,lang:Language)=>SIGNS[sign][lang==='zh'?0:1]
const houseName=(house:number,lang:Language)=>HOUSES[house-1][lang==='zh'?0:1]
const meaning=(body:Body,lang:Language)=>PLANET_MEANING[body]?.[lang==='zh'?0:1]??name(body,lang)
const makeSection=(id:string,title:string,summary:string,paragraphs:string[],evidence:string[],suggestions:string[]):ReportSection=>({id,title,summary,paragraphs,evidence,suggestions})
const text=(lang:Language)=>(zh:string,en:string)=>reportText(lang,zh,en)
function pointText(p:PlanetPosition,lang:Language) {
  const t=text(lang)
  if(p.signCandidates.length!==1) return t(`${name(p.id,lang)}可能位于${p.signCandidates.map(s=>signName(s,lang)).join(' / ')}，不固定解读。`,`${name(p.id,lang)} may be in ${p.signCandidates.map(s=>signName(s,lang)).join(' / ')}; its sign reading remains open.`)
  return `${name(p.id,lang)} · ${signName(p.sign,lang)}${p.house===null?'':t(` · 第${p.house}宫（${houseName(p.house,lang)}）`,` · house ${p.house} (${houseName(p.house,lang)})`)}`
}
const lonCache=new Map<string,number>()
function cachedLongitude(body:Body,date:Date) {
  const key=`${body}:${date.getTime()}`
  const known=lonCache.get(key)
  if(known!==undefined) return known
  const value=longitude(body,date)
  if(lonCache.size>=6000) lonCache.delete(lonCache.keys().next().value!)
  lonCache.set(key,value)
  return value
}
function asPosition(id:Body,lon:number):PlanetPosition {return {id,lon,sign:Math.floor(lon/30),house:null,motion:'unknown',endLon:null,signCandidates:[Math.floor(lon/30)]}}
function sampleTimes(start:Date,end:Date,stepMs:number) {
  const result:Date[]=[]
  for(let cursor=start.getTime();cursor<end.getTime();cursor+=stepMs) result.push(new Date(cursor))
  // The end is exclusive; use the final instant, not next period's first instant.
  if(result.at(-1)?.getTime()!==end.getTime()-1) result.push(new Date(end.getTime()-1))
  return result
}
function natalSamples(chart:Chart) {
  if(chart.resolved.instant) return chart.positions.map(p=>({position:p,longitudes:[p.lon]}))
  const times=sampleTimes(chart.resolved.start,new Date(chart.resolved.end.getTime()+1),2*3_600_000)
  return chart.positions.map(p=>{
    const longitudes=times.map(date=>cachedLongitude(p.id,date))
    const signs=[...new Set(longitudes.map(lon=>Math.floor(lon/30)))]
    return {position:{...p,signCandidates:signs},longitudes}
  })
}
function stableNatalAspects(samples:ReturnType<typeof natalSamples>) {
  const result:{aspect:Aspect;maxOrb:number;uncertain:boolean}[]=[]
  samples.forEach((a,i)=>samples.slice(i+1).forEach(b=>{
    const matches=a.longitudes.map((lon,index)=>aspectBetween(asPosition(a.position.id,lon),asPosition(b.position.id,b.longitudes[index])))
    const first=matches[0]
    if(first&&matches.every(m=>m?.type===first.type)) result.push({aspect:first,maxOrb:Math.max(...matches.map(m=>m!.orb)),uncertain:a.longitudes.length>1})
  }))
  return result.sort((a,b)=>a.maxOrb-b.maxOrb)
}
function natalMethod(lang:Language) {
  const t=text(lang)
  return [t('星历：astronomy-engine 2.1.19，地心视位置、回归黄道。民用出生时间使用历史时区转换。上升使用几何地平线；等宫制从上升精确度数开始，MC 独立于第十宫头。','Ephemeris: astronomy-engine 2.1.19, apparent geocentric positions and tropical zodiac. Historical civil time is resolved before calculation. The ascendant uses the geometric horizon; equal houses begin at its exact degree, with MC independent of the tenth cusp.'),t('本命主要相位：合/冲8°、拱/刑6°、六合4°；宫头守护星使用传统七星对应，外行星保留为附加象征，不混用不同宫制。','Natal major aspects: conjunction/opposition 8°, trine/square 6°, sextile 4°. House rulers use the traditional seven-planet scheme; outer planets add symbolic context without switching house systems.'),t('综合规则先看日月与上升，再看主题行星、相关宫头守护星及重复相位。数量用于找重复主题，不等于性格测量。时间不详时每2小时及日尾采样，保留全采样范围稳定的星座和相位；不生成宫位、上升或假定中午出生。','Synthesis starts with Sun, Moon and ascendant, then uses topic planets, relevant house rulers and repeated aspect themes. Counts identify recurring symbols, not measured personality traits. Unknown times are sampled every two hours plus the final instant; only stable signs/aspects are retained. No invented houses, ascendant or noon birth.'),t('内容采用现代心理象征与本命—行运框架，参照 Astrodienst、Skyscript 的基础术语与关系；文字及综合权重为独立实现，未经过占星专家审校。','Content follows modern psychological symbolism and natal/transit interpretation, using foundational terminology documented by Astrodienst and Skyscript. Text and synthesis weights are an independent implementation without specialist review.')]
}
function natalLimits(chart:Chart,lang:Language) {
  const t=text(lang)
  const result=[t('占星解释不等同于经验证实的事件预测；星历精度不能证明象征解释的现实准确性。','Astrological interpretation is not an empirically established event prediction; ephemeris precision does not validate the symbolism.'),t('本版未纳入次限、返照、年度推运、完整尊贵接纳或多流派综合。','This version does not include progressions, returns, annual profections, a full dignity/reception analysis or multiple schools.')]
  if(!chart.resolved.instant) result.push(t('时间不详：稳定性来自全天采样而非精确出生时刻。日月换座等不稳定项、上升和宫位保留空缺；个人日评分不生成。','Unknown birth time: stability is established by day-wide sampling rather than an exact birth instant. Changing placements, ascendant and houses remain open; no personal daily scores are generated.'))
  else if(!chart.frame) result.push(t('缺少地点坐标，或纬度达到本版不支持的±66°：上升和宫位暂缺；仍可读行星与相位。','Coordinates are missing or latitude reaches the unsupported ±66° boundary. Ascendant and houses are unavailable; planetary placements and aspects remain readable.'))
  return result
}
function topicBodies(topic:ReportTopic,chart:Chart):Body[] {
  const base:Record<ReportTopic,Body[]>={overall:[Body.Sun,Body.Moon],career:[Body.Sun,Body.Mercury,Body.Mars,Body.Saturn],money:[Body.Venus,Body.Jupiter,Body.Saturn],love:[Body.Moon,Body.Venus,Body.Mars]}
  const houses:Record<ReportTopic,number[]>={overall:[1],career:[6,10],money:[2,8],love:[5,7]}
  return [...new Set([...base[topic],...(chart.frame?houses[topic].map(h=>RULERS[Math.floor(chart.frame!.cusps[h-1]/30)]):[])])]
}
function themeNatal(topic:ReportTopic,chart:Chart,samples:ReturnType<typeof natalSamples>,aspects:ReturnType<typeof stableNatalAspects>,lang:Language):ReportSection {
  const t=text(lang), bodies=topicBodies(topic,chart)
  const points=samples.map(s=>s.position).filter(p=>bodies.includes(p.id)&&p.signCandidates.length===1)
  const relevant=aspects.filter(a=>bodies.includes(a.aspect.a)||bodies.includes(a.aspect.b))
  const tension=relevant.filter(a=>['square','opposition'].includes(a.aspect.type))
  const support=relevant.filter(a=>['sextile','trine'].includes(a.aspect.type))
  const primary=points.find(p=>p.id===(topic==='love'||topic==='money'?Body.Venus:topic==='career'?Body.Saturn:Body.Sun))??points[0]
  const summary=primary?t(`${name(primary.id,lang)}落${signName(primary.sign,lang)}，把${meaning(primary.id,lang)}带入${topicName(topic,lang)}：${SIGN_STYLE[primary.sign][0]}`,`${name(primary.id,lang)} in ${signName(primary.sign,lang)} brings ${meaning(primary.id,lang)} into ${topicName(topic,lang)}: ${SIGN_STYLE[primary.sign][1]}`):t('关键位置在出生日期范围内不稳定，保留这一主题的个人判断。','Key placements are unstable across the birth-date range, so this personal interpretation remains open.')
  const paragraphs:string[]=[]
  const link=relevant[0]?.aspect
  if(link) {
    const anchor=bodies.includes(link.a)?link.a:link.b,other=anchor===link.a?link.b:link.a
    paragraphs.push(t(`${name(anchor,lang)}在此主题中代表${meaning(anchor,lang)}，与${name(other,lang)}的${meaning(other,lang)}形成${ASPECT_NAMES[link.type][0]}。先确认这两种需要怎样相互配合，再选择实际行动。`,`${name(anchor,lang)} represents ${meaning(anchor,lang)} within this topic and forms a ${ASPECT_NAMES[link.type][1]} with ${name(other,lang)} (${meaning(other,lang)}). Consider how these needs can work together before choosing an action.`))
  }
  const second=points.find(p=>p!==primary)
  if(second) paragraphs.push(t(`${name(second.id,lang)}的${meaning(second.id,lang)}采用${signName(second.sign,lang)}方式。${primary&&second.sign%4===primary.sign%4?'两条线索落在同一元素，工作方式更容易相互呼应；仍需用实际情境检验。':'它提供另一种需求或节奏；不把不同星座简单判成矛盾人格，而是看如何安排先后。'}`,`${name(second.id,lang)} expresses ${meaning(second.id,lang)} through ${signName(second.sign,lang)}. ${primary&&second.sign%4===primary.sign%4?'The shared element repeats a style that may be easier to coordinate; check this against actual circumstances.':'This adds a different need or pace. Rather than labeling the placements contradictory, decide how to give each a workable place.'}`))
  if(tension.length&&support.length) paragraphs.push(t(`同主题既有${tension.length}组刑/冲，也有${support.length}组拱/六合。顺手的资源可以帮助处理摩擦，但不会自动消除它；先找到最需要协商的具体环节。`,`This theme includes ${tension.length} squares/oppositions and ${support.length} trines/sextiles. Available strengths may help with friction without canceling it; identify the specific point that needs negotiation.`))
  else if(tension.length) paragraphs.push(t(`此主题有${tension.length}组刑/冲，提示两种需求可能竞争时间或注意力；用边界、分工和试验协调，比直接判为坏更有用。`,`${tension.length} squares/oppositions suggest needs that may compete for time or attention. Boundaries, division of work and experiments provide ways to coordinate them.`))
  else if(support.length) paragraphs.push(t(`此主题有${support.length}组拱/六合，提示可连接的资源；容易的事情仍需要主动使用，不能据此保证结果。`,`${support.length} trines/sextiles suggest resources that may work together. Ease still needs to be used deliberately and does not guarantee an outcome.`))
  else paragraphs.push(t('相关主题行星之间未命中本版主要相位；解读以落座及可用宫位为主，不凭空补出相位故事。','No major aspect among the relevant planets meets this model’s orbs. Interpretation uses placements and available houses rather than inventing an aspect narrative.'))
  const houses:Record<ReportTopic,number[]>={overall:[1],career:[6,10],money:[2,8],love:[5,7]}
  if(chart.frame) for(const house of houses[topic]) {
    const sign=Math.floor(chart.frame.cusps[house-1]/30), ruler=RULERS[sign], position=samples.find(s=>s.position.id===ruler)!.position
    paragraphs.push(t(`第${house}宫（${houseName(house,lang)}）宫头在${signName(sign,lang)}，守护星${name(ruler,lang)}位于第${position.house}宫。把此主题与${houseName(position.house!,lang)}一起观察；宫头与MC分开处理。`,`House ${house} (${houseName(house,lang)}) begins in ${signName(sign,lang)}; its ruler ${name(ruler,lang)} is in house ${position.house}. Observe its connection to ${houseName(position.house!,lang)}; the cusp and MC are treated separately.`))
  }
  const suggestions:Record<ReportTopic,[string,string]>={overall:['把最认同与最不认同的一点各写下来，以具体经验核对。','Record one point that fits and one that does not, then compare with specific experience.'],career:['把目标、协作方式与可衡量的交付放在同一张计划里。','Put the goal, collaboration method and measurable deliverable into one plan.'],money:['分别核对个人预算、共同承诺与缓冲，不用落座决定交易。','Review your budget, shared commitments and buffer separately; do not choose trades from placements.'],love:['说清需要的亲密与自主空间，并听取对方实际表达。','State the closeness and autonomy you need, and listen to what the other person actually says.']}
  return makeSection(topic,topicName(topic,lang),summary,paragraphs,[...points.map(p=>pointText(p,lang)),...relevant.map(({aspect:a,maxOrb,uncertain})=>`${name(a.a,lang)} ${ASPECT_NAMES[a.type][lang==='zh'?0:1]} ${name(a.b,lang)} · ${t('最大容许度内偏差','maximum sampled orb')} ${maxOrb.toFixed(2)}°${uncertain?t('（全天稳定采样）',' (stable across day samples)'):''}`)], [suggestions[topic][lang==='zh'?0:1]])
}
export function astrologyNatalReport(input:BirthInput,language:Language):InterpretationReport {
  const t=text(language),chart=calculateAstrology(input),samples=natalSamples(chart),aspects=stableNatalAspects(samples)
  const core=samples.map(s=>s.position).filter(p=>[Body.Sun,Body.Moon].includes(p.id))
  const coreLines=core.map(p=>pointText(p,language))
  if(chart.frame) coreLines.push(t(`上升 · ${signName(Math.floor(chart.frame.asc/30),language)}；MC ${norm(chart.frame.mc).toFixed(2)}°（独立计算）`,`Ascendant · ${signName(Math.floor(chart.frame.asc/30),language)}; MC ${norm(chart.frame.mc).toFixed(2)}° (calculated independently)`))
  const summary=coreLines.join('；')
  const overview=makeSection('overview',t('星盘总览','Natal chart overview'),summary,[t('太阳代表主动方向，月亮描述情绪与安全感，上升反映进入环境的方式。把三者当成需要协调的层次，而不是让一个星座概括整个人。','The Sun describes initiative, the Moon emotional needs, and the ascendant an approach to the environment. Read them as layers to coordinate rather than reducing a person to one sign.'),...core.filter(p=>p.signCandidates.length===1).map(p=>`${name(p.id,language)}：${SIGN_STYLE[p.sign][language==='zh'?0:1]}`)],coreLines,[])
  const personal=samples.map(s=>s.position).filter(p=>[Body.Sun,Body.Moon,Body.Mercury,Body.Venus,Body.Mars].includes(p.id)&&p.signCandidates.length===1)
  const elements=[0,0,0,0],modes=[0,0,0]
  personal.forEach(p=>{const w=[Body.Sun,Body.Moon].includes(p.id)?2:1;elements[p.sign%4]+=w;modes[p.sign%3]+=w})
  if(chart.frame) {elements[Math.floor(chart.frame.asc/30)%4]++;modes[Math.floor(chart.frame.asc/30)%3]++}
  const peakElements=elements.map((value,index)=>({value,index})).filter(v=>v.value===Math.max(...elements)).map(v=>v.index)
  const peakModes=modes.map((value,index)=>({value,index})).filter(v=>v.value===Math.max(...modes)).map(v=>v.index)
  const elementReadings=[t('火象重启动与体验，优势是敢做；需要给后续维护和他人节奏留位置。','Fire emphasizes initiative and experience: willingness helps, while maintenance and others’ pacing need room.'),t('土象重可执行与持续，优势是落实；需要区分稳健与不愿改变。','Earth emphasizes feasibility and continuity: follow-through helps, while steadiness and resistance to change are different.'),t('风象重理解与交换，优势是比较观点；需要把讨论转成明确行动。','Air emphasizes understanding and exchange: comparing views helps, while discussion needs a path to action.'),t('水象重感受与连接，优势是共情；需要把感知和已经确认的事实区分开。','Water emphasizes feeling and connection: empathy helps, while impressions and confirmed facts need separation.')]
  const modeReadings=[t('基本节奏侧重发起，适合把目标变成第一步；启动后补上接续安排。','Cardinal pacing emphasizes initiation: turn the goal into a first step and plan the follow-through.'),t('固定节奏侧重持续，适合稳定投入；定期检查坚持的方向是否仍然合适。','Fixed pacing emphasizes continuity: steady effort benefits from periodic checks that the direction still fits.'),t('变动节奏侧重适应，适合调整方法；在选项之间切换时设一个收口时间。','Mutable pacing emphasizes adaptation: revise the method while setting a time to settle among options.')]
  const elementLabel=peakElements.map(i=>ELEMENT_NAMES[i][language==='zh'?0:1]).join(' / ')
  const modeLabel=peakModes.map(i=>MODE_NAMES[i][language==='zh'?0:1]).join(' / ')
  const personality=makeSection('personality',t('性格与优势短板','Personality, strengths and tensions'),t(`${elementLabel}${peakElements.length>1?'并列突出':'线索较突出'}；${modeLabel}${peakModes.length>1?'节奏并存':'节奏重复出现'}。`,`${elementLabel} ${peakElements.length>1?'themes share the lead':'symbolism is prominent'}; ${modeLabel} ${peakModes.length>1?'modes coexist':'pacing recurs'}.`),[
    ...peakElements.map(i=>elementReadings[i]),...peakModes.map(i=>modeReadings[i]),
    themeNatal('overall',chart,samples,aspects,language).paragraphs[1]??t('用真实互动检查象征倾向，再调整适合自己的方法。','Check symbolic tendencies against actual interactions and adjust the approach that works for you.'),
  ],[...elements.map((v,i)=>`${ELEMENT_NAMES[i][language==='zh'?0:1]} ${v}`),...modes.map((v,i)=>`${MODE_NAMES[i][language==='zh'?0:1]} ${v}`),t('统计仅用稳定的日月水金火与可用上升；日月权重2，其他1。','Counts use stable Sun/Moon/Mercury/Venus/Mars and an available ascendant; luminaries weight 2, others 1.')],[t('选择一个优势用于本周的具体任务，再给一个短板设计补偿办法。','Use one strength for a specific task this week and design a practical support for one tension.')])
  return {id:`astrology:natal:${input.date}:${input.time}:${input.timeZone}:${input.latitude}:${input.longitude}:${input.calendar}:${input.leapMonth}:${language}`,version:ASTROLOGY_REPORT_VERSION,title:t('个人星盘与完整解读','Personal natal chart and interpretation'),summary,sections:[overview,personality,...(['career','money','love'] as const).map(topic=>themeNatal(topic,chart,samples,aspects,language))],dos:[],donts:[],method:natalMethod(language),limitations:natalLimits(chart,language)}
}

export function astrologyPeriod(dateKey:string,cycle:Cycle,timeZone:string) {
  const date=Temporal.PlainDate.from(dateKey)
  if(date.year<1901||date.year>2100) throw new RangeError('Astrology forecasts support 1901–2100')
  const start=cycle==='day'?date:cycle==='week'?date.subtract({days:date.dayOfWeek-1}):cycle==='month'?date.with({day:1}):date.with({month:1,day:1})
  const end=cycle==='day'?start.add({days:1}):cycle==='week'?start.add({weeks:1}):cycle==='month'?start.add({months:1}):start.add({years:1})
  return {start:new Date(start.toZonedDateTime(timeZone).epochMilliseconds),end:new Date(end.toZonedDateTime(timeZone).epochMilliseconds),firstDate:start.toString(),lastDate:end.subtract({days:1}).toString()}
}
type Window={first:Date;last:Date;count:number;minOrb:number}
export type TransitSignal={body:Body;target:Body;type:Aspect['type'];windows:Window[];samples:number;meanCloseness:number;weight:number}
export type SolarSignal={body:Body;sign:number;house:number;windows:Window[];samples:number;weight:number}
function forecastSampling(cycle:Cycle) {
  const stepHours=({day:3,week:3,month:12,year:72})[cycle]
  const bodies=PLANETS.map(p=>p.id).filter(body=>cycle==='year'?[Body.Jupiter,Body.Saturn,Body.Uranus,Body.Neptune,Body.Pluto].includes(body):cycle==='month'?body!==Body.Moon:true)
  return {stepHours,bodies}
}
const planetWeight=(body:Body)=>[Body.Jupiter,Body.Saturn,Body.Uranus,Body.Neptune,Body.Pluto].includes(body)?1.4:body===Body.Moon?.6:1
function extendWindow(windows:Window[],date:Date,orb:number,previousIndex:number,index:number) {
  if(windows.length&&previousIndex===index-1) {const last=windows.at(-1)!;last.last=date;last.count++;last.minOrb=Math.min(last.minOrb,orb)}
  else windows.push({first:date,last:date,count:1,minOrb:orb})
}
/** All sampled matches are aggregated; no truncation to the five nearest instantaneous aspects. */
export function personalTransitSignals(chart:Chart,dateKey:string,cycle:Cycle,timeZone:string) {
  const period=astrologyPeriod(dateKey,cycle,timeZone),{stepHours,bodies}=forecastSampling(cycle)
  const times=sampleTimes(period.start,period.end,stepHours*3_600_000), natal=natalSamples(chart)
  const grouped=new Map<string,TransitSignal & {lastIndex:number;sumCloseness:number}>()
  times.forEach((date,index)=>bodies.forEach(body=>{
    const lon=cachedLongitude(body,date),moving=asPosition(body,lon),orbLimit=body===Body.Moon?1:2
    natal.forEach(target=>{
      const matches=target.longitudes.map(position=>aspectBetween(moving,asPosition(target.position.id,position),true))
      const match=matches[0]
      if(!match||!matches.every(m=>m?.type===match.type)) return
      const orb=Math.max(...matches.map(m=>m!.orb)),key=`${body}:${match.b}:${match.type}`
      let g=grouped.get(key)
      if(!g) {g={body,target:match.b,type:match.type,windows:[],samples:0,meanCloseness:0,weight:planetWeight(body),lastIndex:-2,sumCloseness:0};grouped.set(key,g)}
      extendWindow(g.windows,date,orb,g.lastIndex,index)
      g.lastIndex=index;g.samples++;g.sumCloseness+=1-orb/orbLimit
    })
  }))
  const signals:TransitSignal[]=[...grouped.values()].map(g=>({body:g.body,target:g.target,type:g.type,windows:g.windows,samples:g.samples,weight:g.weight,meanCloseness:g.sumCloseness/g.samples}))
  signals.sort((a,b)=>b.weight*b.samples*(.5+b.meanCloseness)-a.weight*a.samples*(.5+a.meanCloseness))
  return {signals,period,sampleCount:times.length,stepHours,natal}
}
export function solarSignSignals(sign:number,dateKey:string,cycle:Cycle,timeZone:string) {
  if(!Number.isInteger(sign)||sign<0||sign>11) throw new RangeError('Sun sign must be an integer from 0 to 11')
  const period=astrologyPeriod(dateKey,cycle,timeZone),{stepHours,bodies}=forecastSampling(cycle)
  const times=sampleTimes(period.start,period.end,stepHours*3_600_000)
  const groups=new Map<string,SolarSignal & {lastIndex:number}>()
  times.forEach((date,index)=>bodies.forEach(body=>{
    const currentSign=Math.floor(cachedLongitude(body,date)/30),house=(currentSign-sign+12)%12+1,key=`${body}:${currentSign}`
    let g=groups.get(key)
    if(!g){g={body,sign:currentSign,house,windows:[],samples:0,weight:planetWeight(body),lastIndex:-2};groups.set(key,g)}
    extendWindow(g.windows,date,0,g.lastIndex,index);g.lastIndex=index;g.samples++
  }))
  return {signals:[...groups.values()].map(s=>({body:s.body,sign:s.sign,house:s.house,windows:s.windows,samples:s.samples,weight:s.weight})).sort((a,b)=>b.weight*b.samples-a.weight*a.samples),period,sampleCount:times.length,stepHours}
}
function windowText(w:Window,zone:string,lang:Language,orb:boolean) {
  const format=(date:Date)=>Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(zone).toPlainDateTime().toString({smallestUnit:'minute'})
  return `${format(w.first)} → ${format(w.last)}${orb?reportText(lang,`；最小采样容许度偏差 ${w.minOrb.toFixed(2)}°`,`; closest sampled orb ${w.minOrb.toFixed(2)}°`):''}`
}
const supportFactor=(s:TransitSignal)=>s.type==='trine'?1:s.type==='sextile'?.8:s.type==='square'?-.8:s.type==='opposition'?-.7:[Body.Venus,Body.Jupiter].includes(s.body)?.8:[Body.Saturn,Body.Pluto].includes(s.body)?-.7:[Body.Mars,Body.Uranus,Body.Neptune].includes(s.body)?-.3:.3
function transitContribution(s:TransitSignal,sampleCount:number) {return supportFactor(s)*s.weight*(.35+.65*s.meanCloseness)*(s.samples/sampleCount)}
function topicHouse(house:number,topic:ReportTopic) {return (topic==='career'?[3,6,9,10,11]:topic==='money'?[2,8]:topic==='love'?[4,5,7]:[1,4,7,10]).includes(house)}
const solarEffect=(body:Body)=>body===Body.Jupiter?1:body===Body.Venus?.8:body===Body.Saturn?-.6:body===Body.Pluto?-.5:[Body.Mars,Body.Uranus,Body.Neptune].includes(body)?-.25:.3
function signalInterpretation(s:TransitSignal,topic:ReportTopic,lang:Language) {
  const t=text(lang)
  const opening=s.body===s.target?t(`行运${name(s.body,lang)}与本命${name(s.body,lang)}形成${ASPECT_NAMES[s.type][0]}，这一相位集中指向${meaning(s.body,lang)}的主题。`,`Transiting ${name(s.body,lang)} forms a ${ASPECT_NAMES[s.type][1]} to its natal position, focusing attention on ${meaning(s.body,lang)}.`):t(`行运${name(s.body,lang)}与本命${name(s.target,lang)}形成${ASPECT_NAMES[s.type][0]}，把${meaning(s.body,lang)}带到${meaning(s.target,lang)}的议题上。`,`Transiting ${name(s.body,lang)} forms a ${ASPECT_NAMES[s.type][1]} to natal ${name(s.target,lang)}, connecting ${meaning(s.body,lang)} with ${meaning(s.target,lang)}.`)
  const action=topic==='career'?t('把新增要求变成范围、责任和反馈点；先试行再扩大。','Translate demands into scope, ownership and feedback points; test before expanding.'):topic==='money'?t('核对资源、承诺与缓冲，分别审查个人和共同支出。','Check resources, commitments and buffers; review personal and shared spending separately.'):topic==='love'?t('明确表达需要，让对方有机会回应；把猜测转成可以直接沟通的问题。','State needs clearly and leave room for a response; turn assumptions into questions you can ask directly.'):t('把这一主题当成观察提示，选择一个可调整的现实环节。','Use the theme as an observation prompt and choose one real-life detail you can adjust.')
  const quality=s.type==='square'||s.type==='opposition'?t('这组关系强调需要协调的张力，适合先分清彼此的优先级。','This configuration emphasizes tension to coordinate; clarify the competing priorities first.'):s.type==='trine'||s.type==='sextile'?t('这组关系提供较易连接的资源，适合主动安排一次合作或实践。','This configuration suggests resources that can connect; deliberately arrange a collaboration or practical trial.'):t('合相会强化双方主题；具体体验取决于两颗行星和本命背景，不统一判好坏。','A conjunction intensifies the two themes; its experience depends on the planets and natal context rather than a fixed good/bad label.')
  return `${opening}${quality}${action}`
}
function periodMethod(cycle:Cycle,stepHours:number,sampleCount:number,zone:string,lang:Language) {
  const t=text(lang)
  return [t(`报告时区 ${zone}；自然日、周一至周日、自然月或自然年。区间左闭右开；${sampleCount}个时刻、间隔${stepHours}小时采样，并检查区间最后一刻。`, `Report zone: ${zone}. Uses calendar days, Monday–Sunday weeks, calendar months or years. Ranges include the start and exclude the end; ${sampleCount} samples at ${stepHours}-hour intervals plus the final instant.`),t(cycle==='year'?'年运聚合木、土、天、海、冥五颗慢行星作为年度背景；不把内行星日常波动累加成年度好坏。':cycle==='month'?'月运使用除月亮外的九颗行星；月亮短时触发只在日/周报告展示。':'日/周运使用十颗行星，月亮相位容许度1°，其他行运行星2°。',cycle==='year'?'Year reports aggregate Jupiter, Saturn, Uranus, Neptune and Pluto as annual background; inner-planet fluctuations are not added into a yearly verdict.':cycle==='month'?'Month reports use nine planets, omitting the Moon; lunar triggers belong to daily/weekly reports.':'Day/week reports use ten planets; transit orbs are 1° for the Moon and 2° for others.'),t('个人相位按行运行星—本命行星—相位分组，连续采样形成可见时窗，逆行导致的分离窗口保留。所列是采样命中范围和最近采样点，不是求根得到的精确起止或峰值；短于采样间隔的窗口可能漏检。','Personal aspects are grouped by transit planet, natal planet and aspect. Consecutive samples form windows; separate retrograde passes stay separate. Windows and closest points are sampled observations, not root-solved exact ingress, egress or peak times; shorter windows may be missed.')]
}
const DAILY_ACTIONS:Partial<Record<Body,{do:[string,string];avoid:[string,string]}>>={
  [Body.Sun]:{do:['为今天最重要的目标留出一段完整时间。','Reserve an uninterrupted block for today’s main goal.'],avoid:['避免为了获得认可而同时接下太多任务。','Avoid accepting too many tasks just to earn recognition.']},
  [Body.Moon]:{do:['先确认自己的情绪和实际需要，再安排交流。','Check your mood and practical needs before a conversation.'],avoid:['避免在情绪最强烈时替对方下结论。','Avoid drawing conclusions about others at an emotional peak.']},
  [Body.Mercury]:{do:['把关键约定、时间和交付内容复述确认一遍。','Confirm key agreements, timing and deliverables in your own words.'],avoid:['避免把未经核实的消息当成已经达成的共识。','Avoid treating unverified information as an agreement.']},
  [Body.Venus]:{do:['说清一项共同期待，听听对方愿意怎样配合。','State one shared expectation and ask how the other person wants to participate.'],avoid:['避免用勉强迎合代替真实的需求沟通。','Avoid using reluctant agreement instead of honest communication about needs.']},
  [Body.Mars]:{do:['把想马上推进的事拆成一个可控的小步骤。','Turn an urgent impulse into one manageable step.'],avoid:['避免把速度不同直接升级成输赢之争。','Avoid turning different working speeds into a contest.']},
  [Body.Jupiter]:{do:['为一个新想法做小范围试行，并写下资源上限。','Try one new idea on a small scale and define a resource limit.'],avoid:['避免在时间和资源尚未落实前扩大承诺。','Avoid expanding commitments before time and resources are secured.']},
  [Body.Saturn]:{do:['检查责任边界，把一项长期任务拆成今日可完成的部分。','Check responsibility boundaries and break a long-term task into today’s achievable portion.'],avoid:['避免把暂时受阻解释成自己不够好。','Avoid treating a temporary obstacle as a verdict on your worth.']},
  [Body.Uranus]:{do:['为可能变化的安排准备一个可行的替代方案。','Prepare a workable alternative for a plan that may change.'],avoid:['避免临时改动安排却不告知受影响的人。','Avoid changing a plan without telling the people affected.']},
  [Body.Neptune]:{do:['把模糊的期待写成能被双方确认的具体条件。','Turn a vague expectation into specific terms both sides can confirm.'],avoid:['避免把直觉和想象直接当成已经核实的事实。','Avoid treating intuition or imagination as a verified fact.']},
  [Body.Pluto]:{do:['区分自己能改变的环节与需要协商的部分。','Separate what you can change yourself from what needs negotiation.'],avoid:['避免用试探或控制来确认关系中的安全感。','Avoid testing or controlling others to obtain reassurance.']},
}
export function astrologyForecast(inputOrSign:BirthInput|number,dateKey:string,cycle:Cycle,language:Language,timeZone?:string):InterpretationReport {
  const t=text(language),personal=typeof inputOrSign!=='number'
  const zone=timeZone??(personal?inputOrSign.timeZone:'Asia/Shanghai')
  const chart=personal?calculateAstrology(inputOrSign):null
  const data=chart?personalTransitSignals(chart,dateKey,cycle,zone):solarSignSignals(inputOrSign as number,dateKey,cycle,zone)
  const cycles:Record<Cycle,[string,string]>={day:['今日','Daily'],week:['本周','Weekly'],month:['本月','Monthly'],year:['本年','Yearly']}
  const label=cycles[cycle][language==='zh'?0:1]
  const sections:ReportSection[]=[]
  const scores:Record<ReportTopic,number|null>={overall:null,career:null,money:null,love:null}
  const source=personal?t('个人星盘行运','Personal natal transits'):t(`${signName(inputOrSign as number,language)} · 太阳星座速览`,`${signName(inputOrSign as number,language)} · Sun-sign overview`)
  for(const topic of TOPICS) {
    if(chart) {
      const d=data as ReturnType<typeof personalTransitSignals>,bodies=topicBodies(topic,chart)
      const all=topic==='overall'?d.signals:d.signals.filter(s=>bodies.includes(s.target))
      const selected=all.slice(0,4)
      const supportive=all.filter(s=>supportFactor(s)>0),demanding=all.filter(s=>supportFactor(s)<0)
      const primary=selected[0]
      const summary=primary?signalInterpretation(primary,topic,language):t('本时段采样中，未发现作用于此主题本命点的主要行运相位；沿用本命主题与实际计划，不补造戏剧性结论。','No sampled major transit aspect to this topic’s natal planets was found in this period. Continue with natal themes and actual plans rather than inventing a dramatic forecast.')
      const paragraphs=selected.slice(1).map(s=>signalInterpretation(s,topic,language))
      if(supportive.length&&demanding.length) paragraphs.push(t(`本主题同时出现${supportive.length}条支持与${demanding.length}条协调线索；分别观察可借力之处与需要调整之处，再结合具体安排决定行动。`,`This topic includes ${supportive.length} supportive and ${demanding.length} adjusting signals. Consider the available support and needed adjustments separately, then choose an action that fits your plans.`))
      const natalTopic=themeNatal(topic,chart,d.natal,stableNatalAspects(d.natal),language)
      paragraphs.push(t(`本命背景：${natalTopic.summary}`,`Natal context: ${natalTopic.summary}`))
      const contribution=all.reduce((sum,s)=>sum+transitContribution(s,d.sampleCount),0)
      // Overall explicitly uses all natal planets, while topic subsets use their relevant rulers.
      const overallContribution=d.signals.reduce((sum,s)=>sum+transitContribution(s,d.sampleCount),0)
      scores[topic]=chart.resolved.instant&&all.length?scoreFromEvidence(55+18*Math.tanh((topic==='overall'?overallContribution:contribution)/2)):null
      const evidence=all.flatMap(s=>[`${name(s.body,language)} → ${name(s.target,language)} ${ASPECT_NAMES[s.type][language==='zh'?0:1]} · ${s.samples}/${d.sampleCount} ${t('采样命中','sample matches')} · ${t('加权贡献','weighted contribution')} ${transitContribution(s,d.sampleCount).toFixed(3)}`,...s.windows.map(w=>windowText(w,zone,language,true))])
      if(all.length>4) evidence.push(t(`另有${all.length-4}条主题信号参与本期解读；正文按持续度×贴近度×行星权重优先展示4条。`,`${all.length-4} additional topic signals inform this period’s interpretation; the narrative shows four prioritized by duration × closeness × planet weight.`))
      sections.push(makeSection(topic,topicName(topic,language),summary,paragraphs,evidence,natalTopic.suggestions))
    } else {
      const d=data as ReturnType<typeof solarSignSignals>,all=d.signals.filter(s=>topicHouse(s.house,topic)),selected=all.slice(0,3),primary=selected[0]
      const summary=primary?t(`${name(primary.body,language)}在太阳整宫第${primary.house}宫（${houseName(primary.house,language)}）较突出，带来${meaning(primary.body,language)}的主题。`,`${name(primary.body,language)} is prominent in solar whole-sign house ${primary.house} (${houseName(primary.house,language)}), emphasizing ${meaning(primary.body,language)}.`):t('这一周期的主要采样行星未集中于本主题宫位；先沿用已有安排，不额外赋予强烈趋势。','The sampled planets do not concentrate in this topic’s solar houses during the period. Keep existing arrangements without assigning an exaggerated trend.')
      const advice=topic==='career'?t('确认工作优先级和交付边界；变化先从可回顾的小试验开始。','Clarify priorities and delivery boundaries; begin change with a small, reviewable experiment.'):topic==='money'?t('先看真实账目与共同承诺，再作资源调整。','Review actual accounts and shared commitments before reallocating resources.'):topic==='love'?t('给沟通留出时间，让期待和边界成为可讨论的内容。','Make time to discuss expectations and boundaries.'):t('选择一件与当前重点相关的小事，观察完成后的反馈。','Choose one small action related to the current theme and observe the feedback.')
      const paragraphs=selected.slice(1).map(s=>t(`${name(s.body,language)}经过第${s.house}宫，把${meaning(s.body,language)}与${houseName(s.house,language)}连接。`,`As ${name(s.body,language)} occupies house ${s.house}, ${meaning(s.body,language)} connects with ${houseName(s.house,language)}.`))
      paragraphs.push(SIGN_STYLE[inputOrSign as number][language==='zh'?0:1],t('这是同一太阳星座共享的分组主题；没有假设你的出生度数、上升、真实宫位或个人相位。','This is a shared theme for a Sun-sign group. No natal degree, ascendant, personal house or individual aspect is invented.'))
      const contribution=all.reduce((sum,s)=>sum+solarEffect(s.body)*s.weight*s.samples/d.sampleCount,0)
      scores[topic]=all.length?scoreFromEvidence(55+15*Math.tanh(contribution/2)):null
      const evidence=all.flatMap(s=>[`${name(s.body,language)} · ${signName(s.sign,language)} · ${t('太阳整宫','solar whole-sign house')} ${s.house} · ${s.samples}/${d.sampleCount}`,...s.windows.map(w=>windowText(w,zone,language,false))])
      sections.push(makeSection(topic,topicName(topic,language),summary,paragraphs,evidence,[advice]))
    }
  }
  const summary=sections[0].summary
  const actionSignals=chart?data.signals:(data as ReturnType<typeof solarSignSignals>).signals.filter(s=>topicHouse(s.house,'overall'))
  const actionBodies=[...new Set((actionSignals.length?actionSignals:data.signals).map(s=>s.body))].slice(0,2)
  const dos=cycle==='day'?actionBodies.map(body=>DAILY_ACTIONS[body]!.do[language==='zh'?0:1]):[]
  const donts=cycle==='day'?actionBodies.map(body=>DAILY_ACTIONS[body]!.avoid[language==='zh'?0:1]):[]
  const methods=[...(personal?natalMethod(language):[t('太阳星座分组采用太阳整宫：所选星座为第一宫，后续星座依序分宫；使用真实行运行星的星座位置，不构造一个15°的虚拟本命太阳。','Sun-sign grouping uses solar whole-sign houses: the selected sign is house one, followed by the signs in order. Actual transit sign positions are used; no fictitious 15° natal Sun is created.')]),...periodMethod(cycle,data.stepHours,data.sampleCount,zone,language),...(cycle==='day'?[chart&&!chart.resolved.instant?t('出生时刻不详，本报告保留稳定行运解读，暂不提供个人评分。','Birth time is unknown; stable transit interpretations are retained without personal scores.'):personal?t('日评分：支持相位拱+1/六合+.8，张力刑−.8/冲−.7，合相按行星角色−.7至+.8；再乘行星权重（慢行星1.4/月亮.6/其他1）、贴近度(.35+.65×平均贴近度)、命中采样比例。主题分=55+18×tanh(总贡献/2)，综合独立汇总全部本命点。只反映模型相对倾向，无命中或时间不详则不填分。','Daily scoring: trine +1, sextile +.8, square −.8, opposition −.7; conjunction −.7 to +.8 by planet. Multiply by planet weight (slow planets 1.4, Moon .6, others 1), closeness (.35+.65×mean closeness), and sample occupancy. Topic score=55+18×tanh(total/2); overall independently aggregates all natal planets. No matches or unknown birth time means no score.'):t('大众日评分按主题宫位内行星角色与持续占比聚合：木星1/金星.8/土星−.6/冥王−.5/火天海−.25/其他.3，乘行星权重与占比；55+15×tanh(总贡献/2)。这是分组内容提示刻度，不是个人相位运势或现实概率。','Grouped daily scores aggregate planet roles and sampled occupancy in topic houses: Jupiter 1, Venus .8, Saturn −.6, Pluto −.5, Mars/Uranus/Neptune −.25, others .3, multiplied by planet weight and occupancy. Score=55+15×tanh(total/2). This is a group-content prompt, not a personal aspect forecast or event probability.')]:[])]
  return {id:`astrology:${personal?'personal:'+inputOrSign.date+':'+inputOrSign.time+':'+inputOrSign.timeZone+':'+inputOrSign.latitude+':'+inputOrSign.longitude:'sun:'+inputOrSign}:${cycle}:${dateKey}:${zone}:${personal?inputOrSign.calendar+':'+inputOrSign.leapMonth:''}:${language}`,version:ASTROLOGY_REPORT_VERSION,title:`${source} · ${label}`,summary,sections,scores:cycle==='day'?scores:undefined,dos,donts,period:{start:data.period.start.toISOString(),end:data.period.end.toISOString(),label:`${data.period.firstDate} – ${data.period.lastDate} · ${zone}`,timeZone:zone},method:methods,limitations:[...(chart?natalLimits(chart,language):[t('同一太阳星座共用内容，不能替代个人星盘；缺少个人生日与时刻时，不推测太阳精确度数。','Members of the same Sun sign share this content; it cannot replace a personal chart. No exact natal Sun degree is inferred without birth data.'),t('传统占星的象征解释未经科学验证为个人事件预测。','Traditional astrological symbolism is not scientifically established as a predictor of personal events.')]),t('时窗为离散采样结果，尤其年运只显示慢行星背景，未声称覆盖这一周期的所有事件或精确高峰。','Windows are discrete samples; yearly reports in particular describe slow-planet background without claiming all events or exact peaks in the period.') ]}
}
