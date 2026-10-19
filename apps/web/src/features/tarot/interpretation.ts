import type { DrawnCard, Language, TarotContext, TarotReading, TarotSession } from '../symbolic/types'
import { Temporal } from '@js-temporal/polyfill'
import type { InterpretationReport, ReportSection } from '../symbolic/report'
import { cardName, tarotById } from './deck'
import { cardSemantics, TAG_NAMES, type SemanticTag } from './semantics'
import { defaultTarotContext, spreadName, spreadPositions, tarotTopicName, type PositionRole } from './spreads'

export const TAROT_REPORT_VERSION = 'tarot-rules-2.0.0'
type TarotFacts = { id: string; dateKey: string; timeZone?: string; spread: TarotReading['spread']; context?: TarotContext; cards: DrawnCard[] }
const choose = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en
function roleReading(role: PositionRole, meaning: ReturnType<typeof cardSemantics>, language: Language): string {
 const t = (zh: string, en: string) => choose(language, zh, en)
 switch (role) {
  case 'friction': return t(`放在阻力位置，“${meaning.theme}”提示需要先处理的制约。即使牌面有支持性的一面，也要检查它是否被过度使用、依赖或忽视。`, `In the friction position, “${meaning.theme}” points to a constraint to address. Even a supportive quality can become a difficulty when overused, relied on too heavily or neglected.`)
  case 'aCost': case 'bCost': return t(`这里读作该选项需要承担的功课，而非选项必然失败。“${meaning.theme}”是决定前应核对的成本或前提。`, `This position concerns the work required by this option, not inevitable failure. “${meaning.theme}” is a cost or condition to check before deciding.`)
  case 'aSupport': case 'bSupport': return t(`这里读作该选项可用的支持。若牌意呈现阻滞，说明这份支持需要先修复条件，不能当作已经到手的优势。`, 'Read this as available support for the option. If the meaning describes a blockage, the conditions for that support need repair; it is not an advantage already secured.')
  case 'trend': return t(`这是当前模式继续时的条件性走向。它把注意力引向“${meaning.theme}”，并不替代后续真实信息和你改变做法的空间。`, `This is a conditional direction if the present pattern continues. It draws attention to “${meaning.theme}”, while leaving room for new information and changes in your approach.`)
  case 'action': return t(`在行动位置，把“${meaning.theme}”落实为自己能够尝试的一步；涉及他人的部分需要真实沟通与对方同意。`, `In the action position, turn “${meaning.theme}” into a step within your control. Anything involving another person requires actual communication and their agreement.`)
  case 'interaction': return t('这里描述可观察的互动模式，不代替对方表态。请用实际发生的交流、投入和回应来核对。', 'This position describes an observable interaction pattern, not another person’s private thoughts. Check it against communication, effort and responses that actually occur.')
  case 'self': return t('这里先看自己带入关系的需求、期待与应对方式，把可以主动调整的部分找出来。', 'Start with the needs, expectations and responses you bring, then identify what you can adjust.')
  case 'bridge': return t('这里寻找双方能够共同经营的连接。它需要双方持续参与，不能由一个人的付出单独保证。', 'Look for a connection both people can cultivate. It requires participation from both; one person’s effort cannot guarantee it.')
  case 'influence': return t('这是影响走向的变量。观察这一条件是在增强、减弱还是尚未满足，再调整后续行动。', 'This is a variable affecting the direction. Observe whether it is growing, weakening or not yet met, and adapt your next step.')
  default: return t('这是当前问题的观察起点。先核对哪些描述符合实际处境，再阅读后续牌位如何回应它。', 'This is a starting lens for the question. Check what fits the actual situation, then see how the later positions respond.')
 }
}
export function questionFocus(context: TarotContext, language: Language): { id: string; label: string; prompt: string } | null {
 const q = context.question.toLowerCase()
 const entries = [
  { id: 'communication', match: /沟通|表达|联系|message|communicat|conversation/, label: ['沟通与回应','Communication and response'], prompt: ['将问题落实为：我需要说清什么、愿意倾听什么，以及何时核对回应。','Make the question concrete: what to communicate, what to listen for and when to review the response.'] },
  { id: 'change', match: /换工作|辞职|跳槽|离职|换岗|转行|job change|resign|new job|career change/, label: ['职业转换','Work transition'], prompt: ['比较现有工作的真实条件、新方向的已知信息与过渡资源；牌面用来组织比较，不能补齐未知的岗位事实。','Compare actual conditions in the current role, verified information about the new path and transition resources. The cards organise the comparison; they cannot supply missing job facts.'] },
  { id: 'repair', match: /复合|和好|修复|reconcil|repair/, label: ['关系修复','Repairing a relationship'], prompt: ['先核对双方是否愿意继续沟通，再看原有问题、边界与改变是否有实际行动支持。','First check whether both people wish to communicate, then review the old problem, boundaries and tangible changes.'] },
  { id: 'project', match: /项目|计划|推进|任务|project|plan|task/, label: ['计划推进','Moving a plan forward'], prompt: ['把下一步写成有负责人、截止点和完成标准的小交付，再用实际反馈复盘。','Define a small deliverable with an owner, a review date and a completion standard, then review real feedback.'] },
  { id: 'resources', match: /预算|储蓄|支出|收入|消费|budget|saving|expense|income/, label: ['资源安排','Resource planning'], prompt: ['先列明必要支出、可用储备和已承诺的责任，再判断哪些调整可以承受。','List essential costs, available reserves and existing commitments before judging which adjustments are affordable.'] },
 ]
 const found = entries.find(item => item.match.test(q))
 return found ? { id: found.id, label: found.label[language === 'zh' ? 0 : 1], prompt: found.prompt[language === 'zh' ? 0 : 1] } : null
}
export function interpretTarot(facts: TarotFacts, language: Language): InterpretationReport {
 const t = (zh: string, en: string) => choose(language, zh, en)
 const context = facts.context ?? defaultTarotContext()
 const positions = spreadPositions(facts.spread, context)
 if (facts.cards.length !== positions.length || new Set(facts.cards.map(c => c.id)).size !== facts.cards.length) throw new Error('Invalid spread cards')
 const meanings = facts.cards.map(entry => cardSemantics(entry, context, language))
 const names = facts.cards.map(entry => {
  const card = tarotById.get(entry.id)
  if (!card) throw new Error('Unknown tarot card')
  return cardName(card, language) + t(entry.reversed ? '（逆位）' : '（正位）', entry.reversed ? ' (reversed)' : ' (upright)')
 })
 const label = (i: number) => positions[i].name[language === 'zh' ? 0 : 1]
 const evidence = facts.cards.map((_, i) => `${label(i)} · ${names[i]}`)
 const topic = tarotTopicName(context.topic, language)
 const focus = questionFocus(context, language)
 const counts = new Map<SemanticTag, number>()
 meanings.forEach(m => counts.set(m.tag, (counts.get(m.tag) ?? 0) + 1))
 const repeated = [...counts].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1])
 const suits = new Map<string, number>()
 facts.cards.forEach(entry => { const suit = tarotById.get(entry.id)!.suit; suits.set(suit, (suits.get(suit) ?? 0) + 1) })
 const connections: string[] = []
 const linkEvidence: string[] = []
 for (const [tag, count] of repeated) {
  const theme = TAG_NAMES[tag][language === 'zh' ? 0 : 1]
  connections.push(t(`“${theme}”在 ${count} 个牌位重复出现，是这次解读需要优先处理的线索。它们位于不同角色中，需同时看机会、制约与行动，而不是简单相加为好坏。`, `“${theme}” appears in ${count} positions and is a priority theme. Read its different roles as support, constraints or action, rather than adding them into a good/bad score.`))
  linkEvidence.push(...evidence.filter((_, i) => meanings[i].tag === tag))
 }
 const dominantSuit = [...suits].find(([suit, count]) => suit !== 'major' && count >= 2)
 if (dominantSuit) {
  const suitDomains: Record<string, [string, string]> = { wands: ['行动、动机与推进节奏','action, motivation and pace'], cups: ['感受、联结与相处需求','feelings, connection and relationship needs'], swords: ['判断、沟通与分歧处理','judgement, communication and disagreement'], pentacles: ['资源、责任与现实条件','resources, responsibility and practical conditions'] }
  connections.push(t(`${dominantSuit[1]} 张同花色牌集中在${suitDomains[dominantSuit[0]][0]}。优先核对这些现实条件，有助于避免只凭单张牌作判断。`, `${dominantSuit[1]} cards share a suit, concentrating attention on ${suitDomains[dominantSuit[0]][1]}. Check these conditions before judging from one card alone.`))
  linkEvidence.push(...evidence.filter((_, i) => tarotById.get(facts.cards[i].id)!.suit === dominantSuit[0]))
 }
 const advancing = meanings.map((m, i) => m.pace === 'advance' ? i : -1).filter(i => i >= 0)
 const pausing = meanings.map((m, i) => m.pace === 'pause' ? i : -1).filter(i => i >= 0)
 if (advancing.length && pausing.length) {
  connections.push(t(`${names[advancing[0]]}带来推进倾向，而${names[pausing[0]]}要求停顿或核对。这里存在节奏上的制约：可以先做可撤回的小步，同时为尚未满足的条件留出观察时间。`, `${names[advancing[0]]} suggests momentum while ${names[pausing[0]]} asks for a pause or a check. The pacing tension favours a small reversible step, alongside time to observe unmet conditions.`))
  linkEvidence.push(evidence[advancing[0]], evidence[pausing[0]])
 }
 const majors = facts.cards.filter(c => tarotById.get(c.id)!.arcana === 'major').length
 if (facts.cards.length > 1 && majors >= Math.ceil(facts.cards.length / 2)) connections.push(t(`${majors} 张大阿尔卡那使主题偏向价值观、角色或阶段转变；这不代表事情必然重大，也不表示结果已经注定。`, `${majors} Major Arcana cards emphasise values, roles or transitions. This does not establish the objective importance of an event or make an outcome inevitable.`))

 let summary: string
 let synthesis: string[]
 if (facts.spread === 'choice') {
  const a = context.optionA.trim() || 'A', b = context.optionB.trim() || 'B'
  summary = t(`围绕“${a}”与“${b}”，共同前提是${meanings[0].theme}。A 路径需要把“${meanings[1].theme}”和“${meanings[2].theme}”一起考虑；B 路径则需要把“${meanings[3].theme}”和“${meanings[4].theme}”一起考虑。`, `For “${a}” and “${b}”, the shared condition is ${meanings[0].theme}. Path A pairs ${meanings[1].theme} with ${meanings[2].theme}; path B pairs ${meanings[3].theme} with ${meanings[4].theme}.`)
  synthesis = [
   t(`A · ${a}：${names[1]}处在支持位，${names[2]}处在承担位。可用支持是“${meanings[1].theme}”，但能否运用它取决于你是否愿意处理“${meanings[2].theme}”。`, `A · ${a}: ${names[1]} is support and ${names[2]} is commitment. The support of “${meanings[1].theme}” is useful only alongside willingness to address “${meanings[2].theme}”.`),
   t(`B · ${b}：${names[3]}处在支持位，${names[4]}处在承担位。可用支持是“${meanings[3].theme}”，前提是能为“${meanings[4].theme}”安排实际资源和行动。`, `B · ${b}: ${names[3]} is support and ${names[4]} is commitment. “${meanings[3].theme}” is available alongside the resources and action needed for “${meanings[4].theme}”.`),
   t(`比较时请分别写下两个选项的已知条件、不可接受的代价和可验证的下一步。两条路径都要回应核心牌${names[0]}；这里不将牌面换算成胜率，也不替你判定赢家。`, `For each path, list verified conditions, unacceptable costs and a testable next step. Both must respond to the central card, ${names[0]}; this comparison does not assign winning odds or choose a winner for you.`)
  ]
 } else if (facts.spread === 'relationship') {
  summary = t(`这段关系的阅读重点，是把自己的“${meanings[0].theme}”与互动中的“${meanings[1].theme}”对照，再从“${meanings[2].theme}”寻找可共同经营的连接。`, `Compare the “${meanings[0].theme}” you bring with “${meanings[1].theme}” in the interaction, then look to “${meanings[2].theme}” for a connection both people can cultivate.`)
  synthesis = [
   t(`${names[0]}与${names[1]}分别处在我的立场与互动位。先区分自己的期待和已经观察到的回应，避免把想要的关系状态当作双方共识。`, `${names[0]} and ${names[1]} occupy your position and interaction. Distinguish your expectations from observed responses; a desired relationship state is not necessarily a shared agreement.`),
   t(`连接位的${names[2]}提供共同经营的方向，但张力位的${names[3]}提醒：这份连接还要面对“${meanings[3].theme}”的制约。讨论具体行为，比直接给关系定性更有用。`, `${names[2]} offers a direction for connection, while ${names[3]} in the tension position adds the constraint of “${meanings[3].theme}”. Discuss specific behaviour rather than labelling the whole relationship.`),
   t(`下一步由${names[4]}承接：${meanings[4].practice} 请把它转为一次自己能够发起、允许对方选择是否参与的行动。`, `${names[4]} carries the next step: ${meanings[4].practice} Make it an action you can initiate while allowing the other person to choose whether to participate.`)
  ]
 } else if (facts.spread === 'three') {
  summary = t(`从“${meanings[0].theme}”的当前处境出发，先回应“${meanings[1].theme}”这一${context.intent === 'development' ? '变化因素' : '制约'}，再用“${meanings[2].theme}”理解${context.intent === 'development' ? '模式延续的方向' : '可行的下一步'}。`, `Begin with “${meanings[0].theme}”, respond to “${meanings[1].theme}” as the ${context.intent === 'development' ? 'changing influence' : 'constraint'}, then use “${meanings[2].theme}” to consider ${context.intent === 'development' ? 'the direction of the continuing pattern' : 'a practical next step'}.`)
  synthesis = [
   t(`${names[0]}说明起点；${names[1]}位于${label(1)}，因此后者需要结合前者的实际处境阅读，不能单独拿来判断事情好坏。`, `${names[0]} describes the starting lens; ${names[1]} occupies ${label(1)} and must be read in that context rather than as an isolated good or bad verdict.`),
   context.intent === 'development'
    ? t(`若“${meanings[1].theme}”持续影响局面，${names[2]}提示接下来需观察“${meanings[2].theme}”。一旦条件或你的行动改变，应重新看真实进展，而不是要求事情符合牌面。`, `If “${meanings[1].theme}” continues to influence the situation, ${names[2]} points to “${meanings[2].theme}” as something to watch. If conditions or actions change, review actual progress rather than requiring events to fit the reading.`)
    : t(`${names[2]}给出的行动需要回应第二张牌的制约：${meanings[2].practice} 同时核对“${meanings[1].theme}”是否已有改善，避免只做行动而绕过关键问题。`, `The action in ${names[2]} should respond to the second card’s constraint: ${meanings[2].practice} Check whether “${meanings[1].theme}” improves, rather than acting while bypassing the central issue.`)
  ]
 } else {
  summary = t(`今日主题是“${meanings[0].theme}”。${meanings[0].meaning}`, `Today’s theme is “${meanings[0].theme}”. ${meanings[0].meaning}`)
  synthesis = [meanings[0].domain, meanings[0].practice]
 }
 const sections: ReportSection[] = [{
  id: 'synthesis', title: t('综合解读','Reading the spread together'), summary, paragraphs: synthesis, evidence, suggestions: [focus?.prompt ?? meanings[meanings.length - 1].domain]
 }]
 if (context.question.trim()) sections.push({
  id: 'question', title: t('回到你的问题','Returning to your question'),
  summary: context.question,
  paragraphs: [
   t(`本次按“${topic}”主题与“${spreadName(facts.spread, language)}”牌位阅读。问题背景帮助你核对哪些牌意贴合真实处境；系统不会把未提供的经历或他人的想法补写成事实。`, `This reading uses the ${topic} topic and ${spreadName(facts.spread, language)} positions. Use your question’s context to check what fits; the system does not invent untold events or other people’s thoughts.`),
   focus ? t(`问题中出现了“${focus.label}”方向的词语，因此补充以下核对点。`, `The question contains words associated with “${focus.label}”, so the following check is included.`) : t('当前问题没有命中额外的方向词规则，解读依据你明确选择的主题、意图与牌位组织。','No additional focus-word rule matched; the reading is organised by your explicit topic, intent and card positions.')
  ], evidence: [t(`所选主题：${topic}`, `Selected topic: ${topic}`), ...focus ? [focus.id] : []], suggestions: [focus?.prompt ?? meanings[0].domain]
 })
 facts.cards.forEach((_, i) => {
  const option = positions[i].role.startsWith('a') && facts.spread === 'choice' ? context.optionA : positions[i].role.startsWith('b') && facts.spread === 'choice' ? context.optionB : ''
  sections.push({ id: `card-${i}`, title: `${label(i)}${option ? ' · ' + option : ''}`, summary: names[i], paragraphs: [meanings[i].meaning, roleReading(positions[i].role, meanings[i], language), meanings[i].domain, ...meanings[i].topicKeywords ? [t('', `Topic vocabulary: ${meanings[i].topicKeywords}.`)] : []], evidence: [positions[i].purpose[language === 'zh' ? 0 : 1], t(`牌义线索：${meanings[i].theme}`, `Meaning theme: ${meanings[i].theme}`)], suggestions: [meanings[i].practice] })
 })
 if (connections.length) sections.push({ id: 'relations', title: t('牌与牌如何呼应','How the cards interact'), summary: t('重复、节奏与整体结构','Repetition, pacing and the spread’s structure'), paragraphs: connections, evidence: [...new Set(linkEvidence.length ? linkEvidence : evidence)], suggestions: [t('将最符合实际处境的一条线索写入心得，并在行动后回来核对。','Record the thread that best fits the situation and return after taking action.')] })
 const cautionIndices = facts.spread === 'choice' ? [2,4] : facts.spread === 'relationship' ? [3] : facts.spread === 'three' ? [1] : [0]
 const dayStart = facts.spread === 'daily' ? Temporal.PlainDate.from(facts.dateKey).toZonedDateTime({ timeZone: facts.timeZone ?? 'UTC', plainTime: '00:00' }) : null
 return {
  id: `tarot:${facts.id}:${language}`, version: TAROT_REPORT_VERSION, title: spreadName(facts.spread, language), summary, sections,
  dos: [...new Set([meanings[meanings.length - 1].practice, focus?.prompt ?? meanings[0].domain])],
  donts: [...new Set(cautionIndices.map(index => meanings[index].avoid))],
  method: [t('伟特体系语义参考；78 张牌各有正逆位文本。按主题、意图、牌位和跨牌关系组合，不调用 AI。','Waite-informed meanings with distinct upright/reversed text for all 78 cards. Topic, intent, position and cross-card relations are composed without AI calls.'), t('逆位表示阻滞、内化、过度或调整等可能，具体以该牌文本为准；不一律视为坏牌。','Reversals may describe blockage, internalisation, excess or adjustment according to the card text; they are not uniformly negative.'), t('问题方向使用有限词组匹配，完整自由文本不作语义理解。报告生成后随记录保存，后续内容更新不改写本次报告。','Question-focus hints use a finite phrase list, not full free-text understanding. Generated reports are saved with the reading and are not rewritten by later content updates.')],
  limitations: [t('这是可追溯规则生成的象征性解读，不是事实核验或确定的事件预测。关系牌不能读取他人的隐私想法。','This is a symbolic interpretation generated from traceable rules, not fact verification or certain event prediction. Relationship cards do not reveal private thoughts.')],
  period: dayStart ? { start: dayStart.toInstant().toString(), end: dayStart.add({ days: 1 }).toInstant().toString(), label: facts.dateKey, timeZone: facts.timeZone ?? 'UTC' } : undefined,
 }
}
export function buildTarotReports(session: TarotSession) {
 const facts = { id: session.id, dateKey: session.dateKey, timeZone: session.timeZone, spread: session.spread, context: session.context, cards: session.selected.map(index => session.deck[index]) }
 return { zh: interpretTarot(facts, 'zh'), en: interpretTarot(facts, 'en') }
}
