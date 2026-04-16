export const LAYOUT_LOCK_KEY = 'workbench.dashboard.layoutLocked'

export const readLayoutLocked = () => {
  if (typeof localStorage === 'undefined') return true
  const raw = localStorage.getItem(LAYOUT_LOCK_KEY)
  if (raw === null) return true
  return raw !== 'false'
}

export const writeLayoutLocked = (locked: boolean) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAYOUT_LOCK_KEY, locked ? 'true' : 'false')
}
