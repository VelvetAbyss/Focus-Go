// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampImageWidth, clampImageWidthPercent, ResizableImageView } from './resizableImage'

vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

afterEach(() => {
  cleanup()
})

describe('resizableImage', () => {
  it('clamps width to the allowed range', () => {
    expect(clampImageWidth(40, 320)).toBe(120)
    expect(clampImageWidth(180, 320)).toBe(180)
    expect(clampImageWidth(600, 320)).toBe(320)
    expect(clampImageWidthPercent(10)).toBe(18)
    expect(clampImageWidthPercent(62.4)).toBe(62)
    expect(clampImageWidthPercent(140)).toBe(100)
  })

  it('updates image width as a percentage when dragging the resize handle', () => {
    const updateAttributes = vi.fn()
    const node = { attrs: { src: 'data:image/png;base64,1', alt: '', title: '', width: 50, widthUnit: 'percent' } } as unknown as Parameters<typeof ResizableImageView>[0]['node']

    render(
      <div
        ref={(node) => {
          if (node) {
            Object.defineProperty(node, 'getBoundingClientRect', {
              value: () => ({ width: 400 }),
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

    const frame = document.querySelector('.note-editor__image-frame')
    if (frame) {
      Object.defineProperty(frame, 'getBoundingClientRect', {
        value: () => ({ width: 200 }),
        configurable: true,
      })
      Object.defineProperty(frame.parentElement, 'getBoundingClientRect', {
        value: () => ({ width: 400 }),
        configurable: true,
      })
    }

    fireEvent.pointerDown(screen.getByLabelText('Resize image se'), { clientX: 100 })
    fireEvent.pointerMove(window, { clientX: 190 })
    fireEvent.pointerUp(window)

    expect(updateAttributes).toHaveBeenCalledWith({ width: 73, widthUnit: 'percent' })
  })

  it('updates image caption attributes', () => {
    const updateAttributes = vi.fn()
    const node = { attrs: { src: 'data:image/png;base64,1', alt: '', title: '', width: 50, widthUnit: 'percent', caption: '' } } as unknown as Parameters<typeof ResizableImageView>[0]['node']

    render(<ResizableImageView node={node} selected updateAttributes={updateAttributes} />)

    fireEvent.change(screen.getByLabelText('Image caption'), { target: { value: 'A quiet desk' } })

    expect(updateAttributes).toHaveBeenCalledWith({ caption: 'A quiet desk' })
  })
})
