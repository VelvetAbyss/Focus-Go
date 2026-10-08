import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import webpush from 'web-push'

const DEFAULT_KEY_FILE = join(dirname(fileURLToPath(import.meta.url)), '../data/vapid-keys.json')
const DEFAULT_SUBJECT = 'mailto:support@nestflow.art'

/**
 * VAPID keys identify this server to the browsers' push services. Taken from the environment when
 * set; otherwise kept in the (gitignored, persistent) data dir and generated on first start, so a
 * deploy that forgot the env vars doesn't silently orphan every subscription with new keys.
 */
export const resolveVapidConfig = ({ env = process.env, keyFile = DEFAULT_KEY_FILE } = {}) => {
  const subject = env.VAPID_SUBJECT?.trim() || DEFAULT_SUBJECT
  if (env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim()) {
    return { publicKey: env.VAPID_PUBLIC_KEY.trim(), privateKey: env.VAPID_PRIVATE_KEY.trim(), subject }
  }
  if (env.NODE_ENV === 'test') return { ...webpush.generateVAPIDKeys(), subject }
  if (existsSync(keyFile)) {
    const stored = JSON.parse(readFileSync(keyFile, 'utf8'))
    if (stored?.publicKey && stored?.privateKey) return { publicKey: stored.publicKey, privateKey: stored.privateKey, subject }
  }
  const keys = webpush.generateVAPIDKeys()
  mkdirSync(dirname(keyFile), { recursive: true })
  writeFileSync(keyFile, JSON.stringify(keys, null, 2), { mode: 0o600 })
  chmodSync(keyFile, 0o600)
  console.log(`[push] generated VAPID keys at ${keyFile}`)
  return { ...keys, subject }
}

// The server POSTs to whatever endpoint a client registers, so only real push services are
// accepted; anything else (internal addresses, metadata endpoints) would be an SSRF hole.
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]
const PUSH_SERVICE_SUFFIXES = ['.push.services.mozilla.com', '.notify.windows.com', '.push.apple.com']

export const isAllowedPushEndpoint = (value) => {
  if (typeof value !== 'string' || value.length > 1024) return false
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  return PUSH_SERVICE_HOSTS.includes(host) || PUSH_SERVICE_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

/** Validates a PushSubscription JSON plus our per-device settings; returns null when unusable. */
export const parseSubscriptionBody = (body, { isAllowedEndpoint = isAllowedPushEndpoint } = {}) => {
  const endpoint = body?.subscription?.endpoint
  const p256dh = body?.subscription?.keys?.p256dh
  const auth = body?.subscription?.keys?.auth
  if (!isAllowedEndpoint(endpoint)) return null
  if (typeof p256dh !== 'string' || !BASE64URL.test(p256dh) || p256dh.length < 80 || p256dh.length > 100) return null
  if (typeof auth !== 'string' || !BASE64URL.test(auth) || auth.length < 16 || auth.length > 32) return null
  const lead = Number(body?.leadMinutes)
  return {
    endpoint,
    keys: { p256dh, auth },
    leadMinutes: Number.isFinite(lead) ? Math.min(Math.max(Math.round(lead), 1), 1440) : 10,
    language: body?.language === 'en' ? 'en' : 'zh',
  }
}
