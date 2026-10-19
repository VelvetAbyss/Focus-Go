import type { InterpretationReport } from './report'
export type SymbolicModule = 'bazi' | 'astrology' | 'tarot'
export type Language = 'zh' | 'en'
export type BirthInput = {
  name: string; date: string; calendar: 'solar' | 'lunar'; leapMonth: boolean; time: string; timeZone: string
  latitude: number | null; longitude: number | null; direction: 'male' | 'female' | ''; zi: 1 | 2; place?: string; relationship?: string
}
export type BirthProfile = BirthInput & { id?: string; version: string; savedAt: number }
export type DrawnCard = { id: string; reversed: boolean; revealed: boolean }
export type TarotSpread = 'daily' | 'three' | 'choice' | 'relationship'
export type TarotContext = { topic: 'general' | 'career' | 'money' | 'love'; intent: 'action' | 'development' | 'choice' | 'relationship'; question: string; optionA: string; optionB: string }
export type TarotReading = {
  id: string; createdAt: number; timeZone: string; dateKey: string; spread: TarotSpread; question: string
  cards: DrawnCard[]; reflection: string; contentVersion: '1' | '2'
  context?: TarotContext; reports?: { zh: InterpretationReport; en: InterpretationReport }
  archived?: boolean; sourceId?: string; serverConfirmed?: boolean
}
export type TarotSession = {
  id: string; createdAt: number; timeZone: string; dateKey: string; spread: TarotSpread
  context: TarotContext; deck: DrawnCard[]; selected: number[]; completedReadingId?: string
}
export type SymbolicState = { profile: BirthProfile | null; profiles: BirthProfile[]; versions: BirthProfile[]; readings: TarotReading[]; sessions: TarotSession[]; timeZone: string }
export const EMPTY_SYMBOLIC_STATE: SymbolicState = { profile: null, profiles: [], versions: [], readings: [], sessions: [], timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
export const emptyBirthInput = (): BirthInput => ({ name: '', date: '', calendar: 'solar', leapMonth: false, time: '', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai', latitude: null, longitude: null, direction: '', zi: 2 })
