import type { AnyExtension } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'

export const createRichTextExtensions = (placeholder?: string): AnyExtension[] => {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
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
