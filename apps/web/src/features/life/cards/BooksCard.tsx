import { useEffect, useMemo, useState } from 'react'
import type { BookItem } from '../../../data/models/types'
import { booksRepo } from '../../../data/repositories/booksRepo'
import { LibraryCardSurface } from '../components/LibraryCardSurface'
import { dedupeBookMatch, hydrateRemoteBookCandidate, searchRemoteBooks, type RemoteBookCandidate } from '../booksApi'
import { buildLibraryPresentationModel } from './lifeDesignAdapters'

const toCreatePayload = (candidate: RemoteBookCandidate) => ({
  ...candidate,
  status: 'want-to-read' as const,
  progress: 0,
  subjects: candidate.subjects ?? [],
  lastSyncedAt: Date.now(),
})

const normalizeBookPatch = (patch: Partial<BookItem>): Partial<BookItem> => {
  if (typeof patch.progress !== 'number') return patch
  if (patch.progress >= 100) return { ...patch, progress: 100, status: 'finished' }
  if (patch.progress > 0) return { ...patch, status: 'reading' }
  return patch
}

const BooksCard = () => {
  const [open, setOpen] = useState(false)
  const [books, setBooks] = useState<BookItem[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RemoteBookCandidate[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [addingCandidateId, setAddingCandidateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedBook = useMemo(() => books.find((item) => item.id === selectedBookId) ?? null, [books, selectedBookId])
  const designModel = useMemo(() => buildLibraryPresentationModel(books), [books])

  useEffect(() => {
    const loadBooks = async () => {
      setLoading(true)
      const rows = await booksRepo.list()
      setBooks(rows)
      setSelectedBookId((current) => current ?? rows[0]?.id ?? null)
      setLoading(false)
    }
    void loadBooks()
  }, [])

  const handleSearch = async () => {
    const nextQuery = query.trim()
    if (!nextQuery) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchRemoteBooks(nextQuery))
    } catch {
      setError('Search failed. Try another title or author.')
    } finally {
      setSearching(false)
    }
  }

  const handleAddBook = async (candidateId: string) => {
    const candidate = results.find((item) => `${item.source}-${item.sourceId}` === candidateId)
    if (!candidate) return
    setAddingCandidateId(candidateId)
    try {
      const hydrated = await hydrateRemoteBookCandidate(candidate)
      const matched = dedupeBookMatch(
        books.map((item) => ({
          source: item.source,
          sourceId: item.sourceId,
          title: item.title,
          authors: item.authors,
          coverUrl: item.coverUrl,
          description: item.description,
          publisher: item.publisher,
          publishedDate: item.publishedDate,
          subjects: item.subjects,
          summary: item.summary,
          outline: item.outline,
          reflection: item.reflection,
          isbn10: item.isbn10,
          isbn13: item.isbn13,
          openLibraryKey: item.openLibraryKey,
          googleBooksId: item.googleBooksId,
          doi: item.doi,
        })),
        hydrated,
      )

      if (matched) {
        const existing = books.find((item) => item.isbn13 === matched.isbn13 || item.isbn10 === matched.isbn10 || item.title === matched.title)
        if (!existing) return
        const updated = await booksRepo.update(existing.id, {
          ...hydrated,
          subjects: hydrated.subjects ?? [],
          lastSyncedAt: Date.now(),
        })
        if (!updated) return
        setBooks((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
        setSelectedBookId(updated.id)
        return
      }

      const created = await booksRepo.create(toCreatePayload(hydrated))
      setBooks((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setSelectedBookId(created.id)
    } finally {
      setAddingCandidateId(null)
    }
  }

  const handleBookPatch = async (patch: Partial<BookItem>) => {
    if (!selectedBook) return
    const updated = await booksRepo.update(selectedBook.id, normalizeBookPatch(patch))
    if (!updated) return
    setBooks((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
    setSelectedBookId(updated.id)
  }

  const handleRemove = async (id: string) => {
    await booksRepo.remove(id)
    const next = books.filter((item) => item.id !== id)
    setBooks(next)
    setSelectedBookId(next[0]?.id ?? null)
  }

  return (
    <LibraryCardSurface
      model={designModel}
      books={books}
      selectedBook={selectedBook}
      selectedBookId={selectedBookId}
      open={open}
      loading={loading}
      query={query}
      searching={searching}
      error={error}
      results={results.map((item) => ({
        id: `${item.source}-${item.sourceId}`,
        title: item.title,
        authors: item.authors,
        coverUrl: item.coverUrl,
      }))}
      addingCandidateId={addingCandidateId}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onQueryChange={setQuery}
      onSearch={() => void handleSearch()}
      onClearResults={() => setResults([])}
      onSelectBook={setSelectedBookId}
      onAddBook={(id) => void handleAddBook(id)}
      onPatchBook={(patch) => void handleBookPatch(patch)}
      onRemoveBook={(id) => void handleRemove(id)}
    />
  )
}

export default BooksCard
