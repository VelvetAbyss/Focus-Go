export type TrainPalette = 'sunset' | 'morning' | 'night'
export type SpringPalette = 'day' | 'dusk' | 'night'

export const TRAIN_DEFAULTS = {
  speed: .65, billow: 65, detail: 75, steam: 100,
  trainScale: 100, width: 100, height: 80, opacity: 84,
  railOffset: 0, cloudLevel: 65, sceneX: 0, sceneY: 0, sceneHeight: 80,
}
export type TrainSettings = typeof TRAIN_DEFAULTS
export type TrainSetting = keyof TrainSettings
export const TRAIN_RANGES: Record<TrainSetting, { min: number; max: number; step: number }> = {
  speed: { min: 0, max: 1.6, step: .05 },
  billow: { min: 0, max: 100, step: 1 },
  detail: { min: 0, max: 100, step: 1 },
  steam: { min: 0, max: 150, step: 5 },
  trainScale: { min: 65, max: 170, step: 5 },
  width: { min: 10, max: 150, step: 1 },
  height: { min: 80, max: 240, step: 4 },
  opacity: { min: 20, max: 100, step: 1 },
  railOffset: { min: -12, max: 12, step: 1 },
  cloudLevel: { min: 0, max: 100, step: 1 },
  sceneX: { min: -40, max: 40, step: 1 },
  sceneY: { min: -50, max: 50, step: 1 },
  sceneHeight: { min: 32, max: 320, step: 1 },
}
export const SPRING_NUMERIC_DEFAULTS = {
  speed: .65, width: 100, height: 80, opacity: 84,
  sceneX: 0, sceneY: 0, sceneHeight: 100, zoom: 100, clouds: 65, texture: 55,
}
export type SpringNumericSetting = keyof typeof SPRING_NUMERIC_DEFAULTS
export const SPRING_RANGES = {
  speed: { min: 0, max: 1.5, step: .05 },
  width: TRAIN_RANGES.width, height: TRAIN_RANGES.height, opacity: TRAIN_RANGES.opacity,
  sceneX: TRAIN_RANGES.sceneX, sceneY: TRAIN_RANGES.sceneY, sceneHeight: TRAIN_RANGES.sceneHeight,
  zoom: { min: 75, max: 150, step: 5 }, clouds: { min: 0, max: 100, step: 5 }, texture: { min: 0, max: 100, step: 5 },
} satisfies Record<SpringNumericSetting, { min: number; max: number; step: number }>
export type SpringSettings = typeof SPRING_NUMERIC_DEFAULTS & {
  palette: SpringPalette | 'auto'; paused: boolean; plane: boolean; sceneAnchor: 'top' | 'bottom'
}
export const SPRING_DEFAULTS: SpringSettings = {
  ...SPRING_NUMERIC_DEFAULTS, palette: 'auto', paused: false, plane: true, sceneAnchor: 'bottom',
}
export type HeaderScene = TrainSettings & {
  mode: 'cloudtrain' | 'spring' | 'desk'; palette: TrainPalette | 'auto'; paused: boolean
  sceneAnchor: 'top' | 'bottom'
  spring: SpringSettings
}
export type HeaderScenePatch = Omit<Partial<HeaderScene>, 'spring'> & { spring?: Partial<SpringSettings> }
export const DEFAULT_HEADER_SCENE: HeaderScene = {
  ...TRAIN_DEFAULTS, mode: 'cloudtrain', palette: 'auto', paused: false, sceneAnchor: 'bottom',
  spring: { ...SPRING_DEFAULTS },
}

function normalizeSpring(value: unknown): SpringSettings {
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const spring = { ...SPRING_DEFAULTS }
  for (const key of Object.keys(SPRING_RANGES) as SpringNumericSetting[]) {
    const number = saved[key], range = SPRING_RANGES[key]
    if (typeof number === 'number' && Number.isFinite(number)) spring[key] = Math.min(range.max, Math.max(range.min, number))
  }
  if (saved.palette === 'day' || saved.palette === 'dusk' || saved.palette === 'night') spring.palette = saved.palette
  spring.paused = saved.paused === true
  spring.plane = saved.plane !== false
  spring.sceneAnchor = saved.sceneAnchor === 'top' ? 'top' : 'bottom'
  return spring
}

/** Older saved scenes acquire new defaults; untrusted storage cannot resize without bounds. */
export function normalizeHeaderScene(value: unknown): HeaderScene {
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const scene = { ...DEFAULT_HEADER_SCENE }
  scene.mode = saved.mode === 'desk' || saved.mode === 'spring' ? saved.mode : 'cloudtrain'
  scene.spring = normalizeSpring(saved.spring)
  if (saved.palette === 'auto' || saved.palette === 'sunset' || saved.palette === 'morning' || saved.palette === 'night') scene.palette = saved.palette
  scene.paused = saved.paused === true
  scene.sceneAnchor = saved.sceneAnchor === 'top' ? 'top' : 'bottom'
  for (const key of Object.keys(TRAIN_RANGES) as TrainSetting[]) {
    const number = saved[key], range = TRAIN_RANGES[key]
    if (typeof number === 'number' && Number.isFinite(number)) scene[key] = Math.min(range.max, Math.max(range.min, number))
  }
  // Old offsets were relative to the date area. Start the new bottom anchor
  // at its edge instead of applying an offset that could hide the whole scene.
  if (saved.sceneAnchor !== 'top' && saved.sceneAnchor !== 'bottom') scene.sceneY = 0
  return scene
}
