import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/tiptap-ui-primitive/dropdown-menu'

// ── Types ────────────────────────────────────────────────────────────────────

type CustomFont = {
  name: string
  family: string
  url: string
}

type DiaryFontControlsProps = {
  editor: Editor | null
  globalFont: string
  fontSize: number
  onGlobalFontChange: (family: string) => void
  onGlobalFontSizeChange: (size: number) => void
}

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_FONTS = 'diary.customFonts'

const PRESET_FONTS = [
  { name: 'Noto Serif SC', family: "'Noto Serif SC', serif" },
  { name: 'Ma Shan Zheng', family: "'Ma Shan Zheng', cursive" },
]

const FONT_SIZE_MIN = 13
const FONT_SIZE_MAX = 28
const INLINE_FONT_SIZE_STEP = 1

// ── Helpers ──────────────────────────────────────────────────────────────────

const loadCustomFonts = (): CustomFont[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FONTS)
    return raw ? (JSON.parse(raw) as CustomFont[]) : []
  } catch {
    return []
  }
}

const saveCustomFonts = (fonts: CustomFont[]) => {
  localStorage.setItem(STORAGE_KEY_FONTS, JSON.stringify(fonts))
}

const injectFontLink = (url: string) => {
  if (document.querySelector(`link[href="${url}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

const buildGoogleFontsUrl = (name: string) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name.trim())}&display=swap`

const shortName = (family: string) =>
  family.split(',')[0].replace(/['"]/g, '').trim()

// ── Import Dialog ────────────────────────────────────────────────────────────

function FontImportDialog({
  onImport,
  onClose,
}: {
  onImport: (font: CustomFont) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleImport = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    const resolvedUrl = url.trim() || buildGoogleFontsUrl(trimmedName)
    injectFontLink(resolvedUrl)
    onImport({ name: trimmedName, family: `'${trimmedName}', sans-serif`, url: resolvedUrl })
    onClose()
  }

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="diary-font-controls__import-overlay"
      onClick={handleBackdropClick}
    >
      <div className="diary-font-controls__import-dialog" role="dialog" aria-modal="true">
        <p className="diary-font-controls__import-title">导入字体</p>
        <label className="diary-font-controls__import-label">
          字体名称
          <input
            className="diary-font-controls__import-input"
            placeholder="e.g. ZCOOL QingKe HuangYou"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            autoFocus
          />
        </label>
        <label className="diary-font-controls__import-label">
          CSS URL（可选）
          <input
            className="diary-font-controls__import-input"
            placeholder="https://fonts.googleapis.com/css2?..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImport()}
          />
        </label>
        <div className="diary-font-controls__import-actions">
          <button type="button" className="diary-font-controls__import-cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="diary-font-controls__import-btn"
            onClick={handleImport}
            disabled={!name.trim()}
          >
            导入
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DiaryFontControls ────────────────────────────────────────────────────────

export function DiaryFontControls({
  editor,
  globalFont,
  fontSize,
  onGlobalFontChange,
  onGlobalFontSizeChange,
}: DiaryFontControlsProps) {
  const [customFonts, setCustomFonts] = useState<CustomFont[]>(() => loadCustomFonts())
  const [importOpen, setImportOpen] = useState(false)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const mountedRef = useRef(false)

  // Inject persisted custom fonts once on mount
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    customFonts.forEach((f) => injectFontLink(f.url))
  }, [customFonts])

  useEffect(() => {
    if (!editor) return
    const sync = () => setSelectionVersion((value) => value + 1)
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
    }
  }, [editor])

  const allFonts = [
    ...PRESET_FONTS,
    ...customFonts.map((f) => ({ name: f.name, family: f.family })),
  ]

  const hasSelection = Boolean(editor && !editor.state.selection.empty)
  const inlineAttrs = editor?.getAttributes('diaryInlineFont') as { fontSize?: string; fontFamily?: string } | undefined
  const inlineFontSize = Number.parseInt(String(inlineAttrs?.fontSize ?? ''), 10)
  const currentSize = hasSelection && Number.isFinite(inlineFontSize) ? inlineFontSize : fontSize
  const sizeTargetLabel = hasSelection ? '选区' : '正文/标题'

  void selectionVersion

  const handleFontSelect = (family: string) => {
    if (!editor) {
      onGlobalFontChange(family)
      return
    }
    const { from, to } = editor.state.selection
    if (from !== to) {
      editor.chain().focus().setInlineFontFamily(family).run()
    } else {
      onGlobalFontChange(family)
    }
  }

  const handleImport = (font: CustomFont) => {
    const next = [...customFonts, font]
    setCustomFonts(next)
    saveCustomFonts(next)
  }

  const applyFontSize = (delta: number) => {
    const nextSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, currentSize + delta))
    if (nextSize === currentSize) return

    if (editor && hasSelection) {
      editor.chain().focus().setInlineFontSize(`${nextSize}px`).run()
      return
    }

    onGlobalFontSizeChange(nextSize)
  }

  return (
    <span className="diary-font-controls">
      {/* Font family dropdown */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="diary-font-controls__family-btn"
            aria-label="选择字体"
            title="选择字体"
          >
            <span className="diary-font-controls__family-preview" style={{ fontFamily: globalFont }}>
              {shortName(globalFont)}
            </span>
            <svg width="8" height="5" viewBox="0 0 8 5" fill="none" aria-hidden="true">
              <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom">
          {allFonts.map((font) => (
            <DropdownMenuItem
              key={font.family}
              onSelect={() => handleFontSelect(font.family)}
              style={{ fontFamily: font.family }}
              className={`diary-font-controls__font-item${font.family === globalFont ? ' is-active' : ''}`}
            >
              {font.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setImportOpen(true)}
            className="diary-font-controls__import-item"
          >
            导入字体…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Font size controls */}
      <span className="diary-font-controls__size">
        <button
          type="button"
          className="diary-font-controls__size-btn"
          onClick={() => applyFontSize(-INLINE_FONT_SIZE_STEP)}
          disabled={currentSize <= FONT_SIZE_MIN}
          aria-label={`减小${sizeTargetLabel}字号`}
          title={`减小${sizeTargetLabel}字号`}
        >
          A<sup>−</sup>
        </button>
        <span className="diary-font-controls__size-value" title={`当前作用：${sizeTargetLabel}`}>
          {currentSize}
          <span className="diary-font-controls__size-target">{sizeTargetLabel}</span>
        </span>
        <button
          type="button"
          className="diary-font-controls__size-btn"
          onClick={() => applyFontSize(INLINE_FONT_SIZE_STEP)}
          disabled={currentSize >= FONT_SIZE_MAX}
          aria-label={`增大${sizeTargetLabel}字号`}
          title={`增大${sizeTargetLabel}字号`}
        >
          A<sup>+</sup>
        </button>
      </span>

      {/* Import dialog — rendered outside dropdown to avoid nesting issues */}
      {importOpen && (
        <FontImportDialog
          onImport={handleImport}
          onClose={() => setImportOpen(false)}
        />
      )}
    </span>
  )
}
