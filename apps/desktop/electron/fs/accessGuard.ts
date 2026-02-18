import path from 'node:path'

const normalizeAbsolutePath = (filePath: string): string => path.resolve(filePath)

const isWithinDir = (baseDir: string, targetPath: string): boolean => {
  const relative = path.relative(baseDir, targetPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export type FileAccessGuard = {
  allowUserSelectedPath: (filePath: string) => void
  canReadPath: (filePath: string) => boolean
  clearSelections: () => void
}

export const createFileAccessGuard = (appDataDir: string): FileAccessGuard => {
  const selected = new Set<string>()
  const normalizedAppDataDir = normalizeAbsolutePath(appDataDir)

  return {
    allowUserSelectedPath(filePath: string) {
      selected.add(normalizeAbsolutePath(filePath))
    },
    canReadPath(filePath: string) {
      const normalizedPath = normalizeAbsolutePath(filePath)
      return isWithinDir(normalizedAppDataDir, normalizedPath) || selected.has(normalizedPath)
    },
    clearSelections() {
      selected.clear()
    },
  }
}
