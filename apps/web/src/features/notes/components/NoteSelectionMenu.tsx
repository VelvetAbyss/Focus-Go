import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { useEffect, useRef } from 'react'
import { MarkButton } from '@/components/tiptap-ui/mark-button'
import { LinkPopover } from '@/components/tiptap-ui/link-popover'
import { useI18n } from '../../../shared/i18n/useI18n'
import { convertNoteBlock, currentBlockType, NOTE_BLOCK_TYPES, noteBlockLabels, type NoteBlockType } from '../model/noteBlocks'

export const NoteSelectionMenu = ({ editor, disabled }: { editor: Editor; disabled: boolean }) => {
  const { t } = useI18n()
  const dismissed = useRef('')
  const previousSelection = useRef('')
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || editor.view.composing || event.keyCode === 229 || editor.state.selection.empty) return
      const menu = document.querySelector<HTMLElement>('.note-selection-menu')
      if (!menu || getComputedStyle(menu).visibility === 'hidden') return
      event.preventDefault()
      event.stopImmediatePropagation()
      dismissed.current = `${editor.state.selection.from}:${editor.state.selection.to}`
      editor.view.dispatch(editor.state.tr.setMeta('focusgoNoteSelectionMenu', 'hide'))
    }
    editor.view.dom.addEventListener('keydown', keydown, true)
    return () => editor.view.dom.removeEventListener('keydown', keydown, true)
  }, [editor])
  const blockType = useEditorState({ editor, selector: ({ editor: current }) => currentBlockType(current) })
  return <BubbleMenu editor={editor} pluginKey="focusgoNoteSelectionMenu" updateDelay={80}
    className="note-selection-menu" role="toolbar" aria-label={t('notes.selection.label')}
    options={{ placement: 'top', offset: 8, flip: true, shift: { padding: 12 }, scrollTarget: editor.view.dom.closest<HTMLElement>('.note-editor__surface') ?? window }}
    shouldShow={({ state, view }) => {
      const selection = `${state.selection.from}:${state.selection.to}`
      if (selection !== previousSelection.current) { dismissed.current = ''; previousSelection.current = selection }
      return !disabled && !view.composing && state.selection instanceof TextSelection && !state.selection.empty
      && Boolean(state.doc.textBetween(state.selection.from, state.selection.to).trim())
      && dismissed.current !== `${state.selection.from}:${state.selection.to}`
      && (view.hasFocus() || Boolean(document.activeElement?.closest('.note-selection-menu')))
    }}
    onPointerDown={(event) => { if ((event.target as Element).closest('button')) event.preventDefault() }}
    onKeyDown={(event) => {
      if (event.key !== 'Escape' || event.nativeEvent.isComposing) return
      event.preventDefault()
      event.stopPropagation()
      dismissed.current = `${editor.state.selection.from}:${editor.state.selection.to}`
      editor.commands.focus()
      editor.view.dispatch(editor.state.tr.setMeta('focusgoNoteSelectionMenu', 'hide'))
    }}>
    <select aria-label={t('notes.block.convert')} value={blockType} disabled={editor.isActive('table')}
      onChange={(event) => convertNoteBlock(editor, event.target.value as NoteBlockType)}>
      {NOTE_BLOCK_TYPES.map((type) => <option key={type} value={type}>{t(noteBlockLabels[type])}</option>)}
    </select>
    <MarkButton editor={editor} type="bold" tabIndex={0} aria-label={t('notes.selection.bold')} tooltip={t('notes.selection.bold')} />
    <MarkButton editor={editor} type="italic" tabIndex={0} aria-label={t('notes.selection.italic')} tooltip={t('notes.selection.italic')} />
    <MarkButton editor={editor} type="underline" tabIndex={0} aria-label={t('notes.selection.underline')} tooltip={t('notes.selection.underline')} />
    <MarkButton editor={editor} type="strike" tabIndex={0} aria-label={t('notes.selection.strike')} tooltip={t('notes.selection.strike')} />
    <MarkButton editor={editor} type="code" tabIndex={0} aria-label={t('notes.selection.code')} tooltip={t('notes.selection.code')} />
    <LinkPopover editor={editor} tabIndex={0} aria-label={t('notes.selection.link')} tooltip={t('notes.selection.link')} autoOpenOnLinkActive={false} />
  </BubbleMenu>
}
