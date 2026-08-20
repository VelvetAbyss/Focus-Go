import { createAvatar } from '@dicebear/core'
import { initials } from '@dicebear/collection'

const cache = new Map<string, string>()

// Curated warm palette aligned with the app's beige/clay aesthetic.
const BACKGROUND_COLORS = [
  'b07830', // clay
  '8b5e34', // brown
  '4f746c', // teal
  '0d7a54', // emerald
  '3d7a4e', // pine
  'b97a55', // terracotta
  '6b5d8a', // muted violet
  '4a6b8a', // steel blue
]

export type DiceBearOptions = {
  seed: string
  /** Two-letter display override (defaults to derived from seed). */
  initialsText?: string
}

/**
 * Generates a DiceBear "initials" SVG and returns it as a data URL. Pure client-
 * side, deterministic, cached per seed. Used as the fallback avatar for any
 * entity that hasn't uploaded an image.
 */
export const generateDicebearAvatar = ({ seed, initialsText }: DiceBearOptions): string => {
  const cacheKey = initialsText ? `${seed}::${initialsText}` : seed
  const cached = cache.get(cacheKey)
  if (cached) return cached
  const avatar = createAvatar(initials, {
    seed: initialsText ?? seed,
    backgroundColor: BACKGROUND_COLORS,
    fontFamily: ['Inter', 'system-ui', 'sans-serif'],
    fontWeight: 600,
    fontSize: 42,
  })
  const dataUri = avatar.toDataUri()
  cache.set(cacheKey, dataUri)
  return dataUri
}

/**
 * Extract up to 2 initials from a display name. Handles Chinese (single char)
 * and Latin (first letter of each word).
 */
export const initialsFromName = (name: string | undefined | null): string => {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // Chinese / CJK: take last 2 chars (family + given name feel)
  if (/[一-龥]/.test(trimmed)) {
    return trimmed.slice(-2)
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
