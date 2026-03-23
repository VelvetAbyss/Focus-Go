import { describe, expect, it } from 'vitest'
import { resolveShellScale } from './AppShell'

describe('resolveShellScale', () => {
  it('returns 0.8 at 1512px', () => {
    expect(resolveShellScale(1512)).toBe(0.8)
  })

  it('returns 1 at 1920px', () => {
    expect(resolveShellScale(1920)).toBe(1)
  })

  it('returns linear interpolated value at midpoint', () => {
    expect(resolveShellScale(1716)).toBe(0.9)
  })

  it('clamps below lower bound', () => {
    expect(resolveShellScale(1200)).toBe(0.8)
  })

  it('clamps above upper bound', () => {
    expect(resolveShellScale(2560)).toBe(1)
  })
})
