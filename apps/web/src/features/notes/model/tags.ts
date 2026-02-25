import type { NoteEntity } from '../../../data/models/types'

const MAX_TAG_LENGTH = 32
const INVALID_TAG_CHAR_RE = /[^\p{L}\p{N}_-]/gu
const HASH_TAG_RE = /(?:^|[\s([{])#([\p{L}\p{N}_-]{1,32})/gu

export const normalizeTag = (raw: string) => {
  const stripped = raw.trim().replace(/^#+/, '')
  const cleaned = stripped.replace(INVALID_TAG_CHAR_RE, '')
  if (!cleaned) return ''
  return cleaned.slice(0, MAX_TAG_LENGTH)
}

const tagKey = (tag: string) => normalizeTag(tag).toLocaleLowerCase()

export const extractHashTagsFromMarkdown = (contentMd: string) => {
  const found: string[] = []
  const seen = new Set<string>()

  for (const match of contentMd.matchAll(HASH_TAG_RE)) {
    const normalized = normalizeTag(match[1] ?? '')
    if (!normalized) continue
    const key = tagKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    found.push(normalized)
  }

  return found
}

export const mergeTags = (manualTags: string[], autoTags: string[]) => {
  const merged: string[] = []
  const seen = new Set<string>()

  for (const tag of [...manualTags, ...autoTags]) {
    const normalized = normalizeTag(tag)
    if (!normalized) continue
    const key = tagKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(normalized)
  }

  return merged
}

type FilterInput = {
  keyword?: string
  selectedTag?: string | null
}

export const filterNotesByTagAndKeyword = (notes: NoteEntity[], filters: FilterInput) => {
  const selectedTagKey = filters.selectedTag ? tagKey(filters.selectedTag) : ''
  const keyword = (filters.keyword ?? '').trim().toLocaleLowerCase()

  return notes.filter((note) => {
    const noteTags = Array.isArray(note.tags) ? note.tags : []
    const tagMatch = !selectedTagKey || noteTags.some((tag) => tagKey(tag) === selectedTagKey)
    if (!tagMatch) return false
    if (!keyword) return true

    const title = note.title.toLocaleLowerCase()
    const content = note.contentMd.toLocaleLowerCase()
    const tagsText = noteTags.join(' ').toLocaleLowerCase()
    return title.includes(keyword) || content.includes(keyword) || tagsText.includes(keyword)
  })
}

export const collectTagSuggestions = (notes: NoteEntity[]) => {
  const ordered: string[] = []
  const seen = new Set<string>()

  for (const note of notes) {
    const noteTags = Array.isArray(note.tags) ? note.tags : []
    for (const tag of noteTags) {
      const normalized = normalizeTag(tag)
      if (!normalized) continue
      const key = tagKey(normalized)
      if (seen.has(key)) continue
      seen.add(key)
      ordered.push(normalized)
    }
  }

  return ordered.sort((a, b) => a.localeCompare(b))
}

