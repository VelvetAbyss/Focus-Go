const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g

export type BacklinkSourceNote = {
  id: string
  title: string
  contentMd: string
  deletedAt?: number | null
}

export const extractWikiLinkTitles = (contentMd: string): string[] => {
  const seen = new Set<string>()
  const titles: string[] = []

  for (const match of contentMd.matchAll(WIKI_LINK_RE)) {
    const title = match[1]?.trim()
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    titles.push(title)
  }

  return titles
}

export const buildBacklinkIndex = (notes: BacklinkSourceNote[]): Map<string, string[]> => {
  const activeNotes = notes.filter((note) => !note.deletedAt)
  const titleToId = new Map<string, string>()

  for (const note of activeNotes) {
    titleToId.set(note.title.trim().toLowerCase(), note.id)
  }

  const backlinks = new Map<string, Set<string>>()
  for (const note of notes) backlinks.set(note.id, new Set<string>())

  for (const source of activeNotes) {
    const links = extractWikiLinkTitles(source.contentMd)
    for (const title of links) {
      const targetId = titleToId.get(title.toLowerCase())
      if (!targetId || targetId === source.id) continue
      backlinks.get(targetId)?.add(source.id)
    }
  }

  const out = new Map<string, string[]>()
  for (const [noteId, ids] of backlinks) {
    out.set(noteId, Array.from(ids))
  }

  return out
}

export const resolveLinkedNoteIds = (contentMd: string, notes: BacklinkSourceNote[]): string[] => {
  const titleToId = new Map<string, string>()
  for (const note of notes) {
    if (note.deletedAt) continue
    titleToId.set(note.title.trim().toLowerCase(), note.id)
  }

  const unique = new Set<string>()
  for (const title of extractWikiLinkTitles(contentMd)) {
    const id = titleToId.get(title.toLowerCase())
    if (id) unique.add(id)
  }

  return Array.from(unique)
}
