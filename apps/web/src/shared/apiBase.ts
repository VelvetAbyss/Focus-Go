import { getPlatform } from '../platform'

const PROD_PROXY_PREFIX = '/api'

const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`)
const getConfiguredApiBase = () => (import.meta.env.VITE_API_BASE ?? '').trim()
const isProductionRuntime = () => import.meta.env.PROD || import.meta.env.MODE === 'production'

export const getApiBase = () => {
  const configured = getConfiguredApiBase()
  if (!configured) return ''
  // Desktop (Tauri) build: the webview origin is tauri://localhost with no
  // same-origin reverse proxy, so the `/api` prefix can't resolve. Always talk
  // to the configured absolute API base (set in .env.desktop) directly.
  if (getPlatform().isDesktop) return configured
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

const isProxyFailure = (status: number) => status === 404 || status >= 500

export const fetchApi = async (path: string, init?: RequestInit) => {
  const primaryUrl = buildApiUrl(path)
  const requestInit: RequestInit = { credentials: 'include', ...init }
  let response: Response
  try {
    response = await fetch(primaryUrl, requestInit)
  } catch (networkError) {
    if (getApiBase() !== PROD_PROXY_PREFIX) throw networkError
    const fallbackUrl = getDirectApiUrl(path)
    if (!fallbackUrl) throw networkError
    return fetch(fallbackUrl, requestInit)
  }
  if (!isProxyFailure(response.status) || getApiBase() !== PROD_PROXY_PREFIX) return response
  const fallbackUrl = getDirectApiUrl(path)
  if (!fallbackUrl || fallbackUrl === primaryUrl) return response
  return fetch(fallbackUrl, requestInit)
}
