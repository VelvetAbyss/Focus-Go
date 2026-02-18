import { describe, expect, it } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { createAuditLogger } from '../electron/audit/logger'

describe('audit logger', () => {
  it('writes audit entries', async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focusgo-audit-'))
    const logger = createAuditLogger({ logDir: baseDir, maxBytes: 1024 })

    await logger.log({
      timestamp: new Date().toISOString(),
      channel: 'db:tasks:list',
      ok: true,
    })

    const content = await fs.readFile(path.join(baseDir, 'audit.log'), 'utf8')
    expect(content).toContain('db:tasks:list')
  })

  it('rotates log files when size exceeds maxBytes', async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focusgo-audit-'))
    const logger = createAuditLogger({ logDir: baseDir, maxBytes: 20 })

    await logger.log({
      timestamp: new Date().toISOString(),
      channel: 'db:tasks:list',
      ok: true,
    })
    await logger.log({
      timestamp: new Date().toISOString(),
      channel: 'db:tasks:add',
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
    })

    const files = await fs.readdir(baseDir)
    const rotated = files.some((file) => file.startsWith('audit-') && file.endsWith('.log'))
    expect(rotated).toBe(true)
  })
})
