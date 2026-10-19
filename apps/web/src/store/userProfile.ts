import { useSyncExternalStore } from 'react'
import { getAuth, setAuth } from './auth'
import { fetchApi } from '../shared/apiBase'

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


// Profile is account data, separate from document sync and login credentials.
const ACCOUNT_PROFILE_KEY = 'focusgo.accountProfile.v1'
type ProfilePatch = UserProfile & { name?: string }
type AccountProfile = { id: string; name: string; image: string | null; profile: UserProfile; revision: number }
type CachedAccount = { name: string; revision: number; dirty: ProfilePatch; sequence: number }
const pendingRequests = new Map<string, Promise<void>>()
const saveStates = new Map<string, 'saved' | 'pending' | 'saving' | 'error'>()
const readAccounts = (): Record<string, CachedAccount> => {
  try { const value = JSON.parse(localStorage.getItem(ACCOUNT_PROFILE_KEY) ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} }
}
const persistAccount = (id: string, value: CachedAccount) => {
  const accounts = readAccounts(); accounts[id] = value
  localStorage.setItem(ACCOUNT_PROFILE_KEY, JSON.stringify(accounts))
}
const notifyProfile = () => window.dispatchEvent(new Event(USER_PROFILE_CHANGED_EVENT))
type ProfileSaveState = 'saved' | 'pending' | 'saving' | 'error' | 'loading'
export const profileSaveState = (id: string): ProfileSaveState => saveStates.get(id) ?? (Object.keys(readAccounts()[id]?.dirty ?? {}).length ? 'pending' : 'loading')
export const useProfileSaveState = (id: string) => useSyncExternalStore(subscribeProfile, () => profileSaveState(id), (): ProfileSaveState => 'loading')
const setSaveState = (id: string, state: 'saved' | 'pending' | 'saving' | 'error') => { saveStates.set(id, state); notifyProfile() }

export const requestAccount = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const auth = getAuth(), id = auth?.user?.id, token = auth?.accessToken
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetchApi('/user' + path, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
    if (!id || getAuth()?.user?.id !== id || getAuth()?.accessToken !== token) throw new Error('account_changed')
    const body = await response.json()
    if (getAuth()?.user?.id !== id || getAuth()?.accessToken !== token) throw new Error('account_changed')
    if (!response.ok) throw Object.assign(new Error(body.error ?? 'account_request_failed'), { status: response.status, account: body.account })
    return body as T
  } finally { window.clearTimeout(timeout) }
}

const applyAccount = (id: string, account: AccountProfile, dirty: ProfilePatch) => {
  const profile = { ...account.profile, avatar: account.image, ...dirty }
  delete (profile as ProfilePatch).name
  const map = readMap(); map[id] = profile; writeMap(map)
  const current = getAuth()
  if (current?.user?.id === id) {
    const name = dirty.name ?? account.name
    setAuth({ ...current, user: { ...current.user, name, nickname: name, image: profile.avatar } })
  }
}

/** Persist immediately. The network can fail without discarding the draft. */
export const saveAccountProfile = (id: string, patch: ProfilePatch) => {
  if (getAuth()?.user?.id !== id) throw new Error('account_changed')
  const current = readAccounts()[id] ?? { name: getAuth().user.name ?? '', revision: 0, dirty: {}, sequence: 0 }
  const next = { ...current, dirty: { ...current.dirty, ...patch }, sequence: current.sequence + 1 }
  persistAccount(id, next)
  const fields = { ...patch }; delete fields.name
  updateProfile(id, fields)
  if (patch.name) { const auth = getAuth(); setAuth({ ...auth, user: { ...auth.user, name: patch.name, nickname: patch.name } }) }
  setSaveState(id, 'pending')
  void syncAccountProfile(id)
}

export const syncAccountProfile = (id: string): Promise<void> => {
  if (pendingRequests.has(id)) return pendingRequests.get(id)!
  const task = (async () => {
    if (getAuth()?.user?.id !== id) return
    try {
      setSaveState(id, 'saving')
      for (let retry = 0; retry < 3; retry++) {
        const { account } = await requestAccount<{ account?: AccountProfile }>('/profile')
        if (!account || account.id !== id) throw new Error('profile_service_unavailable')
        let cached = readAccounts()[id]
        if (!cached) {
          // Adopt legacy local metadata only when this account has no cloud
          // profile yet. Never replace another device's existing cloud profile.
          const legacy = account.revision === 0 ? getProfile(id) : {}
          cached = { name: account.name, revision: account.revision, dirty: { ...legacy }, sequence: 0 }
          persistAccount(id, cached)
        }
        applyAccount(id, account, cached.dirty)
        if (!Object.keys(cached.dirty).length) {
          persistAccount(id, { ...cached, name: account.name, revision: account.revision })
          setSaveState(id, 'saved'); return
        }
        const sent = { ...cached.dirty }, sequence = cached.sequence
        let confirmed: AccountProfile
        try {
          confirmed = (await requestAccount<{ account: AccountProfile }>('/profile', { method: 'PATCH', body: JSON.stringify({ revision: account.revision, patch: sent }) })).account
        } catch (error) {
          if ((error as { status?: number }).status === 409) continue
          throw error
        }
        const latest = readAccounts()[id] ?? cached
        const dirty = latest.sequence === sequence ? {} : { ...latest.dirty }
        for (const key of Object.keys(sent) as (keyof ProfilePatch)[]) if (dirty[key] === sent[key]) delete dirty[key]
        persistAccount(id, { ...latest, name: confirmed.name, revision: confirmed.revision, dirty })
        applyAccount(id, confirmed, dirty)
        if (!Object.keys(dirty).length) { setSaveState(id, 'saved'); return }
      }
      setSaveState(id, 'pending')
    } catch {
      if (getAuth()?.user?.id === id) setSaveState(id, navigator.onLine === false ? 'pending' : 'error')
    }
  })().finally(() => { pendingRequests.delete(id) })
  pendingRequests.set(id, task)
  return task
}

export const clearAccountProfile = (id: string) => {
  const accounts = readAccounts(); delete accounts[id]
  localStorage.setItem(ACCOUNT_PROFILE_KEY, JSON.stringify(accounts))
  clearProfile(id)
  saveStates.delete(id)
}

export const startAccountProfileSync = (id: string) => {
  const refresh = () => { void syncAccountProfile(id) }
  refresh()
  window.addEventListener('online', refresh)
  window.addEventListener('focus', refresh)
  const timer = window.setInterval(refresh, 60_000)
  return () => { clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh) }
}
