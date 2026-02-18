import { describe, expect, it, vi } from 'vitest'
import { setupAutoUpdater } from '../electron/updater/autoUpdater'

describe('setupAutoUpdater', () => {
  it('skips update checks in dev mode', async () => {
    const checkForUpdatesAndNotify = vi.fn().mockResolvedValue(undefined)
    const on = vi.fn()
    const log = vi.fn().mockResolvedValue(undefined)

    await setupAutoUpdater({
      isDev: true,
      auditLogger: { log },
      updater: { on, checkForUpdatesAndNotify },
    })

    expect(checkForUpdatesAndNotify).not.toHaveBeenCalled()
  })

  it('runs update checks outside dev mode', async () => {
    const checkForUpdatesAndNotify = vi.fn().mockResolvedValue(undefined)
    const on = vi.fn()

    await setupAutoUpdater({
      isDev: false,
      auditLogger: { log: async () => undefined },
      updater: { on, checkForUpdatesAndNotify },
    })

    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(1)
  })
})
