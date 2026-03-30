import { Mark } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    diaryInlineFont: {
      setInlineFontFamily: (fontFamily: string) => ReturnType
      unsetInlineFontFamily: () => ReturnType
      setInlineFontSize: (fontSize: string) => ReturnType
      unsetInlineFontSize: () => ReturnType
    }
  }
}

export const DiaryInlineFont = Mark.create({
  name: 'diaryInlineFont',

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element) => {
          const raw = element.style.fontFamily
          return raw ? raw.replace(/['"]/g, '') : null
        },
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[style*="font-family"]' },
      { tag: 'span[style*="font-size"]' },
    ]
  },

  addCommands() {
    const getMergedAttrs = (next: Record<string, string | null>) => ({
      ...this.editor.getAttributes(this.name),
      ...next,
    })

    const clearAttr = (key: 'fontFamily' | 'fontSize') => {
      const attrs = { ...this.editor.getAttributes(this.name), [key]: null }
      if (!attrs.fontFamily && !attrs.fontSize) {
        return this.editor.commands.unsetMark(this.name)
      }
      return this.editor.commands.setMark(this.name, attrs)
    }

    return {
      setInlineFontFamily:
        (fontFamily: string) =>
        ({ commands }) =>
          commands.setMark(this.name, getMergedAttrs({ fontFamily })),
      unsetInlineFontFamily:
        () =>
        () =>
          clearAttr('fontFamily'),
      setInlineFontSize:
        (fontSize: string) =>
        ({ commands }) =>
          commands.setMark(this.name, getMergedAttrs({ fontSize })),
      unsetInlineFontSize:
        () =>
        () =>
          clearAttr('fontSize'),
    }
  },

  renderHTML({ HTMLAttributes }) {
    const styles = [
      HTMLAttributes.fontFamily ? `font-family: ${HTMLAttributes.fontFamily}` : null,
      HTMLAttributes.fontSize ? `font-size: ${HTMLAttributes.fontSize}` : null,
    ].filter(Boolean)

    return ['span', { style: styles.join('; ') || undefined }, 0]
  },
})
