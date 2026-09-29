import { describe, expect, it } from 'vitest'
import { resolveShellScale } from './AppShell'

describe('readable shell sizing', () => {
  it.each([320, 375, 768, 1200, 1512, 1716, 1920, 2560])('preserves text and control size at %d pixels', (width) => {
    expect(resolveShellScale(width)).toBe(1)
  })
})
