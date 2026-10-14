import { hex, type Rgb } from './surface'

/** Reads a design token from :root as display-space floats ('#rgb', '#rrggbb' or rgb()). */
export const readTokenRgb = (name: string, fallback: string): Rgb => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  if (raw.startsWith('#')) {
    const v = raw.length === 4 ? raw.slice(1).split('').map((c) => c + c).join('') : raw.slice(1, 7)
    return hex(`#${v}`)
  }
  const nums = raw.match(/[\d.]+/g)?.map(Number)
  return nums && nums.length >= 3 ? [nums[0] / 255, nums[1] / 255, nums[2] / 255] : hex(fallback)
}
