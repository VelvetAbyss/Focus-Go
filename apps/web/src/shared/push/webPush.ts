import { getAuth } from '../../store/auth'
import { fetchApi } from '../apiBase'

/**
 * Web Push for task reminders: lets the server remind you while every tab is closed.
 * The service worker side is public/push-sw.js; the server side is focus-go-api/push.
 *
 * Per device and opt-in. Only builds with a service worker can do it (the web app, installed or
 * not); elsewhere `isWebPushSupported` is false and Settings says so.
 */

const ENABLED_KEY = 'focusgo.push.enabled.v1'
const FIRED_DB = 'focusgo-push'
const FIRED_STORE = 'fired'

export type WebPushSettings = { leadMinutes: number; language: string }
export type EnableWebPushResult = 'on' | 'denied' | 'unavailable' | 'signed-out' | 'failed' | 'update-needed'

export const isWebPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export const readWebPushEnabled = () => {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

const writeWebPushEnabled = (enabled: boolean) => {
  try {
    if (enabled) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    // Without storage the switch simply doesn't persist.
  }
}

// getRegistration, not `ready`: `ready` never settles where no service worker is registered (dev).
const getRegistration = async () => {
  if (!isWebPushSupported()) return null
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    return null
  }
}

/**
 * Whether the active service worker handles pushes. After a deploy the previous worker stays in
 * charge until every tab of the app is closed; a push sent to it would only produce the browser's
 * generic "site updated in the background" notice.
 */
export const activeWorkerHandlesPush = (registration: ServiceWorkerRegistration, timeoutMs = 1500) =>
  new Promise<boolean>((resolve) => {
    const worker = registration.active
    if (!worker) {
      resolve(false)
      return
    }
    const channel = new MessageChannel()
    const timer = setTimeout(() => resolve(false), timeoutMs)
    channel.port1.onmessage = (event) => {
      clearTimeout(timer)
      resolve((event.data as { type?: string } | null)?.type === 'focusgo:push-pong')
    }
    worker.postMessage({ type: 'focusgo:push-ping' }, [channel.port2])
  })

const authHeaders = () => {
  const token = getAuth()?.accessToken
  return typeof token === 'string' && token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
}

export const fetchWebPushConfig = async (): Promise<{ enabled: boolean; publicKey: string | null }> => {
  try {
    const response = await fetchApi('/push/config')
    if (!response.ok) return { enabled: false, publicKey: null }
    const body = (await response.json()) as { enabled?: boolean; publicKey?: string | null }
    return { enabled: body.enabled === true && typeof body.publicKey === 'string', publicKey: body.publicKey ?? null }
  } catch {
    return { enabled: false, publicKey: null }
  }
}

export const urlBase64ToUint8Array = (value: string) => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

const sameServerKey = (subscription: PushSubscription, publicKey: string) => {
  const current = subscription.options?.applicationServerKey
  if (!current) return false
  const expected = urlBase64ToUint8Array(publicKey)
  const actual = new Uint8Array(current)
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index])
}

const registerWithServer = async (subscription: PushSubscription, settings: WebPushSettings) => {
  const headers = authHeaders()
  if (!headers) throw new Error('signed-out')
  const response = await fetchApi('/push/subscriptions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      leadMinutes: settings.leadMinutes,
      language: settings.language === 'en' ? 'en' : 'zh',
    }),
  })
  if (!response.ok) throw new Error(`push-register-${response.status}`)
}

const ensureSubscription = async (registration: ServiceWorkerRegistration, publicKey: string) => {
  let subscription = await registration.pushManager.getSubscription()
  // Made for another server key (keys rotated): it can't receive our pushes any more.
  if (subscription && !sameServerKey(subscription, publicKey)) {
    await subscription.unsubscribe().catch(() => false)
    subscription = null
  }
  return subscription ?? registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
}

/** Turns push on for this device: asks for notification permission, subscribes, tells the server. */
export const enableWebPush = async (settings: WebPushSettings): Promise<EnableWebPushResult> => {
  if (!authHeaders()) return 'signed-out'
  const registration = await getRegistration()
  const config = await fetchWebPushConfig()
  if (!registration || !config.enabled || !config.publicKey) return 'unavailable'
  if (!(await activeWorkerHandlesPush(registration))) return 'update-needed'
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  try {
    await registerWithServer(await ensureSubscription(registration, config.publicKey), settings)
  } catch (error) {
    console.error('[webPush] enable failed', error)
    return 'failed'
  }
  writeWebPushEnabled(true)
  return 'on'
}

/**
 * Drops the browser's subscription. That alone stops pushes: the server forgets an endpoint the
 * push service answers 410 for. Works without a session (sign-out has already cleared it).
 */
const dropBrowserSubscription = async () => {
  const subscription = await (await getRegistration())?.pushManager.getSubscription()
  if (!subscription) return null
  const endpoint = subscription.endpoint
  await subscription.unsubscribe().catch(() => false)
  return endpoint
}

export const disableWebPush = async () => {
  writeWebPushEnabled(false)
  const headers = authHeaders()
  const endpoint = await dropBrowserSubscription()
  if (!endpoint || !headers) return
  try {
    await fetchApi('/push/subscriptions', { method: 'DELETE', headers, body: JSON.stringify({ endpoint }) })
  } catch {
    // The 410 path cleans up on the server's next send.
  }
}

/** On sign-out: this device must stop receiving the previous account's reminders. */
export const forgetWebPushOnSignOut = async () => {
  if (!readWebPushEnabled()) return
  writeWebPushEnabled(false)
  await dropBrowserSubscription()
}

/** Re-sends this device's subscription with current settings (lead time, language, account). */
export const refreshWebPushRegistration = async (settings: WebPushSettings) => {
  if (!readWebPushEnabled() || !authHeaders()) return
  const registration = await getRegistration()
  const config = await fetchWebPushConfig()
  if (!registration || !config.enabled || !config.publicKey) return
  // Permission revoked in the browser's settings: push is off, whatever the switch said.
  if (Notification.permission !== 'granted') {
    writeWebPushEnabled(false)
    return
  }
  try {
    await registerWithServer(await ensureSubscription(registration, config.publicKey), settings)
  } catch (error) {
    console.warn('[webPush] refresh failed', error)
  }
}

/** Asks the server to push a test notification to this device. */
export const sendWebPushTest = async () => {
  const headers = authHeaders()
  const subscription = await (await getRegistration())?.pushManager.getSubscription()
  if (!headers || !subscription) return false
  try {
    const response = await fetchApi('/push/test', { method: 'POST', headers, body: JSON.stringify({ endpoint: subscription.endpoint }) })
    return response.ok
  } catch {
    return false
  }
}

export type PushFiredReminder = { taskId: string; reminderAt: number; firedAt: number }

/**
 * Reminders the service worker showed while the app was closed, so the app marks them fired
 * instead of showing them again. Reading clears them.
 */
export const takePushFiredReminders = async (): Promise<PushFiredReminder[]> => {
  if (typeof indexedDB === 'undefined') return []
  try {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(FIRED_DB, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(FIRED_STORE, { keyPath: 'key' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const items = await new Promise<PushFiredReminder[]>((resolve, reject) => {
      const tx = database.transaction(FIRED_STORE, 'readwrite')
      const store = tx.objectStore(FIRED_STORE)
      const request = store.getAll()
      request.onsuccess = () => {
        store.clear()
        resolve((request.result as PushFiredReminder[]).filter((item) => typeof item?.taskId === 'string' && typeof item.reminderAt === 'number'))
      }
      request.onerror = () => reject(request.error)
    })
    database.close()
    return items
  } catch {
    return []
  }
}
