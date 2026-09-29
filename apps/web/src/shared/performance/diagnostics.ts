import { version } from '../../../package.json'

const KEY = 'focusgo.diagnostics.v1'
const LIMIT = 100
export type ActivationEvent = 'first_focus_started' | 'first_focus_completed' | 'first_focus_dismissed'
type Entry = { at: number; version: string; route: string; viewport: 'small' | 'large'; event: string; value?: number; rating?: string }
const routes = new Set(['/', '/tasks', '/note', '/focus', '/calendar', '/diary', '/timeline', '/projects', '/trips', '/labs', '/support'])
export const diagnosticRoute = (pathname: string) => routes.has(pathname) ? pathname
  : pathname.startsWith('/workspace/settings') ? '/workspace/settings'
  : pathname.startsWith('/projects/') ? '/projects/:id'
  : pathname.startsWith('/trips/') ? '/trips/:id' : '/other'
export const readDiagnostics = (): Entry[] => {
  try { const rows: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); return Array.isArray(rows) ? rows.slice(-LIMIT) : [] } catch { return [] }
}
const append = (event: string, fields: Pick<Entry, 'value' | 'rating'> = {}) => {
  try {
    const entry: Entry = { at: Date.now(), version, route: diagnosticRoute(location.pathname), viewport: innerWidth < 768 ? 'small' : 'large', event, ...fields }
    sessionStorage.setItem(KEY, JSON.stringify([...readDiagnostics(), entry].slice(-LIMIT)))
  } catch { /* Diagnostics must never block application work. */ }
}
export const recordActivation = (event: ActivationEvent) => append(event)
export const recordVital = (metric: { name: string; value: number; rating: string }) => {
  if (!['LCP', 'INP', 'CLS'].includes(metric.name) || !Number.isFinite(metric.value) || metric.value < 0) return
  if (!['good', 'needs-improvement', 'poor'].includes(metric.rating)) return
  append(metric.name, { value: metric.value, rating: metric.rating })
}
export const downloadDiagnostics = () => {
  const blob = new Blob([JSON.stringify({ format: 'focusgo-diagnostics-v1', entries: readDiagnostics() }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'focusgo-diagnostics.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
