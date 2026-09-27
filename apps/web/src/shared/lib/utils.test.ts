import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('treats the type scale as font sizes, not colors', () => {
    expect(cn('text-primary-foreground', 'text-meta')).toBe('text-primary-foreground text-meta')
    expect(cn('text-ink-3 text-label', 'text-ui')).toBe('text-ink-3 text-ui')
  })

  it('still resolves real conflicts', () => {
    expect(cn('text-ink-2', 'text-ink-3')).toBe('text-ink-3')
    expect(cn('rounded-md', 'rounded-pill')).toBe('rounded-pill')
  })
})
