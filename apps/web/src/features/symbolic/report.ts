import type { Language } from './types'

export type ReportTopic = 'overall' | 'career' | 'money' | 'love'
export type ReportSection = { id: string; title: string; summary: string; paragraphs: string[]; evidence: string[]; suggestions: string[] }
export type InterpretationReport = {
  id: string
  version: string
  title: string
  summary: string
  sections: ReportSection[]
  scores?: Record<ReportTopic, number | null>
  dos: string[]
  donts: string[]
  method: string[]
  limitations: string[]
  period?: { start: string; end: string; label: string; timeZone?: string }
}
export type InterpretationRequest = { system: 'bazi' | 'astrology' | 'tarot'; facts: unknown; language: Language }
/** Future providers receive explicit facts. The current application never invokes an AI service. */
export interface InterpretationProvider { id: string; interpret(request: InterpretationRequest): Promise<InterpretationReport> }
export const reportText = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en
export const scoreFromEvidence = (value: number) => Math.round(Math.max(15, Math.min(90, value)))
export const TOPICS: ReportTopic[] = ['overall', 'career', 'money', 'love']
export const topicName = (topic: ReportTopic, language: Language) => ({ overall: ['综合', 'Overall'], career: ['事业', 'Career'], money: ['财运', 'Resources'], love: ['感情', 'Relationships'] })[topic][language === 'zh' ? 0 : 1]
