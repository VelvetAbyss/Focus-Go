import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { autoUpdate } from '@floating-ui/react'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { ChevronDown, Ellipsis } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/tiptap-ui-primitive/popover'
import { MarkButton } from '@/components/tiptap-ui/mark-button'
import { LinkPopover } from '@/components/tiptap-ui/link-popover'
import { NoteTextColorMenu } from './NoteTextColorMenu'
import { useI18n } from '../../../shared/i18n/useI18n'
import { closeNoteHistory, convertNoteBlock, currentBlockType, NOTE_BLOCK_TYPES, noteBlockLabels, toggleNoteMark, type NoteBlockType } from '../model/noteBlocks'
import { useNotePopoverFocus } from './useNotePopoverFocus'

export const NoteMarkButton = ({ editor, ...props }: ComponentProps<typeof MarkButton>) => <MarkButton {...props} editor={editor}
  onClick={(event) => {
    event.preventDefault()
    if (editor) toggleNoteMark(editor, props.type)
  }} />

export const NoteLinkPopover = ({ editor, onOpenChange, ...props }: ComponentProps<typeof LinkPopover>) => {
  const focus = useNotePopoverFocus(editor)
  return <LinkPopover {...props} editor={editor}
    autoOpenOnLinkActive={false}
    onOpenChange={open => { focus.onOpenChange(open); onOpenChange?.(open) }}
    popoverContentProps={{ ...focus.contentProps, className: 'note-link-menu' }}
    onBeforeLinkChange={() => { if (editor) closeNoteHistory(editor) }}
    onAfterLinkChange={() => { if (editor) closeNoteHistory(editor) }} />
}

export const NoteSelectionMenu = ({ editor, disabled }: { editor: Editor; disabled: boolean }) => {
  const { t } = useI18n()
  const dismissed = useRef('')
  const previousSelection = useRef('')
  const menuRef = useRef<HTMLDivElement>(null)
  const linkOpen = useRef(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreFocus = useNotePopoverFocus(editor)
  const secondaryMarks = (withText = false) => (['underline', 'strike', 'code'] as const).map(type =>
    <NoteMarkButton key={type} editor={editor} type={type} tabIndex={0}
      aria-label={t(`notes.selection.${type}`)} tooltip={t(`notes.selection.${type}`)}
      text={withText ? t(`notes.selection.${type}`) : undefined} />)
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'F10' && !disabled && !event.isComposing && !editor.view.composing
        && editor.state.selection instanceof TextSelection && !editor.state.selection.empty) {
        event.preventDefault()
        dismissed.current = ''
        editor.view.dispatch(editor.state.tr.setMeta('focusgoNoteSelectionMenu', 'show'))
        editor.view.dispatch(editor.state.tr.setMeta('focusgoNoteSelectionMenu', 'updatePosition'))
        requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('select, button:not(:disabled)')?.focus())
        return
      }
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || editor.view.composing || event.keyCode === 229 || editor.state.selection.empty) return
      const menu = document.querySelector<HTMLElement>('.note-selection-menu')
      if (!menu || getComputedStyle(menu).visibility === 'hidden') return
      event.preventDefault()
      event.stopImmediatePropagation()
      dismissed.current = `${editor.state.selection.from}:${editor.state.selection.to}`
      editor.view.dispatch(editor.state.tr.setMeta('focusgoNoteSelectionMenu', 'hide'))
    }
    editor.view.dom.addEventListener('keydown', keydown, true)
    const outside = (event: Event) => {
      if (editor.state.selection.empty || !menuRef.current?.isConnected) return
      const target = event.target
      if (!(target instanceof Element) || editor.view.dom.contains(target)
        || target.closest('.note-selection-menu, .note-text-color-menu, .note-link-menu, .note-selection-more')) return
      dismissed.current = `${editor.state.selection.from}:${editor.state.selection.to}`
      editor.view.dispatch(editor.state.tr.setMeta('focusgoNoteSelectionMenu', 'hide'))
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    // The portal also moves relative to the outer page and shell, not just
    // the editor's scroll surface (including CSS zoom/breakpoint reflows).
    const stopPositioning = menuRef.current ? autoUpdate(editor.view.dom, menuRef.current, () => {
      if (menuRef.current?.isConnected && !editor.isDestroyed) {
        editor.view.dispatch(editor.state.tr.setMeta('focusgoNoteSelectionMenu', 'updatePosition'))
      }
    }) : () => {}
    return () => {
      stopPositioning()
      editor.view.dom.removeEventListener('keydown', keydown, true)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
    }
  }, [editor, disabled])
  const blockType = useEditorState({ editor, selector: ({ editor: current }) => currentBlockType(current) })
  return <BubbleMenu ref={menuRef} editor={editor} appendTo={document.body} pluginKey="focusgoNoteSelectionMenu" updateDelay={80}
    className="note-selection-menu" role="toolbar" aria-label={t('notes.selection.label')}
    options={{ strategy: 'fixed', placement: 'top', offset: 8, flip: true, shift: { padding: 12 }, scrollTarget: editor.view.dom.closest<HTMLElement>('.note-editor__surface') ?? window }}
    shouldShow={({ state, view }) => {
      const selection = `${state.selection.from}:${state.selection.to}`
      if (selection !== previousSelection.current) { dismissed.current = ''; previousSelection.current = selection }
      return !disabled && !view.composing && state.selection instanceof TextSelection && !state.selection.empty
      && Boolean(state.doc.textBetween(state.selection.from, state.selection.to).trim())
      && dismissed.current !== `${state.selection.from}:${state.selection.to}`
      && (view.hasFocus() || linkOpen.current || moreOpen || Boolean(document.activeElement?.closest('.note-selection-menu, .note-text-color-menu, .note-selection-more')))
    }}
    // BubbleMenu captures mousedown to keep its anchor mounted during blur.
    // Cancel only the mouse default: cancelling pointerdown suppresses that
    // mousedown and detaches the toolbar as a portaled popover receives focus.
    onMouseDown={(event) => { if ((event.target as Element).closest('button')) event.preventDefault() }}
    onKeyDown={(event) => {
      // Portaled popovers own their own Escape and keyboard navigation.
      if (!event.currentTarget.contains(event.target as Node)) return
      // BubbleMenu forwards a native event wrapper; read KeyboardEvent getters
      // from the original event rather than its synthetic prototype.
      const key = event.nativeEvent.key
      if (event.target instanceof HTMLButtonElement && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
        event.preventDefault()
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('select:not(:disabled), button:not(:disabled)')).filter(control => control.getClientRects().length > 0)
        const index = controls.indexOf(document.activeElement as HTMLElement)
        const next = key === 'Home' ? 0 : key === 'End' ? controls.length - 1 : (index + (key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length
        controls[next]?.focus()
        return
      }
      if (key !== 'Escape' || event.nativeEvent.isComposing) return
      event.preventDefault()
      event.stopPropagation()
      dismissed.current = `${editor.state.selection.from}:${editor.state.selection.to}`
      editor.commands.focus()
      editor.view.dispatch(editor.state.tr.setMeta('focusgoNoteSelectionMenu', 'hide'))
    }}>
    <div className="note-selection-menu__content">
    <span className="note-selection-menu__block-type">
      <select aria-label={t('notes.block.convert')} title={t(noteBlockLabels[blockType])} value={blockType} disabled={editor.isActive('table')}
        onChange={(event) => convertNoteBlock(editor, event.target.value as NoteBlockType)}>
        {NOTE_BLOCK_TYPES.map((type) => <option key={type} value={type}>{t(noteBlockLabels[type])}</option>)}
      </select>
      <ChevronDown size={12} aria-hidden="true" />
    </span>
    <span className="note-selection-menu__separator" aria-hidden="true" />
    <NoteMarkButton editor={editor} type="bold" tabIndex={0} aria-label={t('notes.selection.bold')} tooltip={t('notes.selection.bold')} />
    <NoteMarkButton editor={editor} type="italic" tabIndex={0} aria-label={t('notes.selection.italic')} tooltip={t('notes.selection.italic')} />
    <div className="note-selection-menu__secondary">{secondaryMarks()}</div>
    <span className="note-selection-menu__separator" aria-hidden="true" />
    <NoteTextColorMenu editor={editor} />
    <NoteLinkPopover editor={editor} tabIndex={0} aria-label={t('notes.selection.link')} tooltip={t('notes.selection.link')}
      onOpenChange={(open) => { linkOpen.current = open }} />
    <Popover open={moreOpen} onOpenChange={open => { moreFocus.onOpenChange(open); setMoreOpen(open) }}>
      <PopoverTrigger asChild>
        <button type="button" className="tiptap-button note-selection-menu__more" data-style="ghost"
          aria-label={t('notes.selection.more')} title={t('notes.selection.more')}><Ellipsis size={17} /></button>
      </PopoverTrigger>
      <PopoverContent {...moreFocus.contentProps} className="note-selection-more" align="end"
        aria-label={t('notes.selection.more')}
        onPointerDown={event => { if ((event.target as Element).closest('button')) event.preventDefault() }}
        onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
          const index = controls.indexOf(document.activeElement as HTMLButtonElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length
          controls[next]?.focus()
        }}
        onClick={event => { if ((event.target as Element).closest('button:not(:disabled)')) setMoreOpen(false) }}>
        {secondaryMarks(true)}
      </PopoverContent>
    </Popover>
    </div>
  </BubbleMenu>
}
