import type { AuditLogger } from '../audit/logger'

type AutoUpdaterLike = {
  on: (event: string, listener: (...args: unknown[]) => void) => unknown
  checkForUpdatesAndNotify: () => Promise<unknown>
}

export const setupAutoUpdater = async ({
  isDev,
  auditLogger,
  updater,
}: {
  isDev: boolean
  auditLogger: AuditLogger
  updater?: AutoUpdaterLike
}) => {
  if (isDev) {
    return
  }

  const activeUpdater =
    updater ??
    ((await import('electron-updater')).autoUpdater as unknown as AutoUpdaterLike)

  activeUpdater.on('update-available', () => {
    void auditLogger.log({
      timestamp: new Date().toISOString(),
      channel: 'updater:update-available',
      ok: true,
    })
  })

  activeUpdater.on('update-downloaded', () => {
    void auditLogger.log({
      timestamp: new Date().toISOString(),
      channel: 'updater:update-downloaded',
      ok: true,
    })
  })

  activeUpdater.on('error', (error) => {
    void auditLogger.log({
      timestamp: new Date().toISOString(),
      channel: 'updater:error',
      ok: false,
      errorCode: error instanceof Error ? error.message : String(error),
    })
  })

  try {
    await activeUpdater.checkForUpdatesAndNotify()
  } catch (error) {
    await auditLogger.log({
      timestamp: new Date().toISOString(),
      channel: 'updater:check',
      ok: false,
      errorCode: error instanceof Error ? error.message : String(error),
    })
  }
}
