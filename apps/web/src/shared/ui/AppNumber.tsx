import type { CSSProperties } from 'react'
import NumberFlow, { NumberFlowGroup } from '@number-flow/react'
import { useMemo } from 'react'
import { usePreferences } from '../prefs/usePreferences'

import type { Format, Trend, Value } from '@number-flow/react'

export type AppNumberProps = {
  value: Value
  prefix?: string
  suffix?: string
  format?: Format
  trend?: Trend
  animated?: boolean
  className?: string
  style?: CSSProperties
  title?: string
  'aria-label'?: string
  'aria-hidden'?: boolean
}

export const AppNumber = ({
  value,
  prefix,
  suffix,
  format,
  trend,
  animated = true,
  className,
  style,
  title,
  ...aria
}: AppNumberProps) => {
  const { numberAnimationsEnabled } = usePreferences()

  const locales = useMemo<Intl.LocalesArgument | undefined>(() => {
    if (typeof navigator === 'undefined') return undefined
    return navigator.languages
  }, [])

  const flowAnimated = numberAnimationsEnabled && animated

  return (
    <NumberFlow
      className={className}
      style={style}
      title={title}
      value={value}
      locales={locales}
      format={{ useGrouping: false, ...(format ?? {}) }}
      prefix={prefix}
      suffix={suffix}
      animated={flowAnimated}
      respectMotionPreference={!numberAnimationsEnabled}
      trend={trend}
      {...aria}
    />
  )
}

export const AppNumberGroup = NumberFlowGroup
