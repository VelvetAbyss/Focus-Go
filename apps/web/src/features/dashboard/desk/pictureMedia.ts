/** Local-only image library. Keep binary data out of desk settings and cloud sync. */
export type PictureMedia = { id: string; name: string; blob: Blob; width: number; height: number; created: number }
const DB = 'focusgo.desk.media'
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB, 1)
  request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' })
  request.onerror = () => reject(request.error)
  request.onsuccess = () => resolve(request.result)
})
export const readPictureMedia = async (id: string): Promise<PictureMedia | undefined> => {
  const db = await open()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly')
      const request = tx.objectStore('images').get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
export const listPictureMedia = async (): Promise<PictureMedia[]> => {
  const db = await open()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('images').objectStore('images').getAll()
      request.onsuccess = () => resolve((request.result as PictureMedia[]).sort((a, b) => b.created - a.created))
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
export const importPictureMedia = async (file: File): Promise<PictureMedia> => {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('invalid-image')
  const bitmap = await createImageBitmap(file)
  let blob: Blob
  let width: number, height: number
  try {
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height))
    width = Math.max(1, Math.round(bitmap.width * scale))
    height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('image-unavailable')
    ctx.drawImage(bitmap, 0, 0, width, height)
    blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('image-unavailable')), 'image/webp', 0.92))
  } finally { bitmap.close() }
  const media: PictureMedia = { id: crypto.randomUUID(), name: file.name.slice(0, 120), blob, width, height, created: Date.now() }
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite')
      tx.objectStore('images').put(media)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
  return media
}
