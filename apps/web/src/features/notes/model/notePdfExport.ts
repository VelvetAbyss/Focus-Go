import type { JSONContent } from '@tiptap/core'
import { generateHTML } from '@tiptap/html'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { NoteAppearanceSettings, NoteItem } from '../../../data/models/types'
import { createRichTextExtensions } from './richTextExtensions'

type PdfNote = Pick<NoteItem, 'title' | 'contentMd' | 'contentJson'>

const PAGE_BG = '#F5F3F0'
const TEXT_COLOR = '#3A3733'
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

const fontFamilyMap: Record<NoteAppearanceSettings['font'], string> = {
  uiSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif',
  humanistSans: '"Avenir Next", "Nunito", "Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif',
  cnSans: '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  cnSerif: '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif',
  mono: '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, monospace',
}

const extensions = createRichTextExtensions()

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const buildNotePdfFileName = (title: string) => `${(title.trim() || 'untitled').replace(/\s+/g, '-').toLowerCase()}.pdf`

const sanitize = (html: string) =>
  DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })

export const buildNotePdfBodyHtml = (note: PdfNote) => {
  const contentJson = note.contentJson as JSONContent | null | undefined
  if (contentJson && typeof contentJson === 'object' && contentJson.type === 'doc') {
    try {
      return sanitize(generateHTML(contentJson, extensions))
    } catch {
      // Fall through to markdown below.
    }
  }

  const source = note.contentMd.trim()
  if (!source) return '<p></p>'
  return sanitize(marked.parse(source, { async: false, gfm: true, breaks: true }) as string)
}

export const buildNotePdfHtml = (note: PdfNote, appearance?: Partial<NoteAppearanceSettings>) => {
  const title = note.title.trim() || 'Untitled'
  const fontFamily = fontFamilyMap[appearance?.font ?? 'serif']
  const fontSize = Math.max(12, Math.min(24, appearance?.fontSize ?? 16))
  const lineHeight = Math.max(1.2, Math.min(2.4, appearance?.lineHeight ?? 1.8))
  const bodyHtml = buildNotePdfBodyHtml(note)

  return `
    <style>
      .note-pdf-export {
        box-sizing: border-box;
        width: 794px;
        min-height: 1123px;
        padding: 56px 64px 72px;
        background: ${PAGE_BG};
        color: ${TEXT_COLOR};
        font-family: ${fontFamily};
        font-size: ${fontSize}px;
        line-height: ${lineHeight};
      }
      .note-pdf-export *,
      .note-pdf-export *::before,
      .note-pdf-export *::after {
        box-sizing: border-box;
      }
      .note-pdf-export__title {
        margin: 0 0 28px;
        color: ${TEXT_COLOR};
        font-size: 32px;
        line-height: 1.2;
        font-weight: 700;
        letter-spacing: 0;
      }
      .note-pdf-export__body {
        color: ${TEXT_COLOR};
      }
      .note-pdf-export__body h1,
      .note-pdf-export__body h2,
      .note-pdf-export__body h3 {
        margin: 1.4em 0 0.55em;
        color: ${TEXT_COLOR};
        line-height: 1.25;
        break-after: avoid;
      }
      .note-pdf-export__body h1 { font-size: 1.65em; }
      .note-pdf-export__body h2 { font-size: 1.35em; }
      .note-pdf-export__body h3 { font-size: 1.15em; }
      .note-pdf-export__body p {
        margin: 0 0 0.9em;
      }
      .note-pdf-export__body ul,
      .note-pdf-export__body ol {
        margin: 0 0 1em 1.4em;
        padding: 0;
      }
      .note-pdf-export__body li {
        margin: 0.25em 0;
      }
      .note-pdf-export__body blockquote {
        margin: 1.1em 0;
        padding: 0.1em 0 0.1em 1em;
        border-left: 3px solid rgba(58, 55, 51, 0.28);
        color: rgba(58, 55, 51, 0.78);
        break-inside: avoid;
      }
      .note-pdf-export__body pre,
      .note-pdf-export__body code {
        border-radius: 6px;
        background: rgba(58, 55, 51, 0.08);
        color: ${TEXT_COLOR};
        font-family: "SF Mono", "JetBrains Mono", Consolas, monospace;
      }
      .note-pdf-export__body code {
        padding: 0.12em 0.3em;
        font-size: 0.9em;
      }
      .note-pdf-export__body pre {
        margin: 1em 0;
        padding: 12px 14px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        break-inside: avoid;
      }
      .note-pdf-export__body pre code {
        padding: 0;
        background: transparent;
      }
      .note-pdf-export__body table {
        width: 100%;
        margin: 1em 0;
        border-collapse: collapse;
        break-inside: avoid;
      }
      .note-pdf-export__body th,
      .note-pdf-export__body td {
        border: 1px solid rgba(58, 55, 51, 0.22);
        padding: 8px 10px;
        vertical-align: top;
      }
      .note-pdf-export__body th {
        background: rgba(58, 55, 51, 0.08);
        font-weight: 700;
      }
      .note-pdf-export__body img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 1em auto;
        break-inside: avoid;
      }
      .note-pdf-export__body hr {
        margin: 1.5em 0;
        border: 0;
        border-top: 1px solid rgba(58, 55, 51, 0.24);
      }
      .note-pdf-export__body a {
        color: ${TEXT_COLOR};
        text-decoration: underline;
        overflow-wrap: anywhere;
      }
      .note-pdf-export__body [data-type='taskList'] {
        list-style: none;
        margin-left: 0;
      }
      .note-pdf-export__body [data-type='taskItem'] {
        display: flex;
        gap: 0.5em;
        align-items: flex-start;
      }
      .note-pdf-export__body input[type='checkbox'] {
        margin-top: 0.45em;
        accent-color: ${TEXT_COLOR};
      }
    </style>
    <article class="note-pdf-export">
      <h1 class="note-pdf-export__title">${escapeHtml(title)}</h1>
      <div class="note-pdf-export__body">${bodyHtml}</div>
    </article>
  `
}

export const createNotePdfExportElement = (
  note: PdfNote,
  appearance?: Partial<NoteAppearanceSettings>,
  ownerDocument: Document = document,
) => {
  const wrapper = ownerDocument.createElement('div')
  wrapper.innerHTML = buildNotePdfHtml(note, appearance)
  return wrapper
}

export const attachNotePdfExportElement = (element: HTMLElement, ownerDocument: Document = document) => {
  element.setAttribute('aria-hidden', 'true')
  element.style.position = 'fixed'
  element.style.left = '0'
  element.style.top = '0'
  element.style.width = '794px'
  element.style.maxWidth = '794px'
  element.style.pointerEvents = 'none'
  element.style.zIndex = '2147483647'
  element.style.background = PAGE_BG
  element.style.transform = 'translate3d(0, 0, 0)'
  ownerDocument.body.appendChild(element)
}

const waitForExportImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll('img'))
  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) return
      if (typeof image.decode === 'function') {
        try {
          await image.decode()
          return
        } catch {
          return
        }
      }
      await new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  )
}

export const exportNoteAsPdf = async (note: PdfNote, appearance?: Partial<NoteAppearanceSettings>) => {
  const element = createNotePdfExportElement(note, appearance)
  attachNotePdfExportElement(element)

  const filename = buildNotePdfFileName(note.title)

  try {
    const exportNode = element.querySelector<HTMLElement>('.note-pdf-export') ?? element
    await waitForExportImages(exportNode)
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
    const canvas = await html2canvas(exportNode, {
      backgroundColor: PAGE_BG,
      scale: Math.min(2, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false,
      width: exportNode.scrollWidth,
      height: exportNode.scrollHeight,
      windowWidth: exportNode.scrollWidth,
      windowHeight: exportNode.scrollHeight,
    })

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Failed to render note PDF: empty canvas')
    }

    const imageData = canvas.toDataURL('image/jpeg', 0.96)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const imageHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width
    let remainingHeightMm = imageHeightMm
    let yOffsetMm = 0

    pdf.addImage(imageData, 'JPEG', 0, yOffsetMm, A4_WIDTH_MM, imageHeightMm)
    remainingHeightMm -= A4_HEIGHT_MM

    while (remainingHeightMm > 0) {
      yOffsetMm = remainingHeightMm - imageHeightMm
      pdf.addPage()
      pdf.addImage(imageData, 'JPEG', 0, yOffsetMm, A4_WIDTH_MM, imageHeightMm)
      remainingHeightMm -= A4_HEIGHT_MM
    }

    pdf.save(filename)
  } finally {
    element.remove()
  }
}
