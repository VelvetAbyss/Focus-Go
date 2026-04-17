const getAdminEmails = () => {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
}

const isLocalhostRequest = (req) => {
  const origin = req.headers.origin ?? ''
  const host = req.headers.host ?? ''
  return (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1')
  )
}

export const isAdminEmail = (email) => {
  if (!email) return false
  return getAdminEmails().has(email.toLowerCase())
}

export { isLocalhostRequest }

export const requireAdmin = (req, res, next) => {
  if (isLocalhostRequest(req)) return next()
  const email = req.auth?.user?.email
  if (!isAdminEmail(email)) return res.status(403).json({ error: 'Forbidden' })
  return next()
}
