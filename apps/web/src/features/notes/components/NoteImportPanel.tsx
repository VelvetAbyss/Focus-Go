import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MAX_NOTE_IMPORT_FILES, MAX_NOTE_IMPORT_FILE_SIZE, type NoteImportWarning } from '../model/noteImport'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslationKey } from '../../../shared/i18n/types'

export type NoteImportQueueStatus = 'ready' | 'importing' | 'imported' | 'warning' | 'error' | 'unsupported'

export type NoteImportQueueItem = {
  id: string
  file: File
  status: NoteImportQueueStatus
  message?: string
  warnings?: NoteImportWarning[]
  title?: string
}

type Props = {
  open: boolean
  items: NoteImportQueueItem[]
  importing: boolean
  notice?: string | null
  onClose: () => void
  onFiles: (files: File[]) => void
  onImport: () => void
  onClear: () => void
}

const statusIcon = (status: NoteImportQueueStatus) => {
  if (status === 'importing') return <Loader2 size={14} className="note-import-panel__spin" />
  if (status === 'imported' || status === 'warning') return <CheckCircle2 size={14} />
  if (status === 'error' || status === 'unsupported') return <AlertCircle size={14} />
  return <FileText size={14} />
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const statusLabelKey: Record<NoteImportQueueStatus, TranslationKey> = {
  ready: 'notes.importModal.status.ready',
  importing: 'notes.importModal.status.importing',
  imported: 'notes.importModal.status.imported',
  warning: 'notes.importModal.status.warning',
  error: 'notes.importModal.status.error',
  unsupported: 'notes.importModal.status.unsupported',
}

export default function NoteImportPanel({ open, items, importing, notice, onClose, onFiles, onImport, onClear }: Props) {
  const { t } = useI18n()
  const [rendered, setRendered] = useState(open)
  const [visible, setVisible] = useState(open)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const canImport = items.some((item) => item.status === 'ready') && !importing
  const importableCount = items.filter((item) => item.status === 'ready').length

  useEffect(() => {
    if (open) {
      setRendered(true)
      setVisible(true)
      return
    }
    setVisible(false)
    const timer = window.setTimeout(() => setRendered(false), 180)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!rendered) return null

  const handleFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (files.length > 0) onFiles(files)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div data-note-floating-panel="import" data-state={visible ? 'open' : 'closed'} className="note-page__panel note-page__panel--wide note-import-panel">
      <div className="note-page__panel-header">
        <div>
          <h2>{t('notes.importModal.title')}</h2>
          <p className="note-import-panel__subtitle">{t('notes.importModal.description')}</p>
        </div>
        <button type="button" onClick={onClose} className="note-page__panel-close" aria-label={t('common.close')}>
          <X size={16} />
        </button>
      </div>

      <label
        className="note-import-panel__dropzone"
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          handleFiles(event.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".md,.markdown,.txt,.docx"
          aria-label={t('notes.importModal.fileInput')}
          onChange={(event) => handleFiles(event.currentTarget.files)}
        />
        <Upload size={18} />
        <span>{t('notes.importModal.dropzone')}</span>
        <small>{t('notes.importModal.limits', { count: MAX_NOTE_IMPORT_FILES, size: formatBytes(MAX_NOTE_IMPORT_FILE_SIZE) })}</small>
      </label>

      {notice && <div className="note-import-panel__notice">{notice}</div>}

      {items.length > 0 && (
        <div className="note-import-panel__list" aria-live="polite">
          {items.map((item) => (
            <div key={item.id} className="note-import-panel__item" data-status={item.status}>
              <div className="note-import-panel__item-icon">{statusIcon(item.status)}</div>
              <div className="note-import-panel__item-body">
                <div className="note-import-panel__item-title">{item.title ?? item.file.name}</div>
                <div className="note-import-panel__item-meta">
                  {formatBytes(item.file.size)} · {t(statusLabelKey[item.status])}
                </div>
                {item.message && <div className="note-import-panel__item-message">{item.message}</div>}
                {item.warnings?.map((warning, index) => (
                  <div key={`${warning.code}-${index}`} className="note-import-panel__item-message">
                    {warning.message}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="note-import-panel__actions">
        <button type="button" className="note-import-panel__secondary" onClick={onClear} disabled={importing || items.length === 0}>
          {t('notes.importModal.clear')}
        </button>
        <button type="button" className="note-import-panel__primary" onClick={onImport} disabled={!canImport}>
          {importing ? t('notes.importModal.importing') : t('notes.importModal.import', { count: importableCount })}
        </button>
      </div>
    </div>
  )
}
