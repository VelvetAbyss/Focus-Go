import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS, isWhitelistedChannel, ipcRequestSchemas, ipcResponseSchemas } from '../src'

describe('IPC channel contract', () => {
  it('has request/response schema for each whitelisted channel', () => {
    for (const channel of IPC_CHANNELS) {
      expect(ipcRequestSchemas[channel]).toBeDefined()
      expect(ipcResponseSchemas[channel]).toBeDefined()
    }
  })

  it('accepts valid payload and rejects invalid payload', () => {
    expect(() => ipcRequestSchemas['db:tasks:add'].parse({ title: 'A', status: 'todo', priority: null })).not.toThrow()
    expect(() => ipcRequestSchemas['db:tasks:add'].parse({ title: 'A', status: 'invalid', priority: null })).toThrow()
  })

  it('rejects unknown channel in whitelist guard', () => {
    expect(isWhitelistedChannel('db:tasks:list')).toBe(true)
    expect(isWhitelistedChannel('db:unknown')).toBe(false)
  })
})
