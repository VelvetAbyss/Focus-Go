const PROD_PROXY_PREFIX = '/api'

const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`)

export const getApiBase = () => {
  const configured = (import.meta.env.VITE_API_BASE ?? '').trim()
  if (!configured) return ''
  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production'
  if (!isProduction || typeof window === 'undefined') return configured
  try {
    const url = new URL(configured)
    if (url.origin !== window.location.origin) return PROD_PROXY_PREFIX
  } catch {
    return configured
  }
  return configured
}

export const buildApiUrl = (path: string) => `${getApiBase()}${normalizePath(path)}`

export const buildAbsoluteApiUrl = (path: string) => new URL(buildApiUrl(path), window.location.origin)
