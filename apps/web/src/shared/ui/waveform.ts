/**
 * A made-up waveform for the seek bar. Streams don't let us read the audio,
 * so the shape is generated from a seed (the episode id): every episode keeps
 * its own shape, and the shape is sampled along 0–1 so it stays the same
 * when the bar is resized and only the number of bars changes.
 */

const hash = (text: string) => {
  let value = 2166136261
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

/** Deterministic noise in 0–1 for an integer cell. */
const noise = (seed: number, cell: number) => {
  let value = Math.imul(seed ^ Math.imul(cell, 0x9e3779b1), 0x85ebca6b)
  value ^= value >>> 13
  value = Math.imul(value, 0xc2b2ae35)
  value ^= value >>> 16
  return (value >>> 0) / 4294967296
}

const NOISE_CELLS = 240

/** `count` bar heights in 0.15–1 for the waveform of `seed`. */
export const waveform = (seed: string, count: number): number[] => {
  const key = hash(seed)
  const phase = (n: number) => noise(key, -n - 1) * Math.PI * 2
  const [p1, p2, p3] = [phase(1), phase(2), phase(3)]
  return Array.from({ length: count }, (_, index) => {
    const t = count > 1 ? index / (count - 1) : 0
    // A slow swell, a phrase rhythm and a fast flutter, plus per-cell grain.
    const swell = 0.5 + 0.22 * Math.sin(Math.PI * 2 * 3 * t + p1) + 0.12 * Math.sin(Math.PI * 2 * 11 * t + p2)
    const flutter = 0.08 * Math.sin(Math.PI * 2 * 29 * t + p3)
    const grain = (noise(key, Math.floor(t * NOISE_CELLS)) - 0.5) * 0.5
    return Math.min(1, Math.max(0.15, swell + flutter + grain))
  })
}
