import { promises as fs } from 'node:fs'
import path from 'node:path'

export type AuditLogEntry = {
  timestamp: string
  channel: string
  ok: boolean
  errorCode?: string
}

export type AuditLogger = {
  log: (entry: AuditLogEntry) => Promise<void>
}

export const createAuditLogger = ({
  logDir,
  fileName = 'audit.log',
  maxBytes = 1_000_000,
}: {
  logDir: string
  fileName?: string
  maxBytes?: number
}): AuditLogger => {
  const filePath = path.join(logDir, fileName)

  const rotateIfNeeded = async () => {
    try {
      const stats = await fs.stat(filePath)
      if (stats.size < maxBytes) return
      const rotatedPath = path.join(logDir, `audit-${Date.now()}.log`)
      await fs.rename(filePath, rotatedPath)
    } catch {
      // No-op when log file does not exist yet.
    }
  }

  return {
    async log(entry) {
      await fs.mkdir(logDir, { recursive: true })
      await rotateIfNeeded()
      await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
    },
  }
}
