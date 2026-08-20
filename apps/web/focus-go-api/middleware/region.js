/**
 * Region backfill middleware.
 *
 * On every authenticated request, if the user's country_code is not yet
 * recorded, detect it from the client IP and persist it. Subsequent requests
 * skip detection — the stored value is the source of truth.
 *
 * This must run AFTER requireAuth so that req.auth.user is available.
 * Mount it in index.js after requireAuth or per-router as needed.
 *
 * The middleware is intentionally non-blocking: detection errors are
 * swallowed so they never disrupt the main request flow.
 */

import db from '../db/init.js'
import { detectCountryFromRequest } from '../services/region.js'

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export function backfillRegion(req, _res, next) {
  // Only run when auth middleware has already populated req.auth.user.
  const user = req.auth?.user
  if (!user || user.country_code) {
    return next()
  }

  try {
    const country = detectCountryFromRequest(req)
    if (country) {
      db.prepare('UPDATE users SET country_code = ? WHERE id = ?').run(country, user.id)
      // Mutate the in-memory user object so downstream handlers see the new value
      // without needing another DB round-trip.
      user.country_code = country
    }
  } catch (err) {
    // Non-fatal — log but never block the request.
    console.warn('[region] backfill error:', err?.message)
  }

  next()
}
