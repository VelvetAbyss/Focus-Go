import type { Language, TarotContext, TarotReading } from '../symbolic/types'

export type SpreadId = TarotReading['spread']
export type PositionRole = 'present' | 'friction' | 'action' | 'influence' | 'trend' | 'aSupport' | 'aCost' | 'bSupport' | 'bCost' | 'self' | 'interaction' | 'bridge'
export type SpreadPosition = { role: PositionRole; name: [string, string]; purpose: [string, string] }
const position = (role: PositionRole, zh: string, en: string, zhPurpose: string, enPurpose: string): SpreadPosition => ({ role, name: [zh, en], purpose: [zhPurpose, enPurpose] })
export const defaultTarotContext = (): TarotContext => ({ topic: 'general', intent: 'action', question: '', optionA: '', optionB: '' })
export const tarotTopicName = (topic: TarotContext['topic'], language: Language) => ({ general: ['综合', 'General'], career: ['事业', 'Career'], money: ['财运', 'Resources'], love: ['感情', 'Relationships'] })[topic][language === 'zh' ? 0 : 1]
export const spreadName = (spread: SpreadId, language: Language) => ({ daily: ['每日一牌', 'Daily card'], three: ['三张牌', 'Three cards'], choice: ['二选一', 'Two paths'], relationship: ['感情关系', 'Relationship'] })[spread][language === 'zh' ? 0 : 1]
/** V1 records predate question intent. Their original position labels never inherit a new draft. */
export function legacySpreadPositions(spread: SpreadId): SpreadPosition[] {
  return spread === 'daily' ? [position('action', '今日的一个视角', 'A perspective for today', '旧版每日提示', 'Original daily prompt')] : [
    position('present', '当下', 'Present', '旧版当下牌位', 'Original present position'),
    position('friction', '留意', 'Consider', '旧版留意牌位', 'Original consideration position'),
    position('action', '行动', 'Action', '旧版行动牌位', 'Original action position'),
  ]
}
export function recommendedSpread(context: TarotContext): Exclude<SpreadId, 'daily'> {
  return context.intent === 'choice' ? 'choice' : context.intent === 'relationship' ? 'relationship' : 'three'
}
export function spreadPositions(spread: SpreadId, context: TarotContext): SpreadPosition[] {
  if (spread === 'daily') return [position('action', '今日主题', 'Today’s theme', '今天可以主动关注和实践的方向', 'A direction to notice and practise today')]
  if (spread === 'choice') return [
    position('present', '选择的核心', 'The decision', '两个选项共同面对的条件', 'The condition shared by both paths'),
    position('aSupport', 'A · 可用的支持', 'A · Support', '选择 A 时可利用的资源与机会', 'Resources and openings available in path A'),
    position('aCost', 'A · 需要承担', 'A · Commitment', '选择 A 时需要面对的代价与功课', 'The cost or work required by path A'),
    position('bSupport', 'B · 可用的支持', 'B · Support', '选择 B 时可利用的资源与机会', 'Resources and openings available in path B'),
    position('bCost', 'B · 需要承担', 'B · Commitment', '选择 B 时需要面对的代价与功课', 'The cost or work required by path B'),
  ]
  if (spread === 'relationship') return [
    position('self', '我的立场', 'My position', '我带入关系的需求和行为', 'The needs and behaviour I bring'),
    position('interaction', '互动模式', 'Interaction', '能够在实际相处中观察到的模式', 'A pattern to check against observable interaction'),
    position('bridge', '连接所在', 'Connection', '双方可以共同经营的连接', 'A connection that both people can cultivate'),
    position('friction', '关系张力', 'Tension', '需要说清的分歧或边界', 'A difference or boundary to make explicit'),
    position('action', '下一步', 'Next step', '我可以采取的一项关系行动', 'A relationship action within my control'),
  ]
  if (context.intent === 'development') return [
    position('present', '当前处境', 'Current situation', '这个问题的起点', 'The starting point of this question'),
    position('influence', '变化因素', 'Changing influence', '正在影响事情走向的条件', 'A condition influencing the direction'),
    position('trend', '延续的趋势', 'Conditional trend', '目前模式延续时值得留意的方向', 'A direction to watch if the current pattern continues'),
  ]
  return [
    position('present', '当前处境', 'Current situation', '这个问题的起点', 'The starting point of this question'),
    position('friction', '主要阻力', 'Main friction', '最需要处理的制约', 'The constraint that most needs attention'),
    position('action', '可行行动', 'Practical action', '可以着手验证的一步', 'A step that can be tried and reviewed'),
  ]
}
export function validateTarotContext(context: TarotContext, spread: SpreadId): string | null {
  if (spread === 'daily') return null
  if (!context.question.trim()) return 'question'
  if (spread === 'choice' && (!context.optionA.trim() || !context.optionB.trim() || context.optionA.trim() === context.optionB.trim())) return 'options'
  return null
}
