import { Image } from '@tiptap/extension-image'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRef } from 'react'

const MIN_IMAGE_WIDTH = 120

const parseWidth = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export const clampImageWidth = (width: number, maxWidth: number) => Math.round(Math.max(MIN_IMAGE_WIDTH, Math.min(width, Math.max(MIN_IMAGE_WIDTH, maxWidth))))

export const ResizableImageView = ({ node, selected, updateAttributes }: Pick<NodeViewProps, 'node' | 'selected' | 'updateAttributes'>) => {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const width = parseWidth(node.attrs.width)

  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const frame = frameRef.current
    if (!frame) return

    const startX = event.clientX
    const startWidth = width ?? frame.getBoundingClientRect().width
    const measuredMaxWidth = frame.parentElement?.getBoundingClientRect().width ?? 0
    const maxWidth = measuredMaxWidth > 0 ? measuredMaxWidth : Math.max(startWidth, window.innerWidth - 64)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampImageWidth(startWidth + (moveEvent.clientX - startX), maxWidth)
      updateAttributes({ width: nextWidth })
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }

    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <NodeViewWrapper className="note-editor__image-node" contentEditable={false}>
      <div
        ref={frameRef}
        className="note-editor__image-frame"
        style={{
          position: 'relative',
          display: 'inline-flex',
          maxWidth: '100%',
          margin: '2rem 0',
        }}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt ?? ''}
          title={node.attrs.title ?? ''}
          draggable={false}
          style={{
            display: 'block',
            width: width ? `${width}px` : 'auto',
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 'var(--tt-radius-xs, 0.25rem)',
            outline: selected ? '0.125rem solid var(--tt-brand-color-500)' : '0.125rem solid transparent',
          }}
        />
        {selected ? (
          <button
            type="button"
            aria-label="Resize image"
            onPointerDown={handleResizeStart}
            style={{
              position: 'absolute',
              right: -6,
              bottom: -6,
              width: 14,
              height: 14,
              border: 0,
              borderRadius: 999,
              background: 'var(--tt-brand-color-500)',
              boxShadow: '0 0 0 2px white',
              cursor: 'nwse-resize',
            }}
          />
        ) : null}
      </div>
    </NodeViewWrapper>
  )
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width') ?? element.style.width
          return parseWidth(width)
        },
        renderHTML: (attributes) => {
          const width = parseWidth(attributes.width)
          return width ? { width: String(width) } : {}
        },
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

export default ResizableImage
