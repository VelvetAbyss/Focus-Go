import { createContext, useContext, useEffect } from 'react'

export type WidgetSummary = {
  value?: string
  detail?: string
  items?: string[]
  progress?: number
}

export const WidgetPresentationContext = createContext<((summary: WidgetSummary) => void) | null>(null)

/** Report the same live state the full widget uses; no second data loader. */
export function useWidgetSummary(summary: WidgetSummary) {
  const report = useContext(WidgetPresentationContext)
  const serialized = JSON.stringify(summary)
  useEffect(() => { report?.(JSON.parse(serialized) as WidgetSummary) }, [report, serialized])
}
