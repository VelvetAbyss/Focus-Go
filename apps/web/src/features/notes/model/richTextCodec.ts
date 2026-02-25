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

const baseExtensions = createRichTextExtensions()

export const emptyRichDoc = () => ({ ...EMPTY_DOC })

export const markdownToRichDoc = (contentMd: string): JSONContent => {
  const source = contentMd.trim()
  if (!source) return emptyRichDoc()

  try {
    const html = marked.parse(source, { async: false, gfm: true, breaks: true }) as string
    const json = generateJSON(html, baseExtensions)
    return json.type === 'doc' ? json : emptyRichDoc()
  } catch {
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: source }] }],
    }
  }
}

export const richDocToMarkdown = (contentJson: JSONContent | null | undefined): string => {
  if (!contentJson) return ''
  try {
    const html = generateHTML(contentJson, baseExtensions)
    return turndown.turndown(html).trimEnd()
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

