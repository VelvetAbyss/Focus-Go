import { describe, expect, it } from 'vitest'
import { resolveShellScale } from './AppShell'

describe('browser-owned scaling', () => {
  it.each([320, 615, 767, 768, 960, 961, 1200, 1512, 1716, 1920, 2560, 3840])('does not counter-scale the browser at %ipx', width => {
    expect(resolveShellScale(width)).toBe(1)
  })
})
