const getAdminEmails = () => {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
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
  if (!isAdminEmail(email)) return res.status(403).json({ error: 'Forbidden' })
  return next()
}
