export const APP_SURFACE = '#F5F3F0'
export const APP_INK = '#3A3733'

export const HEALTH = {
  onTrack: '#3D7A4E',
  atRisk: '#B07830',
  blocked: '#B83333',
} as const

export const STATUS = {
  todo: '#9A8F83',
  doing: '#1E5BFF',
  done: '#0D7A54',
} as const

export const PRIORITY = {
  high: '#B83333',
  medium: '#B07830',
  low: '#3D7A4E',
} as const

export const ROLE = {
  owner: '#B07830',
  collaborator: '#1E5BFF',
  reviewer: '#0D7A54',
  external: '#6B5FF5',
} as const

export const PROJECT_COLORS = [
  '#B07830',
  '#3D7A4E',
  '#1E5BFF',
  '#6B5FF5',
  '#B83333',
  '#0D7A54',
  '#8A6F45',
  '#4F746C',
] as const

export const getDeterministicProjectColor = (projectId: string) => {
  let hash = 0
  for (let index = 0; index < projectId.length; index += 1) {
    hash = (hash * 31 + projectId.charCodeAt(index)) >>> 0
  }
  return PROJECT_COLORS[hash % PROJECT_COLORS.length]
}

export const resolveProjectColor = (project: { id: string; color?: string | null }) =>
  project.color?.trim() || getDeterministicProjectColor(project.id)
