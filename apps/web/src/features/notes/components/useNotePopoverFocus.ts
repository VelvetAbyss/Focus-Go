import { useRef } from 'react'
import type { Editor } from '@tiptap/core'
import type { ComponentProps } from 'react'
import { PopoverContent } from '@/components/tiptap-ui-primitive/popover'
import { setNoteSelectionFromPointer } from '../model/noteBlocks'

/** Consistent dismissal for editor menus: return to writing, respect outside clicks. */
export const useNotePopoverFocus = (editor: Editor | null | undefined) => {
  const restore = useRef(true)
  const onOpenChange = (open: boolean) => { if (open) restore.current = true }
  const contentProps: ComponentProps<typeof PopoverContent> = {
    collisionPadding: 12,
    onInteractOutside: () => { restore.current = false },
    onPointerDownOutside: event => { if (editor) setNoteSelectionFromPointer(editor, event.detail.originalEvent) },
    onCloseAutoFocus: event => { event.preventDefault(); if (restore.current) editor?.commands.focus() },
    onEscapeKeyDown: event => event.stopPropagation(),
  }
  return { onOpenChange, contentProps }
}
