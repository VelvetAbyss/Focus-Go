const PROD_PROXY_PREFIX = '/api'

const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`)
const getConfiguredApiBase = () => (import.meta.env.VITE_API_BASE ?? '').trim()
const isProductionRuntime = () => import.meta.env.PROD || import.meta.env.MODE === 'production'

export const getApiBase = () => {
  const configured = getConfiguredApiBase()
  if (!configured) return ''
  if (!isProductionRuntime() || typeof window === 'undefined') return configured
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

const getDirectApiUrl = (path: string) => {
  const configured = getConfiguredApiBase()
  if (!configured || configured.startsWith('/')) return null
  return `${configured}${normalizePath(path)}`
}

export const fetchApi = async (path: string, init?: RequestInit) => {
  const primaryUrl = buildApiUrl(path)
  const response = await fetch(primaryUrl, init)
  if (response.status !== 404 || getApiBase() !== PROD_PROXY_PREFIX) return response
  const fallbackUrl = getDirectApiUrl(path)
  if (!fallbackUrl || fallbackUrl === primaryUrl) return response
  return fetch(fallbackUrl, init)
}
