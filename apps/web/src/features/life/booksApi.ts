import type { BookCreateInput } from '@focus-go/core'

export type RemoteBookCandidate = {
  source: BookCreateInput['source']
  sourceId: string
  title: string
  authors: string[]
  coverUrl?: string
  description?: string
  publisher?: string
  publishedDate?: string
  subjects: string[]
  summary?: string
  outline?: string[]
  isbn10?: string
  isbn13?: string
  openLibraryKey?: string
  googleBooksId?: string
  doi?: string
}

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const getIsbn = (values: string[] | undefined, length: number) =>
  values?.find((item) => item.replace(/[^0-9Xx]/g, '').length === length)

const buildOpenLibraryCover = (coverId?: number, isbn?: string, olId?: string) => {
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
  if (olId) return `https://covers.openlibrary.org/b/olid/${olId}-M.jpg`
  return undefined
}

const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json() as Promise<T>
}

const mapOpenLibraryDoc = (doc: Record<string, unknown>): RemoteBookCandidate => {
  const isbnList = Array.isArray(doc.isbn) ? doc.isbn.filter((item): item is string => typeof item === 'string') : []
  const openLibraryId = Array.isArray(doc.edition_key) ? doc.edition_key.find((item): item is string => typeof item === 'string') : undefined
  return {
    source: 'open-library',
    sourceId: typeof doc.key === 'string' ? doc.key : String(doc.cover_edition_key ?? doc.title ?? crypto.randomUUID()),
    title: typeof doc.title === 'string' ? doc.title : 'Untitled',
    authors: Array.isArray(doc.author_name) ? doc.author_name.filter((item): item is string => typeof item === 'string') : [],
    coverUrl: buildOpenLibraryCover(typeof doc.cover_i === 'number' ? doc.cover_i : undefined, getIsbn(isbnList, 13), openLibraryId),
    publisher: Array.isArray(doc.publisher) ? doc.publisher.find((item): item is string => typeof item === 'string') : undefined,
    publishedDate: typeof doc.first_publish_year === 'number' ? String(doc.first_publish_year) : undefined,
    subjects: Array.isArray(doc.subject) ? doc.subject.filter((item): item is string => typeof item === 'string').slice(0, 6) : [],
    isbn10: getIsbn(isbnList, 10),
    isbn13: getIsbn(isbnList, 13),
    openLibraryKey: typeof doc.key === 'string' ? doc.key : undefined,
  }
}

const mapGoogleVolume = (item: { id: string; volumeInfo?: Record<string, unknown> }): RemoteBookCandidate => {
  const volume = item.volumeInfo ?? {}
  const industryIdentifiers = Array.isArray(volume.industryIdentifiers)
    ? volume.industryIdentifiers.filter((entry): entry is { type?: string; identifier?: string } => typeof entry === 'object' && entry !== null)
    : []
  return {
    source: 'google-books',
    sourceId: item.id,
    title: typeof volume.title === 'string' ? volume.title : 'Untitled',
    authors: Array.isArray(volume.authors) ? volume.authors.filter((entry): entry is string => typeof entry === 'string') : [],
    coverUrl:
      typeof volume.imageLinks === 'object' && volume.imageLinks && typeof (volume.imageLinks as { thumbnail?: unknown }).thumbnail === 'string'
        ? (volume.imageLinks as { thumbnail: string }).thumbnail
        : undefined,
    description: typeof volume.description === 'string' ? volume.description : undefined,
    publisher: typeof volume.publisher === 'string' ? volume.publisher : undefined,
    publishedDate: typeof volume.publishedDate === 'string' ? volume.publishedDate : undefined,
    subjects: Array.isArray(volume.categories)
      ? volume.categories.filter((entry): entry is string => typeof entry === 'string').slice(0, 6)
      : [],
    summary: typeof volume.subtitle === 'string' ? volume.subtitle : undefined,
    isbn10: industryIdentifiers.find((entry) => entry.type === 'ISBN_10')?.identifier,
    isbn13: industryIdentifiers.find((entry) => entry.type === 'ISBN_13')?.identifier,
    googleBooksId: item.id,
  }
}

const enrichFromGoogle = async (candidate: RemoteBookCandidate, signal?: AbortSignal): Promise<RemoteBookCandidate> => {
  const query = candidate.isbn13
    ? `isbn:${candidate.isbn13}`
    : candidate.isbn10
      ? `isbn:${candidate.isbn10}`
      : `intitle:${candidate.title}${candidate.authors[0] ? `+inauthor:${candidate.authors[0]}` : ''}`
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`
  const payload = await fetchJson<{ items?: Array<{ id: string; volumeInfo?: Record<string, unknown> }> }>(url, signal).catch(() => ({ items: [] }))
  const volume = payload.items?.[0]?.volumeInfo
  if (!volume) return candidate
  const industryIdentifiers = Array.isArray(volume.industryIdentifiers)
    ? volume.industryIdentifiers.filter((item): item is { type?: string; identifier?: string } => typeof item === 'object' && item !== null)
    : []
  return {
    ...candidate,
    source: candidate.source,
    googleBooksId: typeof payload.items?.[0]?.id === 'string' ? payload.items[0].id : candidate.googleBooksId,
    description: typeof volume.description === 'string' ? volume.description : candidate.description,
    publisher: typeof volume.publisher === 'string' ? volume.publisher : candidate.publisher,
    publishedDate: typeof volume.publishedDate === 'string' ? volume.publishedDate : candidate.publishedDate,
    coverUrl:
      typeof volume.imageLinks === 'object' && volume.imageLinks && typeof (volume.imageLinks as { thumbnail?: unknown }).thumbnail === 'string'
        ? (volume.imageLinks as { thumbnail: string }).thumbnail
        : candidate.coverUrl,
    subjects: Array.isArray(volume.categories)
      ? volume.categories.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : candidate.subjects,
    summary:
      typeof volume.subtitle === 'string'
        ? volume.subtitle
        : candidate.summary,
    isbn10:
      industryIdentifiers.find((item) => item.type === 'ISBN_10')?.identifier ?? candidate.isbn10,
    isbn13:
      industryIdentifiers.find((item) => item.type === 'ISBN_13')?.identifier ?? candidate.isbn13,
  }
}

const enrichFromCrossref = async (candidate: RemoteBookCandidate, signal?: AbortSignal): Promise<RemoteBookCandidate> => {
  if (!candidate.isbn13 && !candidate.title) return candidate
  const query = candidate.isbn13 ?? candidate.title
  const url = `https://api.crossref.org/works?rows=1&query.bibliographic=${encodeURIComponent(query)}`
  const payload = await fetchJson<{ message?: { items?: Array<Record<string, unknown>> } }>(url, signal).catch(() => ({ message: { items: [] } }))
  const item = payload.message?.items?.[0]
  if (!item) return candidate
  return {
    ...candidate,
    doi: typeof item.DOI === 'string' ? item.DOI : candidate.doi,
  }
}

const enrichFromGutendex = async (candidate: RemoteBookCandidate, signal?: AbortSignal): Promise<RemoteBookCandidate> => {
  const url = `https://gutendex.com/books?search=${encodeURIComponent(candidate.title)}`
  const payload = await fetchJson<{ results?: Array<Record<string, unknown>> }>(url, signal).catch(() => ({ results: [] }))
  const match = payload.results?.find((item) => normalizeText(String(item.title ?? '')) === normalizeText(candidate.title))
  if (!match) return candidate
  return {
    ...candidate,
    summary: Array.isArray(match.summaries) ? match.summaries.filter((item): item is string => typeof item === 'string')[0] ?? candidate.summary : candidate.summary,
    outline: Array.isArray(match.subjects) ? match.subjects.filter((item): item is string => typeof item === 'string').slice(0, 5) : candidate.outline,
  }
}

export const dedupeBookMatch = (rows: RemoteBookCandidate[], candidate: RemoteBookCandidate) =>
  rows.find((item) => {
    if (item.isbn13 && candidate.isbn13) return item.isbn13 === candidate.isbn13
    if (item.isbn10 && candidate.isbn10) return item.isbn10 === candidate.isbn10
    return normalizeText(item.title) === normalizeText(candidate.title) && normalizeText(item.authors[0] ?? '') === normalizeText(candidate.authors[0] ?? '')
  })

const mergeCandidates = (groups: RemoteBookCandidate[][]) => {
  const merged: RemoteBookCandidate[] = []
  for (const group of groups) {
    for (const candidate of group) {
      const matched = dedupeBookMatch(merged, candidate)
      if (matched) {
        Object.assign(matched, {
          ...candidate,
          authors: candidate.authors.length ? candidate.authors : matched.authors,
          subjects: candidate.subjects.length ? candidate.subjects : matched.subjects,
          coverUrl: candidate.coverUrl ?? matched.coverUrl,
          description: candidate.description ?? matched.description,
          publisher: candidate.publisher ?? matched.publisher,
          publishedDate: candidate.publishedDate ?? matched.publishedDate,
          summary: candidate.summary ?? matched.summary,
          outline: candidate.outline ?? matched.outline,
          isbn10: candidate.isbn10 ?? matched.isbn10,
          isbn13: candidate.isbn13 ?? matched.isbn13,
          openLibraryKey: candidate.openLibraryKey ?? matched.openLibraryKey,
          googleBooksId: candidate.googleBooksId ?? matched.googleBooksId,
          doi: candidate.doi ?? matched.doi,
        })
        continue
      }
      merged.push(candidate)
    }
  }
  return merged
}

export const hydrateRemoteBookCandidate = async (candidate: RemoteBookCandidate, signal?: AbortSignal): Promise<RemoteBookCandidate> => {
  const google = candidate.googleBooksId ? candidate : await enrichFromGoogle(candidate, signal)
  const [crossref, gutendex] = await Promise.all([
    enrichFromCrossref(google, signal),
    enrichFromGutendex(google, signal),
  ])
  return {
    ...google,
    doi: crossref.doi ?? google.doi,
    summary: gutendex.summary ?? google.summary,
    outline: gutendex.outline ?? google.outline,
  }
}

export const searchRemoteBooks = async (query: string, signal?: AbortSignal): Promise<RemoteBookCandidate[]> => {
  const openLibraryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&lang=zh&limit=8`
  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=zh&printType=books&maxResults=8`
  const fallbackGoogleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&printType=books&maxResults=8`
  const fallbackOpenLibraryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`

  const [openLibraryZh, googleZh, openLibraryAny, googleAny] = await Promise.all([
    fetchJson<{ docs?: Array<Record<string, unknown>> }>(openLibraryUrl, signal).catch(() => ({ docs: [] })),
    fetchJson<{ items?: Array<{ id: string; volumeInfo?: Record<string, unknown> }> }>(googleUrl, signal).catch(() => ({ items: [] })),
    fetchJson<{ docs?: Array<Record<string, unknown>> }>(fallbackOpenLibraryUrl, signal).catch(() => ({ docs: [] })),
    fetchJson<{ items?: Array<{ id: string; volumeInfo?: Record<string, unknown> }> }>(fallbackGoogleUrl, signal).catch(() => ({ items: [] })),
  ])

  const merged = mergeCandidates([
    (googleZh.items ?? []).map(mapGoogleVolume),
    (openLibraryZh.docs ?? []).map(mapOpenLibraryDoc),
    (googleAny.items ?? []).map(mapGoogleVolume),
    (openLibraryAny.docs ?? []).map(mapOpenLibraryDoc),
  ])

  return merged.slice(0, 10)
}
