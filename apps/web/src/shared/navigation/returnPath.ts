import { buildNoteDetailRoute, buildTaskDetailRoute } from '../../app/routes/routes'

const readSafeReturnUrl = (search: string): URL | null => {
  const candidate = new URLSearchParams(search).get('from')
  if (!candidate || candidate.length > 2048 || !candidate.startsWith('/') || candidate.startsWith('//') || /[\\\r\n#]/.test(candidate)) return null
  try {
    const url = new URL(candidate, 'https://focusgo.local')
    if (url.origin !== 'https://focusgo.local') return null
    return url
  } catch {
    return null
  }
}

/** Only routes that can restore their selected object are valid return targets. */
export const readReturnPath = (search: string): string | null => {
  const url = readSafeReturnUrl(search)
  if (!url || (url.pathname !== '/tasks' && !/^\/projects\/[^/]+$/.test(url.pathname))) return null
  return `${url.pathname}${url.search}`
}

export const readNoteReturnPath = (search: string): string | null => {
  const url = readSafeReturnUrl(search)
  if (!url || url.pathname !== '/note' || !url.searchParams.get('note')) return null
  return `${url.pathname}${url.search}`
}

export const withReturnPath = (target: string, from: string): string => {
  const separator = target.includes('?') ? '&' : '?'
  return `${target}${separator}from=${encodeURIComponent(from)}`
}

export const buildNoteRouteWithReturn = (noteId: string, from: string): string =>
  withReturnPath(buildNoteDetailRoute(noteId), from)

export const withTaskContext = (from: string, taskId: string): string => {
  const url = new URL(from, 'https://focusgo.local')
  if (url.pathname !== '/tasks' && !/^\/projects\/[^/]+$/.test(url.pathname)) return buildTaskDetailRoute(taskId)
  url.searchParams.set('task', taskId)
  return `${url.pathname}${url.search}`
}
