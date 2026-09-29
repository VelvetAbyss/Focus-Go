import { hex, mixRgb, type Rgb } from '../../../shared/three/surface'

/**
 * Weather → sky. Pure: turns a WMO weather code, day/night and the local clock
 * into everything the sky scene draws and the card needs for legible text.
 * Palettes are art-directed per family × time of day, muted like printed paper
 * rather than saturated like a phone widget.
 */

export type SkyFamily = 'clear' | 'cloudy' | 'overcast' | 'fog' | 'rain' | 'storm' | 'snow'
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type SkyTheme = 'light' | 'dark'

export type SkyParams = {
  family: SkyFamily
  phase: SkyPhase
  top: Rgb
  bottom: Rgb
  horizon: Rgb
  horizonAmount: number
  sun: { x: number; y: number; visible: number; color: Rgb }
  moon: { x: number; y: number; visible: number; phase: number; color: Rgb }
  stars: number
  cloudCover: number
  cloudLit: Rgb
  cloudShade: Rgb
  cloudSpeed: number
  fog: number
  fogColor: Rgb
  rain: number
  snow: number
  /** Hail falls through the snow system, just fast. */
  hail: number
  /** Lightning likelihood 0..1 (0 = never). */
  storm: number
  /** Horizontal wind, -1..1; slants rain and drifts snow. */
  wind: number
  precipColor: Rgb
  /** Text on this sky should be light. */
  darkSky: boolean
}

type Palette = {
  top: string
  bottom: string
  horizon?: string
  horizonAmount?: number
  cloudLit: string
  cloudShade: string
}

const PALETTES: Record<SkyFamily, Record<SkyPhase, Palette>> = {
  clear: {
    day: { top: '#8fb4cf', bottom: '#efe6d5', horizon: '#f3dcbc', horizonAmount: 0.18, cloudLit: '#fbf8f1', cloudShade: '#cfd4d8' },
    dawn: { top: '#8592b3', bottom: '#f0c4a3', horizon: '#f5b48c', horizonAmount: 0.55, cloudLit: '#f7dcc8', cloudShade: '#a9a3b3' },
    dusk: { top: '#5d6a93', bottom: '#e8a77f', horizon: '#ee9165', horizonAmount: 0.6, cloudLit: '#f2c1a0', cloudShade: '#8a7f95' },
    night: { top: '#0d1730', bottom: '#27324e', horizon: '#3a4a6c', horizonAmount: 0.22, cloudLit: '#3d4862', cloudShade: '#1c2336' },
  },
  cloudy: {
    day: { top: '#9db5c8', bottom: '#ebe6dc', horizon: '#efe2cc', horizonAmount: 0.12, cloudLit: '#f8f6f1', cloudShade: '#b6bdc4' },
    dawn: { top: '#8c96b0', bottom: '#e8c5ab', horizon: '#eeb792', horizonAmount: 0.42, cloudLit: '#f1d6c4', cloudShade: '#9d99a8' },
    dusk: { top: '#67708f', bottom: '#dca889', horizon: '#e3966e', horizonAmount: 0.45, cloudLit: '#e7bda2', cloudShade: '#7c7488' },
    night: { top: '#111a2c', bottom: '#2b3447', horizon: '#39445c', horizonAmount: 0.15, cloudLit: '#4a5367', cloudShade: '#1e2432' },
  },
  overcast: {
    day: { top: '#a7aeb5', bottom: '#d9d7d1', cloudLit: '#e3e2dd', cloudShade: '#9ca1a7' },
    dawn: { top: '#9a9eab', bottom: '#d8c7ba', horizon: '#dcb49c', horizonAmount: 0.25, cloudLit: '#ddd4cc', cloudShade: '#94939c' },
    dusk: { top: '#7f8293', bottom: '#cdb2a2', horizon: '#d49f86', horizonAmount: 0.28, cloudLit: '#cfc0b5', cloudShade: '#7b7985' },
    night: { top: '#191e27', bottom: '#2f343d', cloudLit: '#444a54', cloudShade: '#22262e' },
  },
  fog: {
    day: { top: '#c7c7c2', bottom: '#e6e3dc', cloudLit: '#eceae5', cloudShade: '#bdbdb8' },
    dawn: { top: '#bdb9b8', bottom: '#e5d6c9', horizon: '#e8c6ad', horizonAmount: 0.2, cloudLit: '#e9dfd6', cloudShade: '#b5aeab' },
    dusk: { top: '#a7a2a6', bottom: '#dac6b8', horizon: '#dfb39a', horizonAmount: 0.22, cloudLit: '#ddcfc5', cloudShade: '#a19a9c' },
    night: { top: '#1f2229', bottom: '#393c43', cloudLit: '#4b4f57', cloudShade: '#2a2d34' },
  },
  rain: {
    day: { top: '#6e7c8a', bottom: '#b2b8bc', cloudLit: '#a6aeb5', cloudShade: '#5d6771' },
    dawn: { top: '#6b7188', bottom: '#b8aaa6', horizon: '#c29a88', horizonAmount: 0.2, cloudLit: '#a39fa6', cloudShade: '#5b5c6c' },
    dusk: { top: '#555b75', bottom: '#a8958d', horizon: '#b98a74', horizonAmount: 0.22, cloudLit: '#918a93', cloudShade: '#484a5c' },
    night: { top: '#111722', bottom: '#262e38', cloudLit: '#39424f', cloudShade: '#161b24' },
  },
  storm: {
    day: { top: '#323946', bottom: '#5d626a', cloudLit: '#727985', cloudShade: '#222732' },
    dawn: { top: '#343447', bottom: '#655c62', horizon: '#8a6a60', horizonAmount: 0.2, cloudLit: '#6f6a78', cloudShade: '#252433' },
    dusk: { top: '#2c2c40', bottom: '#5a4e56', horizon: '#83604f', horizonAmount: 0.22, cloudLit: '#645d6d', cloudShade: '#20202e' },
    night: { top: '#090d14', bottom: '#1d222b', cloudLit: '#2d3440', cloudShade: '#0e1219' },
  },
  snow: {
    day: { top: '#93a4b5', bottom: '#d3d9df', cloudLit: '#cfd6dd', cloudShade: '#8f9bab' },
    dawn: { top: '#aab0c6', bottom: '#ead8d1', horizon: '#e9c4b6', horizonAmount: 0.25, cloudLit: '#efe4e2', cloudShade: '#b3b3c3' },
    dusk: { top: '#8c90ab', bottom: '#dcc3bb', horizon: '#dcaa9a', horizonAmount: 0.28, cloudLit: '#ddcdcc', cloudShade: '#9696aa' },
    night: { top: '#1a2334', bottom: '#3b4759', cloudLit: '#566174', cloudShade: '#283142' },
  },
}

type Weather = {
  family: SkyFamily
  cloudCover: number
  rain?: number
  snow?: number
  hail?: number
  fog?: number
  storm?: number
  wind?: number
}

const WEATHER_BY_CODE: Record<number, Weather> = {
  0: { family: 'clear', cloudCover: 0.04 },
  1: { family: 'clear', cloudCover: 0.2 },
  2: { family: 'cloudy', cloudCover: 0.5 },
  3: { family: 'overcast', cloudCover: 0.92 },
  45: { family: 'fog', cloudCover: 0.55, fog: 0.85 },
  48: { family: 'fog', cloudCover: 0.6, fog: 0.95 },
  51: { family: 'rain', cloudCover: 0.8, rain: 0.22, wind: 0.1 },
  53: { family: 'rain', cloudCover: 0.85, rain: 0.32, wind: 0.12 },
  55: { family: 'rain', cloudCover: 0.88, rain: 0.42, wind: 0.14 },
  56: { family: 'rain', cloudCover: 0.85, rain: 0.28, snow: 0.08, wind: 0.1 },
  57: { family: 'rain', cloudCover: 0.9, rain: 0.4, snow: 0.12, wind: 0.14 },
  61: { family: 'rain', cloudCover: 0.88, rain: 0.5, wind: 0.18 },
  63: { family: 'rain', cloudCover: 0.92, rain: 0.72, wind: 0.24 },
  65: { family: 'rain', cloudCover: 0.96, rain: 1, wind: 0.34 },
  66: { family: 'rain', cloudCover: 0.9, rain: 0.55, snow: 0.12, wind: 0.2 },
  67: { family: 'rain', cloudCover: 0.95, rain: 0.9, snow: 0.18, wind: 0.3 },
  71: { family: 'snow', cloudCover: 0.8, snow: 0.45, wind: 0.08 },
  73: { family: 'snow', cloudCover: 0.88, snow: 0.72, wind: 0.12 },
  75: { family: 'snow', cloudCover: 0.95, snow: 1, wind: 0.22 },
  77: { family: 'snow', cloudCover: 0.85, snow: 0.35, wind: 0.05 },
  80: { family: 'rain', cloudCover: 0.7, rain: 0.55, wind: 0.22 },
  81: { family: 'rain', cloudCover: 0.85, rain: 0.82, wind: 0.3 },
  82: { family: 'storm', cloudCover: 0.95, rain: 1, wind: 0.42 },
  85: { family: 'snow', cloudCover: 0.75, snow: 0.6, wind: 0.14 },
  86: { family: 'snow', cloudCover: 0.9, snow: 0.95, wind: 0.24 },
  95: { family: 'storm', cloudCover: 0.95, rain: 0.8, storm: 0.7, wind: 0.36 },
  96: { family: 'storm', cloudCover: 0.97, rain: 0.8, hail: 0.3, storm: 0.8, wind: 0.4 },
  99: { family: 'storm', cloudCover: 1, rain: 0.95, hail: 0.5, storm: 1, wind: 0.48 },
}

const DEFAULT_WEATHER: Weather = { family: 'cloudy', cloudCover: 0.45 }

export const getSkyWeather = (code: number | null | undefined): Weather =>
  (typeof code === 'number' && WEATHER_BY_CODE[code]) || DEFAULT_WEATHER

/** Minutes since midnight for an Open-Meteo local time string ("2026-09-28T18:02"). */
const minutesOf = (value?: string | null) => {
  const match = value ? /T(\d{2}):(\d{2})/.exec(value) : null
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export type SkyClock = {
  /** Local time at the forecast location ("…T14:05"), or null to use `isDay`. */
  localTime?: string | null
  sunrise?: string | null
  sunset?: string | null
  isDay?: boolean | null
}

/**
 * Time of day plus the sun's progress across its arc (0 at sunrise, 1 at
 * sunset). Twilight bands give dawn and dusk their own light.
 */
export const getSkyPhase = (clock: SkyClock): { phase: SkyPhase; progress: number } => {
  const now = minutesOf(clock.localTime)
  const rise = minutesOf(clock.sunrise)
  const set = minutesOf(clock.sunset)
  if (now == null || rise == null || set == null || set <= rise) {
    return clock.isDay === false ? { phase: 'night', progress: 0.5 } : { phase: 'day', progress: 0.45 }
  }
  const progress = (now - rise) / (set - rise)
  if (now >= rise - 40 && now < rise + 50) return { phase: 'dawn', progress: Math.max(0, progress) }
  if (now >= set - 60 && now < set + 30) return { phase: 'dusk', progress: Math.min(1, progress) }
  if (now >= rise + 50 && now < set - 60) return { phase: 'day', progress }
  return { phase: 'night', progress: 0.5 }
}

/** 0 = new moon, 0.5 = full, → 1 new again. */
export const getMoonPhase = (date: Date) => {
  const SYNODIC_DAYS = 29.530588853
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86400000
  const phase = (days % SYNODIC_DAYS) / SYNODIC_DAYS
  return phase < 0 ? phase + 1 : phase
}

const luminance = ([r, g, b]: Rgb) => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// Dark theme: the sky sits on a dark dashboard, so daylight is dimmed rather
// than glowing out of it. Scaling keeps each sky's hue (a blue day reads as a
// deep blue, like early evening); mixing toward the brown desk turned every
// daytime sky to mud. Night skies are already dark.
const deepen = (color: Rgb, phase: SkyPhase, theme: SkyTheme): Rgb => {
  if (theme !== 'dark' || phase === 'night') return color
  const grey = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722
  const dimmed: Rgb = [color[0] * 0.5, color[1] * 0.5, color[2] * 0.52]
  return mixRgb(dimmed, [grey * 0.5, grey * 0.5, grey * 0.5], 0.18)
}

export type SkyInput = SkyClock & {
  code: number | null | undefined
  theme: SkyTheme
  date?: Date
}

export const buildSkyParams = ({ code, theme, date = new Date(), ...clock }: SkyInput): SkyParams => {
  const weather = getSkyWeather(code)
  const { phase, progress } = getSkyPhase(clock)
  const palette = PALETTES[weather.family][phase]
  const top = deepen(hex(palette.top), phase, theme)
  const bottom = deepen(hex(palette.bottom), phase, theme)
  const horizon = deepen(hex(palette.horizon ?? palette.bottom), phase, theme)

  // Celestial bodies stay in the right half of the card; text owns the left.
  const arc = Math.max(0, Math.min(1, progress))
  const sunX = 0.62 + 0.28 * arc
  const sunY = 0.34 + 0.44 * Math.sin(arc * Math.PI)
  const clearness = 1 - weather.cloudCover
  const night = phase === 'night'

  // The text zone (left, lower middle) decides ink vs. paper-coloured text.
  const textZone = mixRgb(bottom, top, 0.4)
  const darkSky = luminance(textZone) < 0.3

  const precipColor = weather.family === 'snow' || night || theme === 'dark' ? hex('#f4f6f8') : hex('#eef3f7')

  return {
    family: weather.family,
    phase,
    top,
    bottom,
    horizon,
    horizonAmount: palette.horizonAmount ?? 0,
    sun: {
      x: sunX,
      y: sunY,
      visible: night ? 0 : Math.max(0.08, clearness) * (theme === 'dark' ? 0.6 : 1),
      color: phase === 'day' ? hex('#fff4da') : phase === 'dawn' ? hex('#ffe0b6') : hex('#ffc896'),
    },
    moon: {
      x: 0.8,
      y: 0.74,
      visible: night ? Math.max(0.12, clearness) : 0,
      phase: getMoonPhase(date),
      color: hex('#f2ede0'),
    },
    stars: night ? clearness * clearness : 0,
    cloudCover: weather.cloudCover,
    cloudLit: deepen(hex(palette.cloudLit), phase, theme),
    cloudShade: deepen(hex(palette.cloudShade), phase, theme),
    cloudSpeed: 0.012 + (weather.wind ?? 0) * 0.05,
    fog: weather.fog ?? (weather.rain ? weather.rain * 0.25 : 0),
    fogColor: deepen(mixRgb(hex(palette.cloudLit), hex(palette.bottom), 0.5), phase, theme),
    rain: weather.rain ?? 0,
    snow: weather.snow ?? 0,
    hail: weather.hail ?? 0,
    storm: weather.storm ?? 0,
    wind: weather.wind ?? 0,
    precipColor,
    darkSky: theme === 'dark' || darkSky,
  }
}
