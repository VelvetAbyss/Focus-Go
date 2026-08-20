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

  it('accepts netease podcast payloads', () => {
    expect(() =>
      ipcRequestSchemas['db:lifePodcasts:create'].parse({
        source: 'netease',
        sourceId: '796756498',
        collectionId: 796756498,
        name: 'Just Some Collections',
        author: '我最爱吃螺蛳粉',
        externalUrl: 'https://music.163.com/djradio?id=796756498',
        episodes: [{
          id: '2539083386',
          title: 'alice cullen 【playlist】',
          audioUrl: 'https://example.com/audio.mp3',
          externalUrl: 'https://music.163.com/program?id=2539083386',
        }],
      }),
    ).not.toThrow()
  })

  it('rejects unknown channel in whitelist guard', () => {
    expect(isWhitelistedChannel('db:tasks:list')).toBe(true)
    expect(isWhitelistedChannel('db:unknown')).toBe(false)
  })
})
