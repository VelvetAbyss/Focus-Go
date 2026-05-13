import mammoth from 'mammoth'
import { MAX_FILE_SIZE } from '@/lib/tiptap-utils'
import { htmlToMarkdown, markdownToRichDoc } from './richTextCodec'

export const MAX_NOTE_IMPORT_FILES = 12
export const MAX_NOTE_IMPORT_FILE_SIZE = MAX_FILE_SIZE
export const MAX_NOTE_IMPORT_IMAGE_SIZE = MAX_FILE_SIZE

export type NoteImportFormat = 'markdown' | 'text' | 'docx'

export type NoteImportWarningCode = 'docx-conversion' | 'image-skipped' | 'unsafe-content-removed'

export type NoteImportWarning = {
  code: NoteImportWarningCode
  message: string
}

export type NoteImportPayload = {
  sourceName: string
  format: NoteImportFormat
  title: string
  contentMd: string
  contentJson: Record<string, unknown> | null
  editorMode: 'document'
  warnings: NoteImportWarning[]
}

export type NoteImportErrorCode =
  | 'unsupported-format'
  | 'file-too-large'
  | 'empty-file'
  | 'read-failed'
  | 'docx-conversion-failed'

export class NoteImportError extends Error {
  code: NoteImportErrorCode

  constructor(code: NoteImportErrorCode, message: string) {
    super(message)
    this.name = 'NoteImportError'
    this.code = code
  }
}

type ParseOptions = {
  maxFileSize?: number
  maxImageSize?: number
}

const EXTENSION_RE = /\.([^.]+)$/
const MARKDOWN_HEADING_RE = /^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/m

const getExtension = (name: string) => name.match(EXTENSION_RE)?.[1]?.toLowerCase() ?? ''

export const getNoteImportFormat = (fileName: string): NoteImportFormat | null => {
  const extension = getExtension(fileName)
  if (extension === 'md' || extension === 'markdown') return 'markdown'
  if (extension === 'txt') return 'text'
  if (extension === 'docx') return 'docx'
  return null
}

export const deriveNoteImportTitle = (fileName: string, contentMd = '') => {
  const heading = contentMd.match(MARKDOWN_HEADING_RE)?.[1]?.trim()
  if (heading) return heading
  const baseName = fileName.replace(EXTENSION_RE, '').replace(/[-_]+/g, ' ').trim()
  return baseName || 'Imported note'
}

const normalizeText = (source: string) =>
  source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .trim()

const escapePlainTextForMarkdown = (source: string) =>
  normalizeText(source)
    .split('\n')
    .map((line) => line.replace(/([\\`*_{}[\]<>()#+\-.!|])/g, '\\$1'))
    .join('\n')

const toContentJson = (contentMd: string) => markdownToRichDoc(contentMd) as Record<string, unknown>

const ensureNotEmpty = (contentMd: string, fileName: string) => {
  if (contentMd.trim().length > 0) return
  throw new NoteImportError('empty-file', `${fileName} is empty.`)
}

const stripUnsafeHtml = (html: string, warnings: NoteImportWarning[]) => {
  if (!html.trim()) return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  let removed = 0

  doc.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((node) => {
    removed += 1
    node.remove()
  })

  doc.querySelectorAll<HTMLElement>('*').forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on')) {
        node.removeAttribute(attribute.name)
        removed += 1
        continue
      }
      if ((name === 'href' || name === 'src') && /^(javascript|vbscript|file):/i.test(value)) {
        node.removeAttribute(attribute.name)
        removed += 1
      }
    }
  })

  if (removed > 0) {
    warnings.push({
      code: 'unsafe-content-removed',
      message: `${removed} unsafe HTML item${removed === 1 ? '' : 's'} removed before import.`,
    })
  }

  return doc.body.innerHTML
}

const parseMarkdownFile = async (file: File): Promise<NoteImportPayload> => {
  const contentMd = normalizeText(await file.text())
  ensureNotEmpty(contentMd, file.name)
  return {
    sourceName: file.name,
    format: 'markdown',
    title: deriveNoteImportTitle(file.name, contentMd),
    contentMd,
    contentJson: toContentJson(contentMd),
    editorMode: 'document',
    warnings: [],
  }
}

const parseTextFile = async (file: File): Promise<NoteImportPayload> => {
  const contentMd = escapePlainTextForMarkdown(await file.text())
  ensureNotEmpty(contentMd, file.name)
  return {
    sourceName: file.name,
    format: 'text',
    title: deriveNoteImportTitle(file.name),
    contentMd,
    contentJson: toContentJson(contentMd),
    editorMode: 'document',
    warnings: [],
  }
}

const parseDocxFile = async (file: File, options: Required<Pick<ParseOptions, 'maxImageSize'>>): Promise<NoteImportPayload> => {
  const warnings: NoteImportWarning[] = []
  const arrayBuffer = await file.arrayBuffer()

  try {
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(async (image) => {
          const base64 = await image.readAsBase64String()
          const estimatedBytes = Math.floor((base64.length * 3) / 4)
          if (estimatedBytes > options.maxImageSize) {
            warnings.push({
              code: 'image-skipped',
              message: `Skipped an embedded ${image.contentType} image larger than ${Math.round(options.maxImageSize / (1024 * 1024))}MB.`,
            })
            return { src: '' }
          }
          return { src: `data:${image.contentType};base64,${base64}` }
        }),
      },
    )

    for (const message of result.messages) {
      warnings.push({
        code: 'docx-conversion',
        message: message.message,
      })
    }

    const safeHtml = stripUnsafeHtml(result.value, warnings)
    const contentMd = htmlToMarkdown(safeHtml)
    ensureNotEmpty(contentMd, file.name)

    return {
      sourceName: file.name,
      format: 'docx',
      title: deriveNoteImportTitle(file.name, contentMd),
      contentMd,
      contentJson: toContentJson(contentMd),
      editorMode: 'document',
      warnings,
    }
  } catch (error) {
    if (error instanceof NoteImportError) throw error
    throw new NoteImportError('docx-conversion-failed', error instanceof Error ? error.message : `Could not convert ${file.name}.`)
  }
}

export const parseNoteImportFile = async (file: File, options: ParseOptions = {}): Promise<NoteImportPayload> => {
  const maxFileSize = options.maxFileSize ?? MAX_NOTE_IMPORT_FILE_SIZE
  const maxImageSize = options.maxImageSize ?? MAX_NOTE_IMPORT_IMAGE_SIZE

  if (file.size > maxFileSize) {
    throw new NoteImportError('file-too-large', `${file.name} is larger than ${Math.round(maxFileSize / (1024 * 1024))}MB.`)
  }

  const format = getNoteImportFormat(file.name)
  if (!format) {
    throw new NoteImportError('unsupported-format', `${file.name} is not a supported import format.`)
  }

  try {
    if (format === 'markdown') return await parseMarkdownFile(file)
    if (format === 'text') return await parseTextFile(file)
    return await parseDocxFile(file, { maxImageSize })
  } catch (error) {
    if (error instanceof NoteImportError) throw error
    throw new NoteImportError('read-failed', error instanceof Error ? error.message : `Could not read ${file.name}.`)
  }
}

export const describeNoteImportError = (error: unknown) => {
  if (error instanceof NoteImportError) return error.message
  return error instanceof Error ? error.message : 'Could not import this file.'
}
