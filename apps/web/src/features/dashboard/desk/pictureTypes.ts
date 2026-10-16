import type { DeskSpan } from './deskLayout'

export type PictureKind = 'window' | 'frame'
export type PictureSettings = {
  width: number
  height: number
  y: number
  source: string
  fit: 'cover' | 'contain'
  zoom: number
  panX: number
  panY: number
  open: boolean
}
export const isPicture = (kind: string): kind is PictureKind => kind === 'window' || kind === 'frame'
export const defaultPicture = (kind: PictureKind): PictureSettings => ({
  width: kind === 'window' ? 3.6 : 1.4,
  height: kind === 'window' ? 1.8 : 1.35,
  y: kind === 'window' ? 0.38 : 0.65,
  source: kind === 'window' ? 'mediterranean' : 'monet',
  fit: kind === 'window' ? 'cover' : 'contain',
  zoom: 1, panX: 0.5, panY: 0.5, open: false,
})
export const bounded = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
export const parsePicture = (kind: PictureKind, value: unknown): PictureSettings => {
  const d = defaultPicture(kind)
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    width: bounded(v.width, d.width, kind === 'window' ? 1.6 : 0.7, 8),
    height: bounded(v.height, d.height, 0.7, 4),
    // Lift the first preview's standing frames onto the wall when restoring them.
    y: bounded(kind === 'frame' && v.y === 0 ? d.y : v.y, d.y, kind === 'frame' ? 0.12 : 0, 5),
    source: typeof v.source === 'string' && /^(mediterranean|nordic|city|neon|monet|wave|bedroom|local:[a-zA-Z0-9-]+)$/.test(v.source) ? v.source : d.source,
    fit: v.fit === 'cover' || v.fit === 'contain' ? v.fit : d.fit,
    zoom: bounded(v.zoom, 1, 1, 3),
    panX: bounded(v.panX, 0.5, 0, 1),
    panY: bounded(v.panY, 0.5, 0, 1),
    open: v.open === true,
  }
}
/** Fit to this viewport without overwriting the size saved on a wider screen. */
export const pictureTop = (picture: PictureSettings, kind: string) => picture.height * (kind === 'frame' ? 1.15 : 1)
export const fitPicture = (picture: PictureSettings, span: DeskSpan, top: number, kind = 'window'): PictureSettings => {
  const scale = Math.min(1, Math.max(0.1, span.right - span.left - 0.16) / (picture.width * 1.06), Math.max(0.1, top - (kind === 'frame' ? 0.28 : 0.16)) / pictureTop(picture, kind))
  const height = picture.height * scale
  return { ...picture, width: picture.width * scale, height, y: Math.max(0, Math.min(picture.y, top - pictureTop({ ...picture, height }, kind) - 0.08)) }
}
