// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { clampImageWidth, ResizableImageView } from './resizableImage'

vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

describe('resizableImage', () => {
  it('clamps width to the allowed range', () => {
    expect(clampImageWidth(40, 320)).toBe(120)
    expect(clampImageWidth(180, 320)).toBe(180)
    expect(clampImageWidth(600, 320)).toBe(320)
  })

  it('updates image width when dragging the resize handle', () => {
    const updateAttributes = vi.fn()
    const node = { attrs: { src: 'data:image/png;base64,1', alt: '', title: '', width: 180 } } as unknown as Parameters<typeof ResizableImageView>[0]['node']

    render(
      <div
        ref={(node) => {
          if (node) {
            Object.defineProperty(node, 'getBoundingClientRect', {
              value: () => ({ width: 320 }),
              configurable: true,
            })
          }
        }}
      >
        <ResizableImageView
          node={node}
          selected
          updateAttributes={updateAttributes}
        />
      </div>,
    )

    fireEvent.pointerDown(screen.getByLabelText('Resize image'), { clientX: 100 })
    fireEvent.pointerMove(window, { clientX: 190 })
    fireEvent.pointerUp(window)

    expect(updateAttributes).toHaveBeenCalledWith({ width: 270 })
  })
})
