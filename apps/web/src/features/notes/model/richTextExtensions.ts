import type { AnyExtension } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Placeholder from '@tiptap/extension-placeholder'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { ResizableImage } from './resizableImage'

export const createRichTextExtensions = (placeholder?: string): AnyExtension[] => {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      horizontalRule: false,
      link: {
        openOnClick: false,
        enableClickSelection: true,
      },
    }),
    Underline,
    HorizontalRule,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    ResizableImage,
    Typography,
    Superscript,
    Subscript,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ]

  if (placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder,
      }),
    )
  }

  return extensions
}
