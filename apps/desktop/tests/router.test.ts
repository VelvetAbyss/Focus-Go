import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '@focus-go/db-contracts'
import type { AuditLogEntry } from '../electron/audit/logger'
import { createIpcRouter, registerIpcHandlers } from '../electron/ipc/router'

describe('ipc router', () => {
  it('rejects unknown channels', async () => {
    const logs: AuditLogEntry[] = []
    const router = createIpcRouter({}, { log: async (entry) => void logs.push(entry) })

    const response = await router.handle('db:unknown', {})
    expect(response.ok).toBe(false)
    if (!response.ok) {
      expect(response.error.code).toBe('CHANNEL_NOT_ALLOWED')
    }
  })

  it('validates payload with schema before calling handlers', async () => {
    const logs: AuditLogEntry[] = []
    const router = createIpcRouter(
      {
        'db:tasks:add': async () => ({ id: '1' }),
      },
      { log: async (entry) => void logs.push(entry) }
    )

    const response = await router.handle('db:tasks:add', {
      title: 'Task',
      status: 'invalid-status',
      priority: null,
    })

    expect(response.ok).toBe(false)
    if (!response.ok) {
      expect(response.error.code).toBe('INVALID_PAYLOAD')
    }
  })

  it('registers only whitelisted channels', () => {
    const registered: string[] = []
    const router = createIpcRouter({}, { log: async () => undefined })

    registerIpcHandlers(
      {
        handle(channel) {
          registered.push(channel)
        },
      },
      router
    )

    expect(registered.length).toBe(IPC_CHANNELS.length)
    expect(registered).toContain('db:tasks:list')
    expect(registered).toContain('db:dashboard:upsert')
  })
})
