import type { LucideIcon } from 'lucide-react'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
} from 'lucide-react'
import { getWeatherCodeMeta } from './weatherCodeMeta'

const ICON_BY_TONE = {
  sun: Sun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
} as const satisfies Record<string, LucideIcon>

const CLASS_BY_TONE = {
  sun: 'weather-icon--sun',
  cloud: 'weather-icon--cloud',
  fog: 'weather-icon--fog',
  drizzle: 'weather-icon--drizzle',
  rain: 'weather-icon--rain',
  snow: 'weather-icon--snow',
  storm: 'weather-icon--storm',
} as const

export function getWeatherIconMeta(code: number) {
  const meta = getWeatherCodeMeta(code)
  return {
    label: meta.label,
    Icon: ICON_BY_TONE[meta.tone],
    className: CLASS_BY_TONE[meta.tone],
  }
}
