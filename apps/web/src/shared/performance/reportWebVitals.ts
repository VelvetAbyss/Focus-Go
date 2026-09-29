import { diagnosticRoute, recordVital } from './diagnostics'
const WEB_VITAL_EVENT = 'focusgo:web-vital'

type MetricPayload = {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  route: string
}

const emitMetric = (metric: {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
}) => {
  const payload: MetricPayload = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    route: diagnosticRoute(window.location.pathname),
  }

  recordVital(payload)
  window.dispatchEvent(new CustomEvent(WEB_VITAL_EVENT, { detail: payload }))

  if (import.meta.env.DEV && window.localStorage.getItem('focusgo.perf.webVitalsLog') === '1') {
    console.debug('[web-vitals]', payload)
  }
}

export const installWebVitalsReporting = () => {
  if (typeof window === 'undefined') return

  const load = async () => {
    const { onCLS, onINP, onLCP } = await import('web-vitals')
    onCLS(emitMetric)
    onINP(emitMetric)
    onLCP(emitMetric)
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      void load()
    }, { timeout: 3000 })
    return
  }

  globalThis.setTimeout(() => {
    void load()
  }, 1500)
}

export type { MetricPayload }
