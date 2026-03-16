import { describe, expect, it } from 'vitest'
import { resolveTasksViewportProfile } from './tasksViewport'

describe('resolveTasksViewportProfile', () => {
  it('marks short ultrawide viewports as compact ultrawide', () => {
    expect(resolveTasksViewportProfile({ width: 1728, height: 864 })).toEqual({
      heightBand: 'compact',
      ratioBand: 'ultrawide',
      viewportHeight: 864,
    })
  })

  it('marks balanced laptop viewports as regular', () => {
    expect(resolveTasksViewportProfile({ width: 1440, height: 1024 })).toEqual({
      heightBand: 'regular',
      ratioBand: 'regular',
      viewportHeight: 1024,
    })
  })

  it('marks tall narrow viewports as tall standard', () => {
    expect(resolveTasksViewportProfile({ width: 900, height: 1360 })).toEqual({
      heightBand: 'tall',
      ratioBand: 'regular',
      viewportHeight: 1360,
    })
  })
})
