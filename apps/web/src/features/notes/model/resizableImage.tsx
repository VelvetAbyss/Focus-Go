import { Image } from '@tiptap/extension-image'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRef } from 'react'

const MIN_IMAGE_WIDTH = 120
const MIN_IMAGE_WIDTH_PERCENT = 18
const MAX_IMAGE_WIDTH_PERCENT = 100

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

const parseWidth = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

// eslint-disable-next-line react-refresh/only-export-components
export const clampImageWidth = (width: number, maxWidth: number) => Math.round(Math.max(MIN_IMAGE_WIDTH, Math.min(width, Math.max(MIN_IMAGE_WIDTH, maxWidth))))

// eslint-disable-next-line react-refresh/only-export-components
export const clampImageWidthPercent = (width: number) => Math.round(Math.max(MIN_IMAGE_WIDTH_PERCENT, Math.min(width, MAX_IMAGE_WIDTH_PERCENT)))

export const ResizableImageView = ({ node, selected, updateAttributes }: Pick<NodeViewProps, 'node' | 'selected' | 'updateAttributes'>) => {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const width = parseWidth(node.attrs.width)
  const widthUnit = node.attrs.widthUnit === 'percent' ? 'percent' : 'px'
  const caption = typeof node.attrs.caption === 'string' ? node.attrs.caption : ''
  const hasCaption = caption.trim().length > 0
  const showCaption = selected || hasCaption

  const handleResizeStart = (handle: ResizeHandle) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const frame = frameRef.current
    if (!frame) return

    const startX = event.clientX
    const startWidth = frame.getBoundingClientRect().width
    const measuredMaxWidth = frame.parentElement?.getBoundingClientRect().width ?? 0
    const maxWidth = measuredMaxWidth > 0 ? measuredMaxWidth : Math.max(startWidth, window.innerWidth - 64)
    const direction = handle.includes('w') ? -1 : 1

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampImageWidth(startWidth + (moveEvent.clientX - startX) * direction, maxWidth)
      updateAttributes({ width: clampImageWidthPercent((nextWidth / maxWidth) * 100), widthUnit: 'percent' })
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
    <NodeViewWrapper className={`note-editor__image-node${selected ? ' is-selected' : ''}`} contentEditable={false}>
      <div
        ref={frameRef}
        className="note-editor__image-frame"
        style={{
          width: width ? (widthUnit === 'percent' ? `${width}%` : `${width}px`) : undefined,
        }}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt ?? ''}
          title={node.attrs.title ?? ''}
          draggable={false}
        />
        {selected ? (
          <div className="note-editor__image-resizer">
            {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
              <button
                key={handle}
                type="button"
                aria-label={`Resize image ${handle}`}
                className={`note-editor__image-resize-handle note-editor__image-resize-handle--${handle}`}
                onPointerDown={handleResizeStart(handle)}
              />
            ))}
          </div>
        ) : null}
      </div>
      {showCaption ? (
        <input
          className="note-editor__image-caption"
          value={caption}
          placeholder="Add caption"
          aria-label="Image caption"
          onChange={(event) => updateAttributes({ caption: event.target.value })}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : null}
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
          const width = element.style.width || element.getAttribute('width')
          return parseWidth(width)
        },
        renderHTML: (attributes) => {
          const width = parseWidth(attributes.width)
          if (!width) return {}
          return attributes.widthUnit === 'percent' ? { style: `width: ${width}%` } : { width: String(width) }
        },
      },
      widthUnit: {
        default: null,
        parseHTML: (element) => (element.style.width.includes('%') ? 'percent' : null),
      },
      caption: {
        default: null,
        parseHTML: (element) => {
          const figure = element.closest?.('figure')
          const figcaption = figure?.querySelector('figcaption')
          return figcaption?.textContent?.trim() || element.getAttribute('caption') || null
        },
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, width, widthUnit, ...imageAttributes } = HTMLAttributes
    const imageWidth = parseWidth(width)
    const renderedImageAttributes = {
      ...imageAttributes,
      ...(imageWidth ? (widthUnit === 'percent' ? { style: `width: ${imageWidth}%` } : { width: String(imageWidth) }) : {}),
    }
    if (typeof caption === 'string' && caption.trim().length > 0) {
      return ['figure', {}, ['img', renderedImageAttributes], ['figcaption', {}, caption]]
    }
    return ['img', renderedImageAttributes]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey('noteImageDragGuard'),
        props: {
          handleDOMEvents: {
            dragstart: (_view, event) => {
              if ((event.target as HTMLElement | null)?.tagName === 'IMG') {
                event.preventDefault()
                return true
              }
              return false
            },
          },
        },
      }),
    ]
  },
})

export default ResizableImage
