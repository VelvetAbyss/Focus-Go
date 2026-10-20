import { useState, type ComponentProps } from 'react'
import type { Editor } from '@tiptap/core'
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu'
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu'
import { ColorHighlightPopoverButton } from '@/components/tiptap-ui/color-highlight-popover'
import { pickHighlightColorsByValue } from '@/components/tiptap-ui/color-highlight-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/tiptap-ui-primitive/popover'
import { useNotePopoverFocus } from './useNotePopoverFocus'
import { runNoteAction } from '../model/noteBlocks'
import { useI18n } from '../../../shared/i18n/useI18n'

export const NoteHeadingDropdownMenu = (props: ComponentProps<typeof HeadingDropdownMenu>) => {
  const focus = useNotePopoverFocus(props.editor)
  return <HeadingDropdownMenu {...props} onOpenChange={focus.onOpenChange} contentProps={focus.contentProps} />
}
export const NoteListDropdownMenu = (props: ComponentProps<typeof ListDropdownMenu>) => {
  const focus = useNotePopoverFocus(props.editor)
  return <ListDropdownMenu {...props} onOpenChange={focus.onOpenChange} contentProps={focus.contentProps} />
}
const colors = pickHighlightColorsByValue(['var(--tt-color-highlight-green)', 'var(--tt-color-highlight-blue)', 'var(--tt-color-highlight-red)', 'var(--tt-color-highlight-purple)', 'var(--tt-color-highlight-yellow)'])

export const NoteHighlightMenu = ({ editor }: { editor: Editor }) => {
  const { language } = useI18n()
  const [open, setOpen] = useState(false)
  const focus = useNotePopoverFocus(editor)
  const label = language === 'zh' ? '背景高亮' : 'Highlight text'
  return <Popover open={open} onOpenChange={next => { focus.onOpenChange(next); setOpen(next) }}>
    <PopoverTrigger asChild><ColorHighlightPopoverButton tabIndex={0} aria-label={label} tooltip={label}
      onMouseDown={event => event.preventDefault()} /></PopoverTrigger>
    <PopoverContent {...focus.contentProps} className="note-highlight-menu" aria-label="Highlight colors" align="start">
      <div role="group" aria-label={label}>
        {colors.map(color => <button key={color.value} type="button" aria-label={`${color.label} highlight color`} title={color.label}
          style={{ backgroundColor: color.colorValue }} onMouseDown={event => event.preventDefault()}
          onClick={() => { runNoteAction(editor, chain => chain.toggleHighlight({ color: color.colorValue })); setOpen(false) }}>A</button>)}
      </div>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => {
        runNoteAction(editor, chain => chain.unsetHighlight()); setOpen(false)
      }}>{language === 'zh' ? '移除高亮' : 'Remove highlight'}</button>
    </PopoverContent>
  </Popover>
}
