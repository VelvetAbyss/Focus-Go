import { Temporal } from '@js-temporal/polyfill'
import { Solar } from 'lunar-typescript'
import { calculateBazi, baziDayTheme } from './engine'
import { dateAtNoon, zonedParts } from '../symbolic/time'
import { reportText, scoreFromEvidence, topicName, TOPICS } from '../symbolic/report'
import type { InterpretationReport, ReportSection, ReportTopic } from '../symbolic/report'
import type { BirthInput, Language } from '../symbolic/types'

export const BAZI_REPORT_VERSION = 'BZ-report-2.0'
type Chart = ReturnType<typeof calculateBazi>
type Role = 'peer' | 'output' | 'wealth' | 'authority' | 'resource'
type Strength = 'strong' | 'weak' | 'balanced' | 'review' | 'unknown'
const ELEMENTS = ['木', '火', '土', '金', '水'] as const
const EN_ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water']
const STEMS = '甲乙丙丁戊己庚辛壬癸'
const HIDDEN: Record<string, string[]> = { 子:['癸'], 丑:['己','癸','辛'], 寅:['甲','丙','戊'], 卯:['乙'], 辰:['戊','乙','癸'], 巳:['丙','庚','戊'], 午:['丁','己'], 未:['己','丁','乙'], 申:['庚','壬','戊'], 酉:['辛'], 戌:['戊','辛','丁'], 亥:['壬','甲'] }
const ROLES: Role[] = ['peer','output','wealth','authority','resource']
const ROLE_NAMES: Record<Role, [string, string]> = { peer:['比劫','Peers / self-direction'], output:['食伤','Expression / output'], wealth:['财星','Resources / exchange'], authority:['官杀','Responsibility / constraints'], resource:['印星','Learning / support'] }
const PILLAR_NAMES = [['年柱','Year'],['月柱','Month'],['日柱','Day'],['时柱','Hour']]
const COMBINE = ['子丑','寅亥','卯戌','辰酉','巳申','午未']
const CLASH = ['子午','丑未','寅申','卯酉','辰戌','巳亥']
const STEM_COMBINE = ['甲己','乙庚','丙辛','丁壬','戊癸']
const elementIndex = (stem: string) => Math.floor(STEMS.indexOf(stem) / 2)
const roleOf = (stem: string, day: string): Role => ROLES[(elementIndex(stem) - elementIndex(day) + 5) % 5]
const pairIn = (pairs: string[], a: string, b: string) => pairs.includes(a+b) || pairs.includes(b+a)
const emptyRoles = (): Record<Role,number> => ({ peer:0, output:0, wealth:0, authority:0, resource:0 })
const weights = (n: number) => n === 1 ? [1] : n === 2 ? [.7,.3] : [.6,.25,.15]
const elemName = (index: number, lang: Language) => lang === 'zh' ? ELEMENTS[index] : EN_ELEMENTS[index]
const roleName = (role: Role, lang: Language) => ROLE_NAMES[role][lang === 'zh' ? 0 : 1]
const section = (id: string, title: string, summary: string, paragraphs: string[], evidence: string[], suggestions: string[]): ReportSection => ({ id,title,summary,paragraphs,evidence,suggestions })

/** Relative symbolic weights, not a traditional universal or empirically validated scale. */
export function analyzeBazi(chart: Chart) {
  const day = chart.pillars[2].stem
  const pools = emptyRoles()
  const roots: {pillar:number;stem:string;weight:number}[] = []
  const visible: {pillar:number;stem:string;role:Role;rooted:boolean}[] = []
  if (!day) return { day, pools, roots, visible, strength:'unknown' as Strength, share:null, season:-1, favorable:[] as number[], caution:[] as number[], interactions:[] as string[] }
  const month = chart.pillars[1].branch
  const seasonalElement = month && HIDDEN[month] ? elementIndex(HIDDEN[month][0]) : -1
  // 旺、相、休、囚、死 expressed as explicit relative weights. Earth months use their main qi.
  const seasonal = (element:number) => seasonalElement < 0 ? 1 : [1.35,1.15,.65,.75,.95][(element-seasonalElement+5)%5]
  chart.pillars.forEach((p, index) => {
    if (p.stem && index !== 2) {
      const role = roleOf(p.stem,day)
      const rooted = chart.pillars.some(other=>other.hidden.some(h=>elementIndex(h)===elementIndex(p.stem)))
      visible.push({pillar:index,stem:p.stem,role,rooted})
      pools[role] += seasonal(elementIndex(p.stem)) * (rooted ? 1.15 : .85)
    }
    const weight = weights(p.hidden.length)
    p.hidden.forEach((h,i)=>{
      const w = weight[i] * (index===1 ? 2 : index===2 ? 1.25 : 1)
      pools[roleOf(h,day)] += w * seasonal(elementIndex(h))
      if (elementIndex(h)===elementIndex(day)) roots.push({pillar:index,stem:h,weight:weight[i]})
    })
  })
  const total = Object.values(pools).reduce((a,b)=>a+b,0)
  const share = (pools.peer + pools.resource) / total
  const rootStrength = roots.reduce((sum,r)=>sum+r.weight,0)
  const season = seasonal(elementIndex(day))
  const complete = chart.pillars.every(p=>Boolean(p.value))
  let strength: Strength = !complete ? 'unknown' : share>=.56&&(rootStrength>=.75||season>=1.15) ? 'strong' : share<.42&&(rootStrength<1||season<=.95) ? 'weak' : 'balanced'
  // Extreme one-sided charts require special-pattern rules that this扶抑 model does not implement.
  if (complete && (share>.84 || share<.12)) strength='review'
  const d=elementIndex(day)
  const favorable = strength==='strong' ? [(d+1)%5,(d+2)%5] : strength==='weak' ? [(d+4)%5,d] : []
  const caution = strength==='strong' ? [d,(d+4)%5] : strength==='weak' ? [(d+3)%5,(d+2)%5] : []
  const interactions: string[] = []
  chart.pillars.forEach((p,i)=>chart.pillars.slice(i+1).forEach((q,offset)=>{
    const j=i+offset+1
    if (p.branch && q.branch && pairIn(COMBINE,p.branch,q.branch)) interactions.push(`branch-combine:${i}:${j}:${p.branch+q.branch}`)
    if (p.branch && q.branch && pairIn(CLASH,p.branch,q.branch)) interactions.push(`branch-clash:${i}:${j}:${p.branch+q.branch}`)
    if (p.stem && q.stem && pairIn(STEM_COMBINE,p.stem,q.stem)) interactions.push(`stem-combine:${i}:${j}:${p.stem+q.stem}`)
  }))
  return {day,pools,roots,visible,strength,share,season,favorable,caution,interactions}
}
function strengthText(strength:Strength, lang:Language) {
  return ({ strong:['扶抑规则初判：日主偏强','Support/balance model: relatively strong day master'], weak:['扶抑规则初判：日主偏弱','Support/balance model: relatively weak day master'], balanced:['扶抑规则初判：生扶与制泄较为交错','Support and expenditure are mixed'], review:['结构偏于一侧，喜忌需进一步辨格','A one-sided structure needs special-pattern review'], unknown:['资料不足，暂不定整体旺衰与喜忌','Incomplete data: overall strength and favorable elements remain open'] })[strength][lang==='zh'?0:1]
}
function commonMethod(input:BirthInput,lang:Language) {
  const t=(zh:string,en:string)=>reportText(lang,zh,en)
  return [
    t('历法：lunar-typescript 1.8.6；出生地民用时间先按历史时区解析，再统一换算 UTC+08 排柱。年界用立春，月界用节；本版未做出生地真太阳时修正。','Calendar: lunar-typescript 1.8.6. Resolve historical civil time, then convert to UTC+08 for pillars. Years change at Li Chun; months at jie solar terms. No local apparent solar-time correction.'),
    input.zi===1?t('子初换日：23:00 起按次日的日柱计算，时柱与此口径配套。','Early-Zi convention: the day changes at 23:00, with a matching hour stem.'):t('子正换日：00:00 换日；晚子时使用所选库的 sect 2 配套规则。','Midnight convention: the day changes at 00:00, using the library’s corresponding sect-2 hour rules.'),
    t('扶抑模型：月支藏干权重×2、日支×1.25、其他支×1；藏干单一=1、两干=.7/.3、三干=.6/.25/.15。非日主透干有根×1.15、无根×.85；月令旺相休囚死使用1.35/1.15/.95/.75/.65相对权重。生扶占比≥.56且有根或得令初判偏强；<.42且根浅或失令初判偏弱，其余交错。权重是产品规则，不是各派公认公式。','Balance model: month hidden stems ×2, day ×1.25, other branches ×1; hidden shares 1, .7/.3 or .6/.25/.15. Visible stems except the day master ×1.15 when rooted, .85 otherwise. Seasonal thriving/support/restraint weights are 1.35/1.15/.95/.75/.65. Support share ≥.56 plus roots or season indicates strength; <.42 plus shallow roots or seasonal weakness indicates weakness; otherwise mixed. These are product rules, not a universal formula.'),
    t('合与冲只作为牵制、连接或调整线索，不直接判吉凶，也不自动断定合化；制化通过食伤生财、官印相生等同时出现的角色关系解释。','Combinations and clashes describe links, tension or change, not automatic good/bad outcomes or elemental transformation. Coexisting role chains, such as expression→exchange and responsibility→support, qualify the interpretation.'),
    t('解释来源：五行生克与十神角色框架、《子平真诠》月令/用神讨论、《滴天髓阐微》旺衰与制化讨论；当前文字和权重为独立规则实现，未经过命理专家审校。','Interpretive framework: five-element generation/control and ten-god roles; month-command discussions in Zi Ping Zhen Quan and strength/control discussions in Di Tian Sui Chan Wei. Wording and numeric weights are this product’s implementation and have not received specialist review.'),
  ]
}
function limits(chart:Chart, a:ReturnType<typeof analyzeBazi>,lang:Language) {
  const t=(zh:string,en:string)=>reportText(lang,zh,en)
  const result=[t('传统命理的象征解释不等同于经验证实的现实预测；不据此断定财富、婚期或具体事件。','Traditional symbolic interpretation is not an empirically established prediction of wealth, marriage dates or events.'),t('喜忌限于普通结构的扶抑初判；未实现完整格局取用、调候、从格/专旺及逐日藏干司令。特别结构不强行给出喜忌。','Favorable elements are a preliminary balance reading for ordinary structures. Full pattern classification, climate adjustment, special/following patterns and daily hidden-stem command are not implemented. Special structures do not receive forced conclusions.')]
  if(!chart.resolved.instant) result.push(t('出生时间不详：只解读整日稳定的柱。时柱、整体旺衰、喜忌、精确起运和个人日评分暂缺；补充时刻后重新生成。','Unknown birth time: interpret only pillars stable across the day. Hour, overall strength, favorable elements, exact luck-cycle start and personal daily scores remain unavailable.'))
  if(a.strength==='review') result.push(t('当前生扶比例极端，可能涉及特殊格局；本版不会用普通扶抑规则给出相反的强断。','The support distribution is extreme and may involve a special pattern; ordinary balance rules are withheld.'))
  return result
}
function roleEvidence(a:ReturnType<typeof analyzeBazi>,lang:Language) {
  return ROLES.map(r=>`${roleName(r,lang)} ${a.pools[r].toFixed(2)}`)
}
function interactionEvidence(a:ReturnType<typeof analyzeBazi>,lang:Language) {
  return a.interactions.map(value=>{
    const [kind,x,y,pair]=value.split(':')
    const label=kind==='branch-clash'?reportText(lang,'支冲','branch clash'):kind==='branch-combine'?reportText(lang,'支合','branch combination'):reportText(lang,'干合','stem combination')
    return `${PILLAR_NAMES[Number(x)][lang==='zh'?0:1]} / ${PILLAR_NAMES[Number(y)][lang==='zh'?0:1]} ${pair} · ${label}`
  })
}
function themeReading(topic:ReportTopic|'personality',a:ReturnType<typeof analyzeBazi>,lang:Language) {
  const t=(zh:string,en:string)=>reportText(lang,zh,en)
  const rank=[...ROLES].sort((x,y)=>a.pools[y]-a.pools[x])
  const primary=rank[0], secondary=rank[1]
  const dominant=t(`当前可用结构中，${roleName(primary,lang)}与${roleName(secondary,lang)}较突出。`,`Within the available structure, ${roleName(primary,lang)} and ${roleName(secondary,lang)} are most prominent.`)
  const capacity=a.strength==='weak'?t('资源与支持要先于扩张；承接更多责任时，需要有人手、时间或流程托底。','Build support before expanding; extra responsibility needs people, time or a reliable process.'):a.strength==='strong'?t('自主性与执行资源较充足，重点是把投入导向可交付成果，避免重复用力。','Self-direction and support are relatively prominent; channel effort into deliverables rather than adding effort without an outcome.'):t('结构中存在交错线索，适宜用情境与反馈判断哪种做法有效，不把单一角色当全部性格。','The structure contains competing themes. Use context and feedback to choose a response rather than treating one role as the whole personality.')
  if(topic==='personality') {
    const styles:Record<Role,[string,string]>={peer:['更看重自主判断与同伴互动；优势是主动承担，盲点是把合作变成较劲。','Autonomy and peer interaction are prominent: initiative is useful, but cooperation can become competition.'],output:['倾向通过表达、方案或作品确立自我；优势是把想法说清，盲点是只顾输出而忽略约束。','Expression, ideas and work products provide a sense of agency: clear communication is useful, but constraints may receive too little attention.'],wealth:['较容易关注投入、回报与可调配资源；优势是务实，盲点是过早用结果衡量自己或关系。','Inputs, returns and available resources attract attention: pragmatism helps, but results can become an overly narrow measure of self or relationships.'],authority:['较容易感知责任、标准与外界期待；优势是有秩序，盲点是把全部要求都内化为压力。','Responsibilities, standards and expectations are salient: structure helps, but every external demand need not become personal pressure.'],resource:['重视理解、准备与安全感；优势是愿意学习和复盘，盲点是准备替代行动。','Understanding, preparation and reassurance matter: learning and reflection help, but preparation can displace action.']}
    return {summary:styles[primary][lang==='zh'?0:1],paragraphs:[dominant,styles[secondary][lang==='zh'?0:1],capacity],suggestions:[t('留意自己在压力下会放大哪一种倾向，再用一次具体反馈校正。','Notice which tendency grows under pressure, then calibrate it with one specific piece of feedback.')]}
  }
  if(topic==='career') {
    const chain=a.pools.output>1&&a.pools.wealth>1?t('食伤与财星同时可见，可把表达、分析或制作能力连接到明确的需求与交付；有想法之后，还需要预算、验收和兑现环节。','Expression and resource exchange both appear: connect analysis, communication or making to a defined need and deliverable, supported by budget and acceptance criteria.'):a.pools.authority>1&&a.pools.resource>1?t('官杀与印星同时可见，标准与学习能形成衔接：把要求转成技能、清单和协作流程，比独自硬扛更合适。','Responsibility and learning coexist: translate standards into skills, checklists and collaboration rather than carrying every demand alone.'):t('事业重点放在突出角色对应的工作方式：先确认任务边界，再用看得见的交付检验方法是否适合自己。','Use the dominant roles as a prompt for working style: clarify scope, then test the approach against an observable deliverable.')
    return {summary:chain,paragraphs:[dominant,capacity,t('把工作方式与当前岗位的实际要求对照：哪些部分能用现有能力完成，哪些需要协作或练习。','Compare this working style with the actual role: identify what existing skills can deliver and what needs collaboration or practice.')],suggestions:[t('把下一项工作拆成目标、责任人、资源和验收标准四项。','Define the next task’s goal, owner, resources and acceptance criteria.')]}
  }
  if(topic==='money') return {summary:a.pools.wealth>1?t('财星有可见线索，关注点在资源交换与兑现；能否承接收益仍要与自身支持、支出和责任一起看。','Resource-exchange symbolism is present; realizing value still depends on support, expenditure and responsibilities.'):t('财星在当前权重下不突出，不等于没有财运；资源主题宜从能力产出、预算与稳定积累来理解。','Resource symbolism is less prominent in this model, which does not mean an absence of income potential. Focus on useful output, budgeting and steady accumulation.'),paragraphs:[capacity,a.pools.peer>a.pools.wealth?t('比劫相对突出，合作资源与自主分配可能同时重要；共同投入时把份额、责任和退出方式先说清。','Peer symbolism outweighs resource symbolism: shared resources and autonomy may compete. Clarify contributions, responsibilities and exit terms before pooling resources.'):t('把获得资源和留住资源分开：回报、现金流、时间成本需要分别检查。','Separate acquiring resources from retaining them: review return, cash flow and time costs individually.')],suggestions:[t('先核对真实收支与承诺，再决定新增支出；分数不用于择时交易。','Check actual income, costs and commitments before adding expense; do not use symbolic scores for trade timing.')]}
  if(topic==='love') return {summary:a.interactions.some(i=>i.startsWith('branch-clash')&&(i.split(':')[1]==='2'||i.split(':')[2]==='2'))?t('日支存在冲的联系，关系议题中可能更需要协调节奏、边界或生活安排，适合先讨论可以一起调整的部分。','A clash involves the day branch, suggesting a symbolic focus on pace, boundaries or living arrangements; start by discussing what can be adjusted together.'):t('关系解读聚焦日支与整体表达方式：理解需求如何被说出，比从单一星神推断伴侣更可靠。','Read the day branch alongside the overall communication style: how needs are expressed matters more than assigning a partner’s traits from one symbol.'),paragraphs:[capacity,a.pools.authority>a.pools.output?t('责任线索强于表达线索时，容易先做该做的事；仍需把期待说出口，避免用尽责代替情感交流。','When responsibility outweighs expression, doing one’s duty may take priority. State expectations openly so reliability does not replace emotional communication.'):t('表达与自主需要占有位置时，给对方回应空间；不同意可以是需要协商的差异，而不是关系结论。','Where expression and autonomy matter, leave room for a response. Disagreement can be a negotiable difference rather than a verdict on the relationship.'),t('把相处中的共同责任、独立空间和情感表达分开讨论，更容易找到彼此愿意实践的调整。','Discuss shared responsibilities, independent space and emotional expression separately to find changes both people can practice.')],suggestions:[t('用一个具体情境说明“我需要什么”，并邀请对方说出对应需求。','Describe one concrete situation and what you need, then invite the other person’s perspective.')]}
  return {summary:dominant,paragraphs:[capacity],suggestions:[t('以现实反馈检查这些象征倾向是否适用。','Check whether these symbolic tendencies fit observable experience.')]}
}
export function baziNatalReport(input:BirthInput, language:Language):InterpretationReport {
  const t=(zh:string,en:string)=>reportText(language,zh,en)
  const chart=calculateBazi(input), a=analyzeBazi(chart)
  const stable=chart.pillars.filter(p=>p.value).map(p=>p.value).join(' · ')
  const sections:ReportSection[]=[]
  const evidence=[...chart.pillars.flatMap((p,i)=>p.value?[`${PILLAR_NAMES[i][language==='zh'?0:1]} ${p.value} · ${t('藏干','hidden stems')} ${p.hidden.join(' / ')}`]:[]),...roleEvidence(a,language)]
  sections.push(section('overview',t('命局总览','Chart overview'),a.day?`${a.day}${elemName(elementIndex(a.day),language)} · ${strengthText(a.strength,language)}`:t('日期范围跨越日柱边界，先读稳定的年、月柱。','The date range crosses a day-pillar boundary. Start with stable year and month pillars.'),[t(`当前可确定的柱：${stable||'暂无'}。五行数量只是排盘显示；下文另以月令、根气、透干与生克角色建立解释。`,`Currently stable pillars: ${stable||'none'}. Visible element counts are descriptive; interpretation separately considers season, roots, visible stems and generating/controlling roles.`),...interactionEvidence(a,language).map(e=>t(`${e}：保留其连接或调整含义；没有满足合化条件的验证，不把它改算为另一五行。`,`${e}: retain its linking or adjusting symbolism; no elemental transformation is assumed without a verified transformation rule.`))],evidence,[]))
  if(a.day) {
    const favorable=a.favorable.map(i=>elemName(i,language)).join('、')
    const caution=a.caution.map(i=>elemName(i,language)).join('、')
    sections.push(section('balance',t('五行、日主与喜忌','Elements, strength and balance'),strengthText(a.strength,language),[
      t(`日主同类根气出现在${a.roots.length? a.roots.map(r=>`${PILLAR_NAMES[r.pillar][0]}${r.stem}`).join('、'):'已知柱中未见'}；透出的非日主天干中，有根者${a.visible.filter(v=>v.rooted).map(v=>v.stem).join('、')||'暂无'}。藏干与透干共同参与，不按缺什么就补什么。`,`Same-element roots: ${a.roots.map(r=>`${PILLAR_NAMES[r.pillar][1]} ${r.stem}`).join(', ')||'none in the known pillars'}. Rooted visible stems excluding the day master: ${a.visible.filter(v=>v.rooted).map(v=>v.stem).join(', ')||'none'}. Hidden and visible stems both contribute; a missing element is not automatically favorable.`),
      a.favorable.length?t(`在普通扶抑前提下，${favorable}列为优先观察的调节方向，${caution}过度叠加需留意。这里的“喜忌”是结构作用，不是颜色、饰品或行为的吉凶指令。`,`Under an ordinary balance interpretation, ${favorable} are directions to observe for adjustment; an excess of ${caution} warrants attention. These describe structural roles, not lucky colors, objects or prescribed actions.`):t('当前不把五行强行分成固定喜与忌：交错结构看实际岁运如何改变平衡，资料不全或特殊结构先保留结论。','No fixed favorable/unfavorable list is forced here. Mixed structures depend on how a period changes the balance; incomplete or special structures retain an open conclusion.'),
      t('食伤能泄身也能生财，官杀能形成秩序也会增加承载压力，印能支持也可能抑制输出；同一五行的作用取决于原局，不统一判好坏。','Expression can spend energy and support exchange; responsibility can create order and pressure; support can restore capacity and inhibit output. An element’s role depends on the whole chart, not a universal good/bad label.'),
    ],[...roleEvidence(a,language),t(`生扶加权占比：${((a.share??0)*100).toFixed(1)}%；这是内部诊断值，不是运势分。`,`Weighted support share: ${((a.share??0)*100).toFixed(1)}%; this is a model diagnostic, not a fortune score.`)],[chart.resolved.instant?t('结合具体生活反馈核对；极端结构需要单独辨格。','Check the reading against specific experience; extreme structures need separate pattern review.'):t('补充准确出生时间后重算整体旺衰与喜忌。','Provide an accurate birth time to recalculate overall strength and favorable elements.')]))
    for(const topic of ['personality','career','money','love'] as const) {
      const reading=themeReading(topic,a,language)
      sections.push(section(topic,topic==='personality'?t('性格与优势短板','Personality, strengths and tensions'):topicName(topic,language),reading.summary,reading.paragraphs,[...roleEvidence(a,language),...interactionEvidence(a,language)],reading.suggestions))
    }
  } else {
    for(const id of ['balance','personality','career','money','love']) sections.push(section(id,id==='balance'?t('五行与喜忌','Elements and balance'):id==='personality'?t('性格与优势短板','Personality'):topicName(id as ReportTopic,language),t('日主尚不能确定，暂不把候选命盘拼成一个人的结论。','The day master is not stable across the time range; candidate charts are not merged into a single personal conclusion.'),[],[t(`日柱候选：${chart.pillars[2].candidates.join(' / ')}`,`Day-pillar candidates: ${chart.pillars[2].candidates.join(' / ')}`)],[t('补充出生时刻，或先明确能确认的时间范围。','Provide the birth time or establish a narrower known time range.')]))
  }
  return {id:`bazi:natal:${input.date}:${input.time}:${input.timeZone}:${input.zi}:${input.calendar}:${input.leapMonth}:${input.direction}:${language}`,version:BAZI_REPORT_VERSION,title:t('八字命盘与完整解读','BaZi chart and interpretation'),summary:sections[0].summary,sections,dos:[],donts:[],method:commonMethod(input,language),limitations:limits(chart,a,language)}
}

/** The displayed date identifies the selected GanZhi day, including early-Zi rollover. */
export function baziDateKey(now:Date,zi:1|2) {
  const p=zonedParts(now,'+08:00')
  const date=Temporal.PlainDate.from({year:p.year,month:p.month,day:p.day})
  return (zi===1&&p.hour>=23?date.add({days:1}):date).toString()
}
type Cycle='day'|'month'|'year'|'decade'
const solarInstant=(s:Solar)=>`${s.toYmdHms().replace(' ','T')}+08:00`
function forecastPeriod(chart:Chart,dateKey:string,cycle:Cycle) {
  const date=Temporal.PlainDate.from(dateKey)
  if(date.year<1901||date.year>2100) throw new RangeError('BaZi forecasts support 1901–2100')
  const noon=dateAtNoon(dateKey,'+08:00')
  const solar=Solar.fromYmdHms(date.year,date.month,date.day,12,0,0), lunar=solar.getLunar()
  const day=baziDayTheme(chart,noon)
  const decade=chart.periods.find(p=>noon.getTime()>=new Date(p.startInstant).getTime()&&noon.getTime()<new Date(p.endInstant).getTime())
  if(cycle==='decade') return {start:decade?.startInstant??'',end:decade?.endInstant??'',target:decade?.value??'',day,decade}
  if(cycle==='month') return {start:solarInstant(lunar.getPrevJie().getSolar()),end:solarInstant(lunar.getNextJie().getSolar()),target:day.month,day,decade}
  if(cycle==='year') {
    let year=date.year
    let start=Solar.fromYmdHms(year,7,1,12,0,0).getLunar().getJieQiTable()['立春']
    if(noon.getTime()<new Date(solarInstant(start)).getTime()) {year--;start=Solar.fromYmdHms(year,7,1,12,0,0).getLunar().getJieQiTable()['立春']}
    const end=Solar.fromYmdHms(year+1,7,1,12,0,0).getLunar().getJieQiTable()['立春']
    return {start:solarInstant(start),end:solarInstant(end),target:day.year,day,decade}
  }
  const startDate=chart.zi===1?date.subtract({days:1}):date
  const endDate=chart.zi===1?date:date.add({days:1})
  const time=chart.zi===1?'23:00:00':'00:00:00'
  return {start:`${startDate}T${time}+08:00`,end:`${endDate}T${time}+08:00`,target:day.target,day,decade}
}
type PeriodSignal={layer:string;value:string;role:Role;weight:number;balance:number;clashes:number;combines:number;partnerChange:boolean}
function signal(chart:Chart,a:ReturnType<typeof analyzeBazi>,layer:string,value:string,weight:number):PeriodSignal {
  const stemIndex=elementIndex(value[0]), role=roleOf(value[0],a.day)
  const branchElements=HIDDEN[value[1]].map(elementIndex)
  const hiddenWeights=weights(branchElements.length)
  const adjustment=(element:number)=>a.favorable.includes(element)?1:a.caution.includes(element)?-1:0
  const balance=.55*adjustment(stemIndex)+.45*branchElements.reduce((sum,e,i)=>sum+adjustment(e)*hiddenWeights[i],0)
  const clashes=chart.pillars.filter(p=>p.branch&&pairIn(CLASH,p.branch,value[1])).length
  const combines=chart.pillars.filter(p=>p.branch&&pairIn(COMBINE,p.branch,value[1])).length
  const partnerChange=Boolean(chart.pillars[2].branch&&pairIn(CLASH,chart.pillars[2].branch,value[1]))
  return {layer,value,role,weight,balance,clashes,combines,partnerChange}
}
function signalScore(s:PeriodSignal,topic:ReportTopic) {
  // A combination is not an automatic bonus; a clash adds an adjustment load only.
  const relevance:Record<ReportTopic,Partial<Record<Role,number>>>={overall:{},career:{output:2,authority:2,resource:1},money:{wealth:3,output:1},love:{resource:1,output:1}}
  return s.weight*(s.balance*12+(relevance[topic][s.role]??0)-Math.min(s.clashes,2)*1.5-(topic==='love'&&s.partnerChange?2:0))
}
export function baziForecast(input:BirthInput,dateKey:string,cycle:Cycle,language:Language):InterpretationReport {
  const t=(zh:string,en:string)=>reportText(language,zh,en)
  const chart=calculateBazi(input),a=analyzeBazi(chart), period=forecastPeriod(chart,dateKey,cycle)
  const cycleTitle=({day:['每日','Daily'],month:['流月','Solar-term month'],year:['流年','Li-Chun year'],decade:['大运','Ten-year luck cycle']})[cycle][language==='zh'?0:1]
  const labels={decade:t('大运','Luck cycle'),year:t('流年','Year'),month:t('流月','Month'),day:t('流日','Day')}
  const layers: {layer:string;value:string;weight:number;interval?:string}[]=[]
  const background:string[]=[]
  const startMs=Date.parse(period.start),endMs=Date.parse(period.end),duration=endMs-startMs
  let covered=0
  if(duration>0) for(const luck of chart.periods) {
    const from=Math.max(startMs,Date.parse(luck.startInstant)),to=Math.min(endMs,Date.parse(luck.endInstant))
    if(to<=from) continue
    const fraction=(to-from)/duration
    covered+=fraction
    const range=`${Temporal.Instant.fromEpochMilliseconds(from).toZonedDateTimeISO('+08:00').toPlainDateTime().toString()} → ${Temporal.Instant.fromEpochMilliseconds(to).toZonedDateTimeISO('+08:00').toPlainDateTime().toString()}`
    layers.push({layer:labels.decade,value:luck.value,weight:(cycle==='decade'?1:.2)*fraction,interval:range})
    background.push(t(`${range} UTC+08：${luck.value}大运覆盖本期${(fraction*100).toFixed(1)}%，以这一段的角色作用理解背景。`,`${range} UTC+08: the ${luck.value} luck cycle covers ${(fraction*100).toFixed(1)}% of this period; read its role as the background for that segment.`))
  }
  if(duration>0&&covered<.9999&&chart.periods.length) background.push(t(`本期另有${((1-covered)*100).toFixed(1)}%尚未起运或超出已计算大运范围，仅采用原局与当前节令层。`,`${((1-covered)*100).toFixed(1)}% of this period falls before or outside the calculated luck cycles; only the natal and calendar layers apply there.`))
  if(cycle!=='decade') layers.push({layer:labels.year,value:period.day.year,weight:cycle==='year'?1:.25})
  if(cycle==='day'||cycle==='month') layers.push({layer:labels.month,value:period.day.month,weight:cycle==='month'?.75:.25})
  if(cycle==='day') layers.push({layer:labels.day,value:period.day.target,weight:.3})
  const signals=a.day?layers.map(l=>({...signal(chart,a,l.layer,l.value,l.weight),interval:l.interval})):[]
  const unavailable=cycle==='decade'&&!period.decade
  const eligible=!unavailable&&chart.resolved.instant!==null&&a.strength!=='review'&&a.strength!=='unknown'
  const scores=cycle==='day'?Object.fromEntries(TOPICS.map(topic=>[topic,eligible?scoreFromEvidence(55+signals.reduce((sum,s)=>sum+signalScore(s,topic),0)):null])) as Record<ReportTopic,number|null>:undefined
  const evidence=signals.map(s=>t(`${s.layer} ${s.value}：${roleName(s.role,language)}；扶抑贡献 ${s.balance.toFixed(2)}，原局支冲 ${s.clashes}，支合 ${s.combines}，层级权重 ${s.weight}。`,`${s.layer} ${s.value}: ${roleName(s.role,language)}; balance contribution ${s.balance.toFixed(2)}, natal branch clashes ${s.clashes}, combinations ${s.combines}, layer weight ${s.weight}.`)+(s.interval?` ${s.interval} UTC+08`:''))
  const focus=signals.at(-1)
  const summary=unavailable?t('所选日期尚无可计算的大运。需准确出生时刻、起运方向，且日期落在已计算的八步大运内。','No calculated luck cycle covers this date. An exact birth time, direction and a date within the eight calculated cycles are required.'):!focus?t('日主不确定，仅列出节令范围；暂不生成个人运势结论。','The day master is uncertain. The calendar range is available, but no personal forecast conclusion is generated.'):t(`${focus.layer}${focus.value}强化${roleName(focus.role,language)}主题。${focus.balance>0?'按当前扶抑模型较有调节作用，宜把机会转成具体步骤。':focus.balance<0?'按当前扶抑模型需要管理承载与节奏，先稳住资源。':'原局喜忌没有单向结论，宜关注情境变化与实际反馈。'}`,`${focus.layer} ${focus.value} emphasizes ${roleName(focus.role,language)}. ${focus.balance>0?'The balance model suggests an adjusting role; turn possibilities into concrete steps.':focus.balance<0?'The balance model emphasizes capacity and pacing; secure support first.':'The natal balance has no one-way conclusion; watch context and actual feedback.'}`)
  const sections:ReportSection[]=[section('overview',t('阶段总览','Period overview'),summary,[strengthText(a.strength,language),...background,t('同一岁运要放回原局理解；大运是背景，流年与流月是阶段条件，流日只是短时触发，不把一天放大成人生结论。','Read each period against the natal structure. Luck cycles provide background, years and months add conditions, and a day is only a short-term trigger.')],evidence,[])]
  for(const topic of ['career','money','love'] as const) {
    const natal=a.day?themeReading(topic,a,language):null
    const relevant=signals.filter(s=>topic==='career'?['authority','output','resource'].includes(s.role):topic==='money'?['wealth','output','peer'].includes(s.role):s.partnerChange||s.combines>0||['resource','output'].includes(s.role))
    const periodText=unavailable||!natal?summary:relevant.length?t(`${relevant.map(s=>`${s.layer}${s.value}`).join('、')}与此主题有直接线索；${topic==='career'?'先区分交付、学习和新增责任，确认是否有相应资源。':topic==='money'?'把可兑现的价值、共同投入与支出分别检查，优先确认可支配资源。':'安排一段可沟通的时间，确认需要协调的生活节奏、需求和边界。'}`,`${relevant.map(s=>`${s.layer} ${s.value}`).join(', ')} directly touch this theme. ${topic==='career'?'Separate deliverables, learning and added responsibilities, then check the resources for each.':topic==='money'?'Review realizable value, shared commitments and spending separately, starting with the resources actually available.':'Make room to coordinate daily rhythms, needs and boundaries.'}`):t('当前选定岁运没有突出这一主题的独立信号，沿用本命工作方式，并以实际情境决定节奏。','No distinct period signal dominates this topic. Use the natal working style and let current circumstances set the pace.')
    sections.push(section(topic,topicName(topic,language),periodText,natal?[natal.summary,...natal.paragraphs.slice(0,2)]:[],relevant.length?evidence.filter((_,i)=>relevant.includes(signals[i])):[],natal?.suggestions??[]))
  }
  const actions:Record<Role,{do:[string,string];avoid:[string,string]}>= {
    peer:{do:['合作前说清各自负责和可用的时间。','Agree on responsibilities and available time before collaborating.'],avoid:['避免为了证明自己而接下别人的全部工作。','Avoid taking on everyone else’s work to prove yourself.']},
    output:{do:['把一个想法整理成别人能反馈的小样或提纲。','Turn one idea into a small draft or outline someone can respond to.'],avoid:['避免只顾表达而跳过需求与验收标准。','Avoid expressing ideas without checking the need and acceptance criteria.']},
    wealth:{do:['核对一项支出、回款或共同投入的实际条件。','Check the actual terms of an expense, payment or shared commitment.'],avoid:['避免在资源与责任未说清前追加承诺。','Avoid adding commitments before resources and responsibilities are clear.']},
    authority:{do:['把最重要的一项责任拆成可完成的步骤。','Break the most important responsibility into manageable steps.'],avoid:['避免把所有外界要求都当成必须立刻完成的任务。','Avoid treating every external demand as immediately mandatory.']},
    resource:{do:['为当前难题找到一份可靠资料或一个支持者。','Find a reliable reference or a source of support for the current problem.'],avoid:['避免用反复准备替代一个已经可以开始的小行动。','Avoid replacing an available small action with endless preparation.']},
  }
  const chosen=focus?actions[focus.role]:null
  const dos=cycle==='day'&&eligible&&chosen?[chosen.do[language==='zh'?0:1],t((focus?.balance??0)<0?'先留出缓冲，再安排新增任务。':'完成一次小范围尝试后，主动收集反馈。',(focus?.balance??0)<0?'Leave a buffer before scheduling additional tasks.':'After a small trial, actively collect feedback.')]:[]
  const donts=cycle==='day'&&eligible&&chosen?[chosen.avoid[language==='zh'?0:1],t(signals.some(s=>s.partnerChange)?'避免替对方下结论，先确认彼此的安排和需要。':signals.some(s=>s.clashes)?'避免因安排临时变化就把分歧解释成敌意。':'避免把顺手的经验直接套到尚未了解的新情境。',signals.some(s=>s.partnerChange)?'Avoid deciding what the other person thinks; check plans and needs first.':signals.some(s=>s.clashes)?'Avoid treating a changed plan or disagreement as hostility.':'Avoid applying a familiar method to a new situation before understanding it.')]:[]
  return {id:`bazi:${cycle}:${period.start||dateKey}:${input.date}:${input.time}:${input.timeZone}:${input.zi}:${input.calendar}:${input.leapMonth}:${input.direction}:${language}`,version:BAZI_REPORT_VERSION,title:`${cycleTitle} · ${period.target}`,summary,sections,scores,dos,donts,period:period.start?{start:period.start,end:period.end,label:`${cycleTitle} · UTC+08`,timeZone:'+08:00'}:undefined,method:[...commonMethod(input,language),t('时间范围左闭右开。流月按实际节的时刻，流年按立春时刻；大运起运用库 sect 2，按出生参数排顺逆。阶段取所选日正午所在的周期；跨大运边界时按实际覆盖时长分段，分段权重乘覆盖比例。','Ranges include the start and exclude the end. Months use exact jie times and years Li Chun. Luck starts use library sect 2 with the selected direction parameter. A selected date uses its noon-containing period. Luck-cycle changes within it are segmented by actual duration and each background weight is multiplied by its coverage fraction.'),t('仅日运评分：基线55；各层贡献=权重×(扶抑作用×12＋主题角色提示0至3－每个支冲1.5，至多2个－日支受冲的感情调整2)。大运/年/月/日权重.2/.25/.25/.3，缺大运不补造；综合使用独立扶抑与调整贡献，非三项平均。分数限15–90，是规则提示刻度，非事件概率。','Only daily reports have scores: baseline 55; each layer contributes weight × (balance effect ×12 + role relevance 0–3 −1.5 per clash, capped at two −2 for a day-branch relationship adjustment). Luck/year/month/day weights are .2/.25/.25/.3; absent luck cycles are not invented. Overall uses its own balance/adjustment contributions, not an average. Scores are clamped to 15–90 and indicate rule emphasis, not event probabilities.')],limitations:[...limits(chart,a,language),...(!chart.periods.length?[t('起运资料不完整：大运背景尚未计入；年、月、日采用已知原局的有限解释。','Luck-cycle inputs are incomplete; forecasts omit that background and use the available natal structure.')]:[])]}
}
