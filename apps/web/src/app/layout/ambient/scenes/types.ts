export type SceneTheme = 'light' | 'dark'

export type SceneStrategy = {
  init(canvas: HTMLCanvasElement, theme: SceneTheme): void
  tick(dtMs: number): void
  cleanup(): void
  particleCount(): number
}

export type SceneId =
  | 'idle'
  | 'rainy-cafe'
  | 'stormy-night'
  | 'ocean-breeze'
  | 'cozy-fireside'
