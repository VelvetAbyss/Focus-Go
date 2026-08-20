import { getPlatform } from '../platform'
import { isLocalhostHost } from './env/localhost'

const PROD_PROXY_PREFIX = '/api'
const LOCAL_DEV_API_BASE = 'http://localhost:3000'

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
const isAuthzFailure = (status: number) => status === 401 || status === 403
const isAdminPath = (path: string) => {
  const normalized = normalizePath(path)
  return normalized === '/admin' || normalized.startsWith('/admin/') || normalized === '/api/admin' || normalized.startsWith('/api/admin/')
}

const getLocalAdminFallbackUrl = (path: string) => {
  if (typeof window === 'undefined') return null
  if (!isLocalhostHost(window.location.hostname)) return null
  if (!isAdminPath(path)) return null
  const configured = getConfiguredApiBase()
  if (configured.startsWith(LOCAL_DEV_API_BASE)) return null
  return `${LOCAL_DEV_API_BASE}${normalizePath(path)}`
}

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
  const localAdminFallbackUrl = getLocalAdminFallbackUrl(path)
  if (localAdminFallbackUrl && localAdminFallbackUrl !== primaryUrl && isAuthzFailure(response.status)) {
    return fetch(localAdminFallbackUrl, requestInit)
  }
  if (!isProxyFailure(response.status) || getApiBase() !== PROD_PROXY_PREFIX) return response
  const fallbackUrl = getDirectApiUrl(path)
  if (!fallbackUrl || fallbackUrl === primaryUrl) return response
  return fetch(fallbackUrl, requestInit)
}
