import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { useState } from 'react'
import { Baseline, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/tiptap-ui-primitive/popover'
import { useI18n } from '../../../shared/i18n/useI18n'
import { runNoteAction } from '../model/noteBlocks'
import { useNotePopoverFocus } from './useNotePopoverFocus'

const colors = [
  { en: 'Default', zh: '默认', value: '' },
  { en: 'Gray', zh: '灰色', value: '#787774' },
  { en: 'Brown', zh: '棕色', value: '#9f6b53' },
  { en: 'Orange', zh: '橙色', value: '#d9730d' },
  { en: 'Yellow', zh: '黄色', value: '#b38b00' },
  { en: 'Green', zh: '绿色', value: '#448361' },
  { en: 'Blue', zh: '蓝色', value: '#337ea9' },
  { en: 'Purple', zh: '紫色', value: '#9065b0' },
  { en: 'Pink', zh: '粉色', value: '#c14c8a' },
  { en: 'Red', zh: '红色', value: '#d44c47' },
]

export function NoteTextColorMenu({ editor }: { editor: Editor }) {
  const { language } = useI18n()
  const [open, setOpen] = useState(false)
  const focus = useNotePopoverFocus(editor)
  const current = useEditorState({ editor, selector: ({ editor: current }) => current.getAttributes('textStyle').color as string || '' })
  const label = language === 'zh' ? '文字颜色' : 'Text color'
  return <Popover open={open} onOpenChange={(next) => { focus.onOpenChange(next); setOpen(next) }}>
    <PopoverTrigger asChild>
      <button type="button" className="tiptap-button note-text-color-trigger" data-style="ghost" aria-label={label} title={label}
        onMouseDown={(event) => event.preventDefault()}>
        <Baseline size={17} style={{ color: current || undefined }} />
      </button>
    </PopoverTrigger>
    <PopoverContent {...focus.contentProps} className="note-text-color-menu" align="start">
      <div className="note-text-color-menu__label">{label}</div>
      <div role="group" aria-label={label} onKeyDown={(event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const buttons = Array.from(event.currentTarget.querySelectorAll('button'))
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        buttons[next]?.focus()
      }}>
        {colors.map((color) => <button type="button" key={color.en} aria-pressed={current === color.value}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            runNoteAction(editor, chain => color.value ? chain.setColor(color.value) : chain.unsetColor())
            setOpen(false)
          }}>
          <span className="note-text-color-menu__sample" style={{ color: color.value || undefined }}>A</span>
          <span>{language === 'zh' ? color.zh : color.en}</span>
          {current === color.value ? <Check size={14} /> : null}
        </button>)}
      </div>
    </PopoverContent>
  </Popover>
}
