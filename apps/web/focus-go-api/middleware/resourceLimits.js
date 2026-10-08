export const getClientIp = (req) => req.ip ?? req.socket?.remoteAddress ?? 'unknown'

export const createIpRateLimiter = ({ limit, windowMs, maxEntries = 10_000, now = () => Date.now() }) => {
  const buckets = new Map()
  return (req) => {
    const timestamp = now()
    const ip = getClientIp(req)
    for (const [key, entry] of buckets) if (timestamp - entry.startedAt >= windowMs) buckets.delete(key)
    let entry = buckets.get(ip)
    if (!entry) {
      if (buckets.size >= maxEntries) return false
      entry = { startedAt: timestamp, count: 0 }
      buckets.set(ip, entry)
    }
    if (entry.count >= limit) return false
    entry.count++
    return true
  }
}

export const createConcurrencyLimiter = ({ perIp = 2, total = 16 } = {}) => {
  const active = new Map()
  let count = 0
  return (req) => {
    const ip = getClientIp(req)
    const ipCount = active.get(ip) ?? 0
    if (count >= total || ipCount >= perIp) return null
    active.set(ip, ipCount + 1)
    count++
    let released = false
    return () => {
      if (released) return
      released = true
      count--
      const next = active.get(ip) - 1
      if (next === 0) active.delete(ip)
      else active.set(ip, next)
    }
  }
}
