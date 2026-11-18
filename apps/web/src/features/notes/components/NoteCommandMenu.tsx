import { Bell, Clock, ListTodo, Quote, Type, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Code } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Editor } from '@tiptap/core'
import { createPortal } from 'react-dom'
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { noteCommandKey, type NoteCommandId } from '../model/noteCommands'

const icons = { task: ListTodo, waiting: Clock, reminder: Bell, quote: Quote, paragraph: Type, heading1: Heading1, heading2: Heading2, heading3: Heading3, bulletList: List, orderedList: ListOrdered, taskList: ListChecks, codeBlock: Code }
const labels = {
  task: 'notes.command.task', waiting: 'notes.command.waiting', reminder: 'notes.command.reminder', quote: 'notes.command.quote',
  paragraph: 'notes.block.paragraph', heading1: 'notes.headingDropdown.h1', heading2: 'notes.headingDropdown.h2', heading3: 'notes.headingDropdown.h3',
  bulletList: 'notes.block.bulletList', orderedList: 'notes.block.orderedList', taskList: 'notes.block.taskList', codeBlock: 'notes.block.codeBlock',
} as const

export const NoteCommandMenu = ({ commands, activeIndex, editor, position, menuId, onChoose }: {
  commands: Array<{ id: NoteCommandId }>
  activeIndex: number
  editor: Editor
  position: number
  menuId: string
  onChoose: (id: NoteCommandId) => void
}) => {
  const { t } = useI18n()
  const menuRef = useRef<HTMLDivElement>(null)
  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start', strategy: 'fixed', whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 12 }), size({ padding: 12, apply({ availableHeight }) {
      const menu = menuRef.current
      if (menu) {
        const scale = Number(getComputedStyle(document.documentElement).getPropertyValue('--overlay-scale')) || 1
        menu.style.maxHeight = `${Math.max(0, Math.min(360, availableHeight / scale))}px`
      }
    } })],
  })
  useLayoutEffect(() => {
    const caretRect = () => {
      const caret = editor.view.coordsAtPos(Math.min(position, editor.state.doc.content.size))
      return new DOMRect(caret.left, caret.top, 1, caret.bottom - caret.top)
    }
    const surface = editor.view.dom.closest<HTMLElement>('.note-editor__surface')
    refs.setReference({ contextElement: editor.view.dom, getBoundingClientRect: caretRect })
    if (!surface) return
    // Native keyboard scrolling can continue after typing resumes. Keep the
    // active insertion point visible, but yield immediately to manual scrolling.
    const revealCaret = () => {
      const caret = caretRect()
      const bounds = surface.getBoundingClientRect()
      const delta = Math.min(0, caret.top - bounds.top - 12) + Math.max(0, caret.bottom - bounds.bottom + 12)
      if (Math.abs(delta) > 1) surface.scrollBy({ top: delta, behavior: 'instant' })
    }
    const dismiss = () => editor.view.dispatch(editor.state.tr.setMeta(noteCommandKey, 'dismiss'))
    revealCaret()
    surface.addEventListener('scroll', revealCaret, { passive: true })
    surface.addEventListener('wheel', dismiss, { passive: true })
    surface.addEventListener('pointerdown', dismiss)
    return () => {
      surface.removeEventListener('scroll', revealCaret)
      surface.removeEventListener('wheel', dismiss)
      surface.removeEventListener('pointerdown', dismiss)
    }
  }, [editor, position, refs])
  useEffect(() => {
    const menu = menuRef.current
    const option = menu?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!menu || !option) return
    const bottom = option.offsetTop + option.offsetHeight
    if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop
    else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight
  }, [activeIndex])
  return createPortal(
    <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 60, width: 'max-content' }}>
    <div ref={menuRef} id={menuId} className="note-command-menu" role="listbox" aria-label={t('notes.command.label')}>
      {commands.length ? commands.map(({ id }, index) => {
        const Icon = icons[id]
        return <button
          type="button" key={id} role="option" aria-selected={index === activeIndex}
          id={`${menuId}-${id}`}
          className="note-command-menu__option" data-active={index === activeIndex || undefined}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onChoose(id)}
        ><Icon size={16} /><span>{t(labels[id])}</span></button>
      }) : <div className="note-command-menu__empty">{t('notes.command.empty')}</div>}
      <div className="note-command-menu__hint">{t('notes.command.hint')}</div>
    </div>
    </div>, document.body
  )
}
