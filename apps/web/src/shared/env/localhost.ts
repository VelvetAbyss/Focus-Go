const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export const isLocalhostHost = (hostname: string | null | undefined) => LOCALHOST_HOSTS.has((hostname ?? '').toLowerCase())

export const isLocalhostRuntime = () => {
  if (typeof window === 'undefined') return false
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') return false
  return isLocalhostHost(window.location.hostname)
}
