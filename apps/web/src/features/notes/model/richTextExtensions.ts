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
      width: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute('data-width') ?? element.getAttribute('width')
          if (!value) return null
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : value
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {}
          return { 'data-width': attributes.width }
        },
      },
    }
  },
})

type ExtensionOptions = {
  placeholder?: string
  imageExtension?: AnyExtension
}

export const createRichTextExtensions = ({ placeholder, imageExtension }: ExtensionOptions = {}): AnyExtension[] => {
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
    imageExtension ?? AssetImage,
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
