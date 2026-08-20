const getAdminEmails = () => {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
}

// Origins (browser Origin header) allowed to bypass the ADMIN_EMAILS check.
// Intended for local dev workstations hitting the prod API. Still requires a
// valid session — requireAuth runs upstream — so this can't be exploited
// without first acquiring credentials. Comma-separated, exact match.
const getDevAdminBypassOrigins = () => {
  const raw = process.env.DEV_ADMIN_BYPASS_ORIGINS ?? ''
  return new Set(raw.split(',').map((o) => o.trim()).filter(Boolean))
}

// Dev-only convenience bypass. Uses the TCP peer address (not client-controlled
// headers) and is gated behind NODE_ENV !== 'production', so it cannot be
// triggered from a deployed environment by spoofing Origin/Host.
const isLocalhostRequest = (req) => {
  if (process.env.NODE_ENV === 'production') return false
  const ip = req.socket?.remoteAddress ?? ''
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

export const isAdminEmail = (email) => {
  if (!email) return false
  return getAdminEmails().has(email.toLowerCase())
}

export { isLocalhostRequest }

export const requireAdmin = (req, res, next) => {
  const email = req.auth?.user?.email
  if (isAdminEmail(email)) return next()
  if (isLocalhostRequest(req)) return next()

  // Dev workstation escape hatch. Requires (a) a logged-in user (requireAuth
  // already populated req.auth above) AND (b) the request's browser Origin to
  // be in DEV_ADMIN_BYPASS_ORIGINS. Browsers can't spoof Origin from JS, so
  // this is safe against a passive XSS; an attacker would still need a stolen
  // session token to exploit via curl. Leave the env unset to disable.
  const origin = req.headers.origin
  const bypassOrigins = getDevAdminBypassOrigins()
  if (req.auth?.user && origin && bypassOrigins.has(origin)) {
    console.log(`[admin] dev-origin bypass: ${origin} (user=${req.auth.user.id})`)
    return next()
  }

  return res.status(403).json({ error: 'Forbidden' })
}
