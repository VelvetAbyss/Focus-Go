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

const createMarkdownWriter = () => {
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
  return turndown
}

const turndown = createMarkdownWriter()
const exportWriter = createMarkdownWriter()

// The persisted plain-text projection stays readable; a downloaded Markdown
// file also carries task states and the inline color supported by our editor.
exportWriter.addRule('noteTaskItem', {
  filter: node => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
  replacement: (content, node) => {
    const checked = (node as HTMLElement).getAttribute('data-checked') === 'true'
    const body = content.trim().replace(/\n/g, '\n    ')
    const emptyFirstParagraph = (node as HTMLElement).querySelector(':scope > div > p:first-child:empty')
    const separator = emptyFirstParagraph && body ? '\n\n    ' : ' '
    return `- [${checked ? 'x' : ' '}]${separator}${body}\n`
  },
})

exportWriter.addRule('noteTextColor', {
  filter: node => node.nodeName === 'SPAN' && Boolean((node as HTMLElement).style.color),
  replacement: (content, node) => {
    const el = node as HTMLElement
    const span = el.ownerDocument.createElement('span')
    span.style.color = el.style.color
    return span.outerHTML.replace('</span>', () => content + '</span>')
  },
})

const extensions = createRichTextExtensions()

export const emptyRichDoc = (): JSONContent => ({
  ...EMPTY_DOC,
  content: [{ type: 'paragraph' }],
})

// GFM emits checkboxes as form inputs; TipTap recognizes typed list nodes.
// Split mixed lists at the boundary so ordinary bullets stay ordinary.
const normalizeMarkdownTaskLists = (html: string) => {
  if (!html.includes('type="checkbox"')) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const list of Array.from(doc.querySelectorAll('ul')).reverse()) {
    if (!list.querySelector(':scope > li > input[type="checkbox"], :scope > li > p > input[type="checkbox"]')) continue
    const groups = doc.createDocumentFragment()
    let group: HTMLUListElement | undefined
    for (const item of Array.from(list.children)) {
      const checkbox = item.querySelector<HTMLInputElement>(':scope > input[type="checkbox"]:first-child, :scope > p:first-child > input[type="checkbox"]:first-child')
      const task = Boolean(checkbox)
      if (!group || (group.dataset.type === 'taskList') !== task) {
        group = doc.createElement('ul')
        if (task) group.dataset.type = 'taskList'
        groups.append(group)
      }
      if (checkbox) {
        item.setAttribute('data-type', 'taskItem')
        item.setAttribute('data-checked', String(checkbox.hasAttribute('checked')))
        checkbox.remove()
        const body = doc.createElement('div')
        body.append(...Array.from(item.childNodes))
        if (body.firstElementChild?.matches('ul, ol') && (body.firstChild === body.firstElementChild || !body.firstChild?.textContent?.trim())) {
          body.prepend(doc.createElement('p'))
        }
        item.append(body)
      }
      group.append(item)
    }
    list.replaceWith(groups)
  }
  return doc.body.innerHTML
}

export const markdownToRichDoc = (contentMd: string): JSONContent => {
  const source = contentMd.trim()
  if (!source) return emptyRichDoc()

  try {
    const html = marked.parse(source, {
      async: false, gfm: true, breaks: true,
      walkTokens(token) {
        // GFM's empty trailing checkbox has no space or body after the marker.
        if (token.type !== 'list_item' || token.task || !token.tokens) return
        const first = token.tokens[0]
        if (first?.type !== 'text' || !/^\[[ xX]\]$/.test(first.text)) return
        token.task = true
        token.checked = /^\[[xX]\]$/.test(first.text)
        token.tokens.shift()
      },
    }) as string
    const json = generateJSON(normalizeMarkdownTaskLists(html), extensions)
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

export const noteExportMarkdown = (contentJson: JSONContent | null | undefined, fallbackMd: string) => {
  if (contentJson?.type !== 'doc') return fallbackMd
  try {
    return exportWriter.turndown(generateHTML(contentJson, extensions)).trimEnd() || fallbackMd
  } catch {
    return fallbackMd
  }
}
