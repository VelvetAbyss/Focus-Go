import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin = ''
  readonly thresholds: ReadonlyArray<number> = []
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }

  disconnect(): void {}

  observe(target: Element): void {
    this.callback(
      [
        {
          isIntersecting: true,
          target,
          intersectionRatio: 1,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ],
      this,
    )
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  unobserve(): void {}
}

const installBrowserApiMocks = () => {
  globalThis.IntersectionObserver = MockIntersectionObserver

  if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
    Element.prototype.scrollTo = function scrollTo() {}
  }
}

installBrowserApiMocks()

beforeEach(() => {
  installBrowserApiMocks()
})

afterEach(() => {
  cleanup()
})
