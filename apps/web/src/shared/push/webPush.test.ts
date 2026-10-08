// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchApiMock = vi.fn()
let auth: Record<string, unknown> | null = null

vi.mock('../apiBase', () => ({
  fetchApi: (...args: unknown[]) => fetchApiMock(...args),
}))
vi.mock('../../store/auth', () => ({
  getAuth: () => auth,
}))

import {
  disableWebPush,
  enableWebPush,
  forgetWebPushOnSignOut,
  readWebPushEnabled,
  takePushFiredReminders,
  urlBase64ToUint8Array,
} from './webPush'

const SERVER_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const installBrowser = ({ permission = 'granted' as NotificationPermission, request = 'granted' as NotificationPermission, hasRegistration = true, handlesPush = true } = {}) => {
  const unsubscribe = vi.fn(async () => true)
  let current: PushSubscription | null = null
  const makeSubscription = (key: Uint8Array) => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
    options: { applicationServerKey: key.buffer },
    toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/device-1', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
    unsubscribe: async () => {
      current = null
      return unsubscribe()
    },
  }) as unknown as PushSubscription
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async ({ applicationServerKey }: { applicationServerKey: Uint8Array }) => {
      current = makeSubscription(applicationServerKey)
      return current
    }),
  }
  // The worker answers the page's ping only if it's a version with the push handler.
  const active = handlesPush
    ? { postMessage: (_message: unknown, [port]: MessagePort[]) => port.postMessage({ type: 'focusgo:push-pong' }) }
    : null
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn(async () => (hasRegistration ? { pushManager, active } : undefined)) },
  })
  ;(window as unknown as { PushManager: unknown }).PushManager = function PushManager() {}
  const NotificationStub = Object.assign(function Notification() {}, {
    permission,
    requestPermission: vi.fn(async () => request),
  })
  ;(window as unknown as { Notification: unknown }).Notification = NotificationStub
  vi.stubGlobal('Notification', NotificationStub)
  return { pushManager, unsubscribe, requestPermission: NotificationStub.requestPermission }
}

describe('webPush', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchApiMock.mockReset()
    auth = { accessToken: 'token-1', user: { id: 'u1' } }
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('decodes the server key', () => {
    expect(urlBase64ToUint8Array(SERVER_KEY)).toHaveLength(65)
  })

  it('subscribes and registers this device with lead time and language', async () => {
    const { pushManager } = installBrowser()
    fetchApiMock.mockImplementation(async (path: string) =>
      path === '/push/config' ? json({ enabled: true, publicKey: SERVER_KEY }) : json({ ok: true }))

    expect(await enableWebPush({ leadMinutes: 15, language: 'zh' })).toBe('on')

    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    const [path, init] = fetchApiMock.mock.calls.find(([p]) => p === '/push/subscriptions')!
    expect(path).toBe('/push/subscriptions')
    expect(init.headers.Authorization).toBe('Bearer token-1')
    expect(JSON.parse(init.body)).toMatchObject({ leadMinutes: 15, language: 'zh', subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/device-1' } })
    expect(readWebPushEnabled()).toBe(true)
  })

  it('reports why it could not turn on', async () => {
    auth = { user: { id: 'u1' } }
    installBrowser()
    expect(await enableWebPush({ leadMinutes: 10, language: 'zh' })).toBe('signed-out')

    auth = { accessToken: 'token-1' }
    installBrowser({ permission: 'default', request: 'denied' })
    fetchApiMock.mockImplementation(async () => json({ enabled: true, publicKey: SERVER_KEY }))
    expect(await enableWebPush({ leadMinutes: 10, language: 'zh' })).toBe('denied')

    installBrowser({ hasRegistration: false })
    expect(await enableWebPush({ leadMinutes: 10, language: 'zh' })).toBe('unavailable')

    // An older worker is still in charge after a deploy: don't subscribe it to pushes it can't show.
    const stale = installBrowser({ handlesPush: false })
    expect(await enableWebPush({ leadMinutes: 10, language: 'zh' })).toBe('update-needed')
    expect(stale.pushManager.subscribe).not.toHaveBeenCalled()
    expect(readWebPushEnabled()).toBe(false)
  })

  it('turning it off unsubscribes the browser and tells the server', async () => {
    const { unsubscribe } = installBrowser()
    fetchApiMock.mockImplementation(async (path: string) =>
      path === '/push/config' ? json({ enabled: true, publicKey: SERVER_KEY }) : json({ ok: true }))
    await enableWebPush({ leadMinutes: 10, language: 'en' })

    await disableWebPush()

    expect(unsubscribe).toHaveBeenCalled()
    expect(fetchApiMock).toHaveBeenCalledWith('/push/subscriptions', expect.objectContaining({ method: 'DELETE' }))
    expect(readWebPushEnabled()).toBe(false)
  })

  it('signing out drops the subscription without needing the session', async () => {
    const { unsubscribe } = installBrowser()
    fetchApiMock.mockImplementation(async (path: string) =>
      path === '/push/config' ? json({ enabled: true, publicKey: SERVER_KEY }) : json({ ok: true }))
    await enableWebPush({ leadMinutes: 10, language: 'zh' })
    fetchApiMock.mockClear()
    auth = null

    await forgetWebPushOnSignOut()

    expect(unsubscribe).toHaveBeenCalled()
    expect(fetchApiMock).not.toHaveBeenCalled()
    expect(readWebPushEnabled()).toBe(false)
  })
})

/** Runs public/push-sw.js in a stand-in service worker scope. */
const loadServiceWorker = ({ windows = [] as Array<{ focused: boolean }> } = {}) => {
  const listeners = new Map<string, (event: unknown) => void>()
  const clientsWithSpies = windows.map((client) => ({ ...client, postMessage: vi.fn(), focus: vi.fn(async () => undefined) }))
  const scope = {
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    clients: { matchAll: vi.fn(async () => clientsWithSpies), openWindow: vi.fn(async () => null) },
    registration: { showNotification: vi.fn(async () => undefined) },
  }
  const source = readFileSync(join(process.cwd(), 'public/push-sw.js'), 'utf8')
  new Function('self', 'indexedDB', source)(scope, indexedDB)
  const dispatch = async (type: string, event: Record<string, unknown>) => {
    let work: Promise<unknown> = Promise.resolve()
    listeners.get(type)!({ ...event, waitUntil: (promise: Promise<unknown>) => { work = promise } })
    await work
  }
  return { scope, clients: clientsWithSpies, dispatch }
}

const pushEvent = (data: unknown) => ({ data: { json: () => data, text: () => JSON.stringify(data) } })

describe('push service worker', () => {
  const reminder = { kind: 'task-reminder', taskId: 't1', reminderAt: new Date(2026, 9, 9, 15, 0).getTime(), title: '交周报', body: '', language: 'zh', tag: 'task-reminder-t1', url: '/tasks?task=t1' }

  it('shows a reminder as a system notification with the app\'s tag, and records it', async () => {
    const sw = loadServiceWorker()
    await dispatch(sw, 'push', pushEvent(reminder))

    expect(sw.scope.registration.showNotification).toHaveBeenCalledWith('交周报', expect.objectContaining({
      body: '15:00 的提醒',
      tag: 'task-reminder-t1',
      requireInteraction: true,
      data: { url: '/tasks?task=t1', taskId: 't1' },
    }))
    expect(await takePushFiredReminders()).toEqual([expect.objectContaining({ taskId: 't1', reminderAt: reminder.reminderAt })])
    expect(await takePushFiredReminders()).toEqual([])
  })

  it('stays quiet when the app is in front and lets the app handle it', async () => {
    const sw = loadServiceWorker({ windows: [{ focused: true }] })
    await dispatch(sw, 'push', pushEvent(reminder))
    expect(sw.scope.registration.showNotification).not.toHaveBeenCalled()
    expect(sw.clients[0].postMessage).toHaveBeenCalledWith({ type: 'focusgo:push-reminder', taskId: 't1' })
  })

  it('still notifies when the app is open but in the background', async () => {
    const sw = loadServiceWorker({ windows: [{ focused: false }] })
    await dispatch(sw, 'push', pushEvent(reminder))
    expect(sw.scope.registration.showNotification).toHaveBeenCalled()
  })

  it('answers the page\'s ping so it knows this worker handles pushes', async () => {
    const sw = loadServiceWorker()
    const port = { postMessage: vi.fn() }
    await dispatch(sw, 'message', { data: { type: 'focusgo:push-ping' }, ports: [port] })
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'focusgo:push-pong' })
  })

  it('opens the task on click: in an open window, or a new one', async () => {
    const notification = { close: vi.fn(), data: { url: '/tasks?task=t1', taskId: 't1' } }
    const withWindow = loadServiceWorker({ windows: [{ focused: false }] })
    await dispatch(withWindow, 'notificationclick', { notification })
    expect(notification.close).toHaveBeenCalled()
    expect(withWindow.clients[0].focus).toHaveBeenCalled()
    expect(withWindow.clients[0].postMessage).toHaveBeenCalledWith({ type: 'focusgo:open', url: '/tasks?task=t1', taskId: 't1' })

    const closed = loadServiceWorker()
    await dispatch(closed, 'notificationclick', { notification })
    expect(closed.scope.clients.openWindow).toHaveBeenCalledWith('/tasks?task=t1')
  })
})

const dispatch = (sw: ReturnType<typeof loadServiceWorker>, type: string, event: Record<string, unknown>) => sw.dispatch(type, event)
