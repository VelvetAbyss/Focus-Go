import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { convertWholeNoteBlock, moveNoteBlock, NOTE_BLOCK_TYPES, noteBlockLabels, topLevelBlocks } from '../model/noteBlocks'

type Anchor = { pos: number; left: number; top: number }
type Drag = { pos: number; doc: ProseMirrorNode }

export const NoteBlockTools = ({ editor, disabled }: { editor: Editor; disabled: boolean }) => {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [open, setOpen] = useState(false)
  const { refs, floatingStyles } = useFloating({
    open, placement: 'bottom-start', strategy: 'fixed',
    middleware: [offset(4), flip(), shift({ padding: 12 })], whileElementsMounted: autoUpdate,
  })
  const openRef = useRef(false)
  const dragRef = useRef<Drag | null>(null)
  const dropRef = useRef<{ boundary: number; top: number; left: number; width: number } | null>(null)
  const [drop, setDrop] = useState<{ boundary: number; top: number; left: number; width: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (disabled) return
    const parent = editor.view.dom.closest('.note-editor') as HTMLElement | null
    if (!parent) return
    const locate = (pos: number) => {
      const node = editor.view.nodeDOM(pos)
      if (!(node instanceof HTMLElement) || editor.view.composing) { setAnchor(null); return }
      const bounds = node.getBoundingClientRect()
      const owner = parent.getBoundingClientRect()
      setAnchor({ pos, left: Math.max(0, bounds.left - owner.left - 30), top: bounds.top - owner.top })
    }
    const fromSelection = () => {
      if (openRef.current || dragRef.current) return
      const { $from } = editor.state.selection
      if ($from.depth) locate($from.before(1))
    }
    const pointer = (event: PointerEvent) => {
      if (openRef.current || dragRef.current || !(event.target instanceof Node)) return
      const block = topLevelBlocks(editor.state.doc).find(({ pos }) => editor.view.nodeDOM(pos)?.contains(event.target as Node))
      if (block) locate(block.pos)
    }
    let frame = 0
    const reposition = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; fromSelection() })
    }
    const startComposition = () => { setAnchor(null); setOpen(false); openRef.current = false; dragRef.current = null; setDrop(null) }
    const outside = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node) || refs.floating.current?.contains(event.target as Node)) return
      setOpen(false)
      openRef.current = false
      if (!parent.contains(event.target as Node)) setAnchor(null)
    }
    parent.addEventListener('pointermove', pointer)
    editor.on('selectionUpdate', fromSelection)
    editor.on('update', fromSelection)
    editor.view.dom.addEventListener('compositionstart', startComposition)
    editor.view.dom.addEventListener('compositionend', reposition)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('pointerdown', outside)
    fromSelection()
    return () => {
      parent.removeEventListener('pointermove', pointer)
      editor.off('selectionUpdate', fromSelection)
      editor.off('update', fromSelection)
      editor.view.dom.removeEventListener('compositionstart', startComposition)
      editor.view.dom.removeEventListener('compositionend', reposition)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('pointerdown', outside)
      cancelAnimationFrame(frame)
    }
  }, [disabled, editor, refs.floating])

  useEffect(() => {
    const surface = editor.view.dom.closest('.note-editor__surface') as HTMLElement | null
    const parent = editor.view.dom.closest('.note-editor') as HTMLElement | null
    if (!surface || !parent || disabled) return
    const dragover = (event: DragEvent) => {
      const source = dragRef.current
      if (!source || source.doc !== editor.state.doc || editor.view.composing) { setDrop(null); return }
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      const blocks = topLevelBlocks(editor.state.doc)
      const owner = parent.getBoundingClientRect()
      let candidate: { boundary: number; top: number; left: number; width: number } | null = null
      for (const block of blocks) {
        const element = editor.view.nodeDOM(block.pos)
        if (!(element instanceof HTMLElement)) continue
        const rect = element.getBoundingClientRect()
        if (event.clientY < rect.top + rect.height / 2) {
          candidate = { boundary: block.pos, top: rect.top - owner.top, left: rect.left - owner.left, width: rect.width }
          break
        }
        candidate = { boundary: block.pos + block.node.nodeSize, top: rect.bottom - owner.top, left: rect.left - owner.left, width: rect.width }
      }
      dropRef.current = candidate
      setDrop(candidate)
    }
    const dropped = (event: DragEvent) => {
      const source = dragRef.current
      if (!source) return
      event.preventDefault()
      event.stopPropagation()
      const target = dropRef.current
      if (target && source.doc === editor.state.doc && moveNoteBlock(editor, source.pos, target.boundary)) setAnnouncement(t('notes.block.moved'))
      dragRef.current = null
      setDrop(null)
      setOpen(false)
      openRef.current = false
    }
    // Capture before ProseMirror's native drop handler; accept only a local handle drag.
    surface.addEventListener('dragover', dragover, true)
    surface.addEventListener('drop', dropped, true)
    return () => { surface.removeEventListener('dragover', dragover, true); surface.removeEventListener('drop', dropped, true) }
  }, [disabled, editor, t])

  useEffect(() => {
    if (open) refs.floating.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [open, refs.floating])

  const blocks = topLevelBlocks(editor.state.doc)
  const index = blocks.findIndex(({ pos }) => pos === anchor?.pos)
  const canConvert = anchor && ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'codeBlock'].includes(editor.state.doc.nodeAt(anchor.pos)?.type.name ?? '')
  const move = (direction: -1 | 1) => {
    if (!anchor || index < 0 || index + direction < 0 || index + direction >= blocks.length) return
    openRef.current = false
    setOpen(false)
    const neighbor = blocks[index + direction]
    if (moveNoteBlock(editor, anchor.pos, direction === -1 ? neighbor.pos : neighbor.pos + neighbor.node.nodeSize)) setAnnouncement(t('notes.block.moved'))
  }
  return <>
    <span className="note-editor__sr-only" role="status" aria-live="polite">{announcement}</span>
    {!disabled && anchor ? <div ref={rootRef} className="note-block-tools" style={{ left: anchor.left, top: anchor.top }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation()
          const items = Array.from(refs.floating.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
          const current = items.indexOf(document.activeElement as HTMLButtonElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          items[next]?.focus()
        }
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
          event.preventDefault(); event.stopPropagation(); setOpen(false); openRef.current = false; editor.commands.focus()
        }
      }}>
      <button ref={refs.setReference} type="button" className="note-block-tools__handle" draggable aria-label={t('notes.block.actions')} title={t('notes.block.actions')}
        aria-expanded={open} aria-haspopup="menu"
        onClick={() => { const next = !open; setOpen(next); openRef.current = next }}
        onDragStart={(event) => {
          if (editor.view.composing) { event.preventDefault(); return }
          dragRef.current = { pos: anchor.pos, doc: editor.state.doc }
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('application/x-focusgo-note-block', String(anchor.pos))
          const node = editor.view.nodeDOM(anchor.pos)
          if (node instanceof HTMLElement) event.dataTransfer.setDragImage(node, 0, 0)
          setOpen(false); openRef.current = false
        }}
        onDragEnd={() => { dragRef.current = null; setDrop(null) }}><GripVertical size={16} /></button>
      {open ? createPortal(<div ref={refs.setFloating} style={floatingStyles} className="note-block-tools__menu" role="menu" aria-label={t('notes.block.actions')}>
        <button type="button" role="menuitem" disabled={index <= 0} onPointerDown={(event) => event.preventDefault()} onClick={() => move(-1)}><ArrowUp size={15} />{t('notes.block.up')}</button>
        <button type="button" role="menuitem" disabled={index >= blocks.length - 1} onPointerDown={(event) => event.preventDefault()} onClick={() => move(1)}><ArrowDown size={15} />{t('notes.block.down')}</button>
        {canConvert ? <><div className="note-block-tools__heading">{t('notes.block.convert')}</div>
          {NOTE_BLOCK_TYPES.map((type) => <button type="button" role="menuitem" key={type} onPointerDown={(event) => event.preventDefault()}
            onClick={() => { convertWholeNoteBlock(editor, anchor.pos, type); setOpen(false); openRef.current = false }}>{t(noteBlockLabels[type])}</button>)}
        </> : null}
      </div>, document.body) : null}
    </div> : null}
    {drop ? <div className="note-block-drop" aria-hidden style={{ left: drop.left, top: drop.top, width: drop.width }} /> : null}
  </>
}
