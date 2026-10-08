/*
 * Focus&go Web Push handling. Loaded into the Workbox service worker with importScripts
 * (vite.config.ts › workbox.importScripts), so it runs even while no tab is open.
 *
 * The server sends a task reminder when it falls due. If the app is open and in front, the app
 * shows its own reminder and this stays quiet; otherwise it shows a system notification with the
 * same tag the app uses, so an app notification and a push for one reminder collapse into one.
 */

const FIRED_DB = 'focusgo-push'
const FIRED_STORE = 'fired'

const openFiredDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(FIRED_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(FIRED_STORE, { keyPath: 'key' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

// Tells the app, next time it opens on this device, that this reminder was already shown.
const recordFired = async (data) => {
  try {
    const db = await openFiredDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FIRED_STORE, 'readwrite')
      tx.objectStore(FIRED_STORE).put({
        key: `${data.taskId}:${data.reminderAt}`,
        taskId: data.taskId,
        reminderAt: data.reminderAt,
        firedAt: Date.now(),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Best effort: at worst the app shows the reminder once more when opened.
  }
}

const formatTime = (ms, language) =>
  new Date(ms).toLocaleTimeString(language === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

const fallbackBody = (data) => {
  if (data.kind !== 'task-reminder' || typeof data.reminderAt !== 'number') return ''
  const time = formatTime(data.reminderAt, data.language)
  return data.language === 'en' ? `Reminder for ${time}` : `${time} 的提醒`
}

// Lets the page check that the running worker is a version that handles pushes (an older one
// may still be active until every tab of the app has been closed once).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'focusgo:push-ping' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ type: 'focusgo:push-pong' })
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (data.kind === 'task-reminder') {
        const focused = windows.filter((client) => client.focused)
        if (focused.length > 0) {
          // The app in front shows the reminder itself; nudge it in case it hasn't synced the task yet.
          focused.forEach((client) => client.postMessage({ type: 'focusgo:push-reminder', taskId: data.taskId }))
          return
        }
        await recordFired(data)
      }
      await self.registration.showNotification(data.title || 'Focus&go', {
        body: data.body || fallbackBody(data),
        tag: data.tag || 'focusgo',
        icon: '/app-icon-1024.png',
        badge: '/favicon.ico',
        requireInteraction: data.kind === 'task-reminder',
        data: { url: data.url || '/', taskId: data.taskId || null },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url = '/', taskId = null } = event.notification.data || {}
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = windows.find((item) => 'focus' in item)
      if (client) {
        await client.focus()
        client.postMessage({ type: 'focusgo:open', url, taskId })
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
