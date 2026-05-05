/**
 * Region detection service.
 *
 * Determines a user's ISO 3166-1 alpha-2 country code from the incoming
 * HTTP request. Deployed on Alibaba Cloud (no Cloudflare/Vercel headers),
 * so we rely on geoip-lite with the X-Forwarded-For / X-Real-IP headers
 * that Alibaba Cloud SLB / Nginx transparently forward.
 *
 * IMPORTANT: Express must have `app.set('trust proxy', true)` set so that
 * req.ip reflects the real client IP rather than the SLB internal address.
 *
 * Region buckets:
 *   'CN'                  → China region  → Alipay (CNY)
 *   HK / MO / TW / other → Global region → PayPal (USD)
 *
 * Gating rules (enforced in routes/payments.js):
 *   - BLOCK: global user (non-CN) attempts zpay_alipay → 400 + preferredChannel
 *   - ALLOW: CN user attempts paypal_checkout → permitted (foreign card / proxy payment)
 */

import geoip from 'geoip-lite'

/**
 * Extract the client's real IP address from the request.
 * Prefers X-Forwarded-For (SLB/Nginx), then X-Real-IP, then socket address.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded && typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  const realIp = req.headers['x-real-ip']
  if (realIp && typeof realIp === 'string') return realIp.trim()
  // Express req.ip already respects `trust proxy` setting.
  if (req.ip) return req.ip
  return req.socket?.remoteAddress ?? null
}

/**
 * Look up the ISO 3166-1 alpha-2 country code for the request's client IP.
 * Returns null if detection fails (loopback, private IP, unknown, etc.).
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function detectCountryFromRequest(req) {
  const ip = getClientIp(req)
  if (!ip) return null

  // Skip private / loopback addresses — geoip has no data for these.
  if (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
  ) {
    return null
  }

  try {
    const geo = geoip.lookup(ip)
    return geo?.country ?? null
  } catch {
    return null
  }
}

/**
 * Returns true if the country code represents China (mainland).
 * HK, MO, TW are intentionally treated as global region.
 *
 * @param {string|null|undefined} countryCode
 * @returns {boolean}
 */
export function isChinaRegion(countryCode) {
  return countryCode === 'CN'
}
