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

turndown.addRule('figureImageCaption', {
  filter: (node) => node.nodeName === 'FIGURE' && Boolean((node as HTMLElement).querySelector('img')),
  replacement: (_content, node) => {
    const figure = node as HTMLElement
    const image = figure.querySelector('img')
    if (!image) return ''
    const src = image.getAttribute('src') ?? ''
    if (!src) return ''
    const alt = image.getAttribute('alt') ?? ''
    const caption = figure.querySelector('figcaption')?.textContent?.trim() ?? ''
    const imageMarkdown = `![${alt}](${src})`
    return caption ? `\n\n${imageMarkdown}\n\n_${caption}_\n\n` : `\n\n${imageMarkdown}\n\n`
  },
})

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

export const htmlToMarkdown = (html: string) => turndown.turndown(html).trimEnd()

export const htmlToRichDoc = (html: string): JSONContent => {
  const source = html.trim()
  if (!source) return emptyRichDoc()

  try {
    const json = generateJSON(source, extensions)
    return json.type === 'doc' ? json : emptyRichDoc()
  } catch {
    return emptyRichDoc()
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
