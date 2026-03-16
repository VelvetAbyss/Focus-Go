import type { JSONContent } from '@tiptap/core'
import { generateHTML, generateJSON } from '@tiptap/html'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { createRichTextExtensions } from './richTextExtensions'

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

turndown.use(gfm)

const extensions = createRichTextExtensions()

export const emptyRichDoc = (): JSONContent => ({
  ...EMPTY_DOC,
  content: [{ type: 'paragraph' }],
})

export const markdownToRichDoc = (contentMd: string): JSONContent => {
  const source = contentMd.trim()
  if (!source) return emptyRichDoc()

  try {
    const html = marked.parse(source, { async: false, gfm: true, breaks: true }) as string
    const json = generateJSON(html, extensions)
    return json.type === 'doc' ? json : emptyRichDoc()
  } catch {
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: source }] }],
    }
  }
}

export const richDocToMarkdown = (contentJson: JSONContent | null | undefined) => {
  if (!contentJson) return ''
  try {
    return turndown.turndown(generateHTML(contentJson, extensions)).trimEnd()
  } catch {
    return ''
  }
}

export const ensureRichDoc = (contentJson: Record<string, unknown> | null | undefined, fallbackMd: string) => {
  if (contentJson && typeof contentJson === 'object' && (contentJson as JSONContent).type === 'doc') {
    return contentJson as JSONContent
  }
  return markdownToRichDoc(fallbackMd)
}
