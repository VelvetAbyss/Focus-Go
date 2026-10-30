import type { HangingNote } from './types'

export function normalizeHangingNotes(value: unknown): HangingNote[] {
  if (!Array.isArray(value)) return []
  const result: HangingNote[] = [], ids = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || typeof entry.text !== 'string' || !['butter', 'sage', 'rose'].includes(entry.color)) continue
    const note: HangingNote = { id: entry.id, text: entry.text.slice(0, 500), color: entry.color }
    if (entry.pin && [entry.pin.u, entry.pin.y, entry.pin.tilt].every(Number.isFinite)) {
      note.pin = { u: Math.max(0, Math.min(1, entry.pin.u)), y: Math.max(0, entry.pin.y), tilt: Math.max(-.08, Math.min(.08, entry.pin.tilt)) }
    }
    ids.add(note.id); result.push(note)
  }
  return result
}
