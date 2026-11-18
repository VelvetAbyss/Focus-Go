import type { NoteItem } from '../../../data/models/types'
import type { LanguageCode } from '../../../shared/i18n/types'
import { markdownToPreview } from '../../../shared/utils/markdownPreview'

type NoteListSource = Pick<NoteItem, 'contentMd' | 'title' | 'excerpt'>

function readableLines(markdown: string, language: LanguageCode) {
  const image = language === 'zh' ? '图片' : 'Image'
  const table = language === 'zh' ? '表格' : 'Table'
  // Old cached excerpts may end in the middle of an inline image or HTML tag.
  const source = markdown
    .replace(/!\[([^\]\n]*)\]\((?:data:[^)]*(?:\)|$)|[^)\n]*\))/gi, (_, alt: string) => alt.trim() || image)
    .replace(/<img\b[^>]*(?:>|$)/gi, ' ' + image + ' ')
    .replace(/<table\b[^>]*(?:>|$)/gi, '\n' + table + ' · ')
    .replace(/<\/(?:tr|p|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:td|th)>/gi, ' ')
    .replace(/<\/?(?:colgroup|col|thead|tbody|tfoot|tr|td|th|table|p|div|span|mark|strong|em|a|u|del|sup|sub|ul|ol|li)\b[^>]*(?:>|$)/gi, '')
    .replace(/^\s*\|?[\s:|-]*---[\s:|-]*\|?\s*$/gm, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, entity => ({
      '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
    } as Record<string, string>)[entity] ?? entity)
  return source.split(/\r?\n/)
    .map(line => markdownToPreview(line.replace(/^\s*\|(.+)\|\s*$/, '$1').replace(/\s+\|\s+/g, ' · ')))
    .filter(Boolean)
}

function headingTitle(markdown: string) {
  const heading = markdown.match(/^\s{0,3}#{1,3}[ \t]+(.+?)\s*#*[ \t]*$/m)?.[1]
  return heading ? markdownToPreview(heading) : ''
}

const shorten = (text: string, limit: number) => text.length > limit ? text.slice(0, limit).trimEnd() + '…' : text

export function getNoteListText(note: NoteListSource, language: LanguageCode) {
  const source = note.contentMd || note.excerpt || ''
  const lines = readableLines(source, language)
  const text = lines.join(' ')
  const title = markdownToPreview(note.title) || headingTitle(source) || shorten(lines[0] || '', 80)
  const excerpt = lines[0] === title && lines.length > 1 ? lines.slice(1).join(' ') : text
  return { title, text, excerpt: excerpt === title ? '' : shorten(excerpt, 140) }
}

export function deriveEditedNoteTitle(markdown: string, previous: { title: string; contentMd: string }, language: LanguageCode) {
  const heading = headingTitle(markdown)
  if (heading) return heading
  const previousAutoTitle = getNoteListText({ ...previous, title: '', excerpt: '' }, language).title
  if (previous.title && previous.title !== previousAutoTitle) return previous.title
  return shorten(readableLines(markdown, language)[0] || '', 80)
}
