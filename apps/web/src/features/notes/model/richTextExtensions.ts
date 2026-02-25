import type { AnyExtension } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'

export const AssetImage = Image.extend({
  addAttributes() {
    return {
      ...((this.parent?.() as Record<string, unknown> | undefined) ?? {}),
      assetId: {
        default: null,
      },
    }
  },
})

type ExtensionOptions = {
  placeholder?: string
}

export const createRichTextExtensions = ({ placeholder }: ExtensionOptions = {}): AnyExtension[] => {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    Link.configure({
      autolink: true,
      linkOnPaste: true,
      openOnClick: false,
      protocols: ['http', 'https', 'mailto'],
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    AssetImage,
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
