import { useSyncExternalStore } from 'react'

export const USER_PROFILE_CHANGED_EVENT = 'focusgo:user-profile-changed'
const STORAGE_KEY = 'focus_go.userProfile.v1'

export type UserProfile = {
  avatar?: string | null      // data URL
  pronouns?: string
  role?: string
  location?: string
  birthday?: string           // ISO MM-DD or YYYY-MM-DD
  bio?: string
}

type ProfileMap = Record<string, UserProfile>

const emptyProfile: UserProfile = {}

const readMap = (): ProfileMap => {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ProfileMap) : {}
  } catch {
    return {}
  }
}

const writeMap = (map: ProfileMap) => {
  if (typeof localStorage === 'undefined' || typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  window.dispatchEvent(new Event(USER_PROFILE_CHANGED_EVENT))
}

export const getProfile = (userId: string | null | undefined): UserProfile => {
  if (!userId) return emptyProfile
  const map = readMap()
  return map[userId] ?? emptyProfile
}

export const updateProfile = (userId: string, patch: Partial<UserProfile>) => {
  if (!userId) return
  const map = readMap()
  const current = map[userId] ?? {}
  const next: UserProfile = { ...current, ...patch }
  // strip empty strings to keep storage tidy
  for (const k of Object.keys(next) as (keyof UserProfile)[]) {
    if (next[k] === '' || next[k] === undefined) delete next[k]
  }
  map[userId] = next
  writeMap(map)
}

export const clearProfile = (userId: string) => {
  const map = readMap()
  delete map[userId]
  writeMap(map)
}

export const subscribeProfile = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const handle = () => listener()
  window.addEventListener(USER_PROFILE_CHANGED_EVENT, handle)
  window.addEventListener('storage', handle)
  return () => {
    window.removeEventListener(USER_PROFILE_CHANGED_EVENT, handle)
    window.removeEventListener('storage', handle)
  }
}

// Cache the last snapshot so useSyncExternalStore gets a stable reference
// when nothing changed (avoids React infinite-loop warnings).
let lastSnapshotKey = ''
let lastSnapshot: UserProfile = emptyProfile

const getSnapshot = (userId: string | null | undefined): UserProfile => {
  if (!userId) return emptyProfile
  const map = readMap()
  const profile = map[userId] ?? emptyProfile
  const key = userId + '|' + JSON.stringify(profile)
  if (key !== lastSnapshotKey) {
    lastSnapshotKey = key
    lastSnapshot = profile
  }
  return lastSnapshot
}

export const useUserProfile = (userId: string | null | undefined): UserProfile =>
  useSyncExternalStore(
    subscribeProfile,
    () => getSnapshot(userId),
    () => emptyProfile,
  )

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const AVATAR_SIZE = 256

// Read a File and return a square-cropped, downscaled JPEG data URL.
export const processAvatarFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.size > MAX_AVATAR_BYTES) {
      reject(new Error('AVATAR_TOO_LARGE'))
      return
    }
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      reject(new Error('AVATAR_BAD_TYPE'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('AVATAR_READ_FAILED'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('AVATAR_DECODE_FAILED'))
      img.onload = () => {
        const size = AVATAR_SIZE
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('AVATAR_NO_CTX'))
          return
        }
        // center-crop to square
        const minSide = Math.min(img.width, img.height)
        const sx = (img.width - minSide) / 2
        const sy = (img.height - minSide) / 2
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size)
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          resolve(dataUrl)
        } catch {
          reject(new Error('AVATAR_ENCODE_FAILED'))
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
