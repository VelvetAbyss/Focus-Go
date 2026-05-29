import { useEffect, useRef, useState } from 'react'
import { FileText, Paperclip, Trash2, X } from 'lucide-react'
import type { TripAttachmentMeta } from '../../../data/models/types'
import { tripAttachmentsRepo } from '../tripAttachmentsRepo'
import { ink, muted, subtleBorder, tx } from './tokens'

type AttachmentStripProps = {
  tripId: string
  attachmentIds: string[]
  onChange: (next: string[]) => void
  label?: string
}

type Preview = { meta: TripAttachmentMeta; url: string }

const ACCEPT = 'image/*,application/pdf'

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const AttachmentStrip = ({ tripId, attachmentIds, onChange, label }: AttachmentStripProps) => {
  const ids = attachmentIds ?? []
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [previews, setPreviews] = useState<Preview[]>([])
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState<Preview | null>(null)
  const idsKey = ids.join(',')

  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    void (async () => {
      const metas = await tripAttachmentsRepo.listByIds(ids)
      if (cancelled) return
      const built: Preview[] = []
      for (const meta of metas) {
        const blob = await tripAttachmentsRepo.getBlob(meta.id)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        urls.push(url)
        built.push({ meta, url })
      }
      if (cancelled) {
        urls.forEach((url) => URL.revokeObjectURL(url))
        return
      }
      setPreviews(built)
    })()
    return () => {
      cancelled = true
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, tripId])

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setBusy(true)
    try {
      const added: string[] = []
      for (const file of Array.from(fileList)) {
        const meta = await tripAttachmentsRepo.add(tripId, file)
        added.push(meta.id)
      }
      if (added.length > 0) onChange([...ids, ...added])
    } catch (error) {
      console.error('[trips] attachment upload failed', error)
      if (typeof window !== 'undefined') window.alert(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = async (id: string) => {
    await tripAttachmentsRepo.remove(id)
    onChange(ids.filter((existing) => existing !== id))
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 999,
          border: `1px dashed ${subtleBorder}`,
          background: 'transparent',
          padding: '6px 12px',
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
          ...tx(12, 500, muted),
        }}
      >
        <Paperclip size={13} />
        {busy ? 'Uploading…' : label ?? 'Attach'}
      </button>

      {previews.map((preview) => (
        <div
          key={preview.meta.id}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 10,
            border: `1px solid ${subtleBorder}`,
            background: '#FFFCF9',
            padding: preview.meta.kind === 'image' ? 0 : '6px 8px',
            overflow: 'hidden',
          }}
        >
          {preview.meta.kind === 'image' ? (
            <button
              type="button"
              onClick={() => setLightbox(preview)}
              title={preview.meta.name}
              style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0 }}
            >
              <img
                src={preview.url}
                alt={preview.meta.name}
                style={{ width: 48, height: 48, objectFit: 'cover', display: 'block' }}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLightbox(preview)}
              title={preview.meta.name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                maxWidth: 160,
                ...tx(12, 500, ink),
              }}
            >
              <FileText size={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {preview.meta.name}
              </span>
              <span style={{ ...tx(10, 400, muted) }}>{formatSize(preview.meta.size)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void removeAttachment(preview.meta.id)}
            title="Remove attachment"
            style={{
              position: preview.meta.kind === 'image' ? 'absolute' : 'static',
              top: 2,
              right: 2,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 999,
              border: 'none',
              background: preview.meta.kind === 'image' ? 'rgba(0,0,0,0.55)' : 'transparent',
              color: preview.meta.kind === 'image' ? '#fff' : muted,
              cursor: 'pointer',
            }}
          >
            {preview.meta.kind === 'image' ? <X size={11} /> : <Trash2 size={13} />}
          </button>
        </div>
      ))}

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(20,18,16,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close preview"
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              width: 36,
              height: 36,
              borderRadius: 999,
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
          <div onClick={(event) => event.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            {lightbox.meta.kind === 'image' ? (
              <img
                src={lightbox.url}
                alt={lightbox.meta.name}
                style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, display: 'block' }}
              />
            ) : (
              <embed
                src={lightbox.url}
                type={lightbox.meta.mime}
                style={{ width: '85vw', height: '85vh', borderRadius: 8, background: '#fff' }}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
