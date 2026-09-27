import { markdownToPreview } from '../utils/markdownPreview'

/** Everything ⌘K can find, flattened to title + searchable body. */
export type SearchKind = 'task' | 'note' | 'diary' | 'project'

export type SearchDoc = {
  kind: SearchKind
  id: string
  title: string
  /** Plain or markdown text searched after the title. */
  body: string
  /** Shown under the title when the match is in the title (a date, a status). */
  meta?: string
  /** Finished items (done tasks, archived projects) rank below open ones. */
  closed?: boolean
  updatedAt: number
}

export type SearchHit = SearchDoc & { snippet?: string }

const SNIPPET_BEFORE = 14
const SNIPPET_AFTER = 46

const snippetAround = (text: string, needle: string) => {
  const plain = markdownToPreview(text)
  const index = plain.toLowerCase().indexOf(needle)
  if (index < 0) return undefined
  const start = Math.max(0, index - SNIPPET_BEFORE)
  const end = Math.min(plain.length, index + needle.length + SNIPPET_AFTER)
  return `${start > 0 ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`
}

/**
 * Case-insensitive substring search. Title matches outrank body matches (a title that
 * starts with the query ranks highest), open items outrank closed ones, then the most
 * recently updated first. At most `perKind` hits per kind.
 */
export const searchDocs = (docs: SearchDoc[], query: string, perKind = 5): SearchHit[] => {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const scored: Array<{ hit: SearchHit; score: number }> = []
  for (const doc of docs) {
    const title = doc.title.toLowerCase()
    let score = 0
    let snippet: string | undefined
    if (title.startsWith(needle)) score = 3
    else if (title.includes(needle)) score = 2
    else if (doc.body.toLowerCase().includes(needle)) {
      snippet = snippetAround(doc.body, needle)
      if (snippet) score = 1
    }
    if (!score) continue
    scored.push({ hit: { ...doc, snippet }, score: score - (doc.closed ? 1.5 : 0) })
  }
  scored.sort((a, b) => b.score - a.score || b.hit.updatedAt - a.hit.updatedAt)
  const perKindCount = new Map<SearchKind, number>()
  const hits: SearchHit[] = []
  for (const { hit } of scored) {
    const count = perKindCount.get(hit.kind) ?? 0
    if (count >= perKind) continue
    perKindCount.set(hit.kind, count + 1)
    hits.push(hit)
  }
  return hits
}
