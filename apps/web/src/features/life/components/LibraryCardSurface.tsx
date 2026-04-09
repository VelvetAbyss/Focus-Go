import { BookMarked, BookOpen, CheckCheck, ChevronRight, Clock, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo } from 'react'
import Dialog from '../../../shared/ui/Dialog'
import { AppNumber } from '../../../shared/ui/AppNumber'
import type { BookItem } from '../../../data/models/types'
import type { LibraryPresentationModel } from '../cards/lifeDesignAdapters'
import ProgressTrack from '../ProgressTrack'
import { LifeCardLoader, LifePanelLoader } from './lifeDesignPrimitives'

type SearchBook = {
  id: string
  title: string
  authors: string[]
  coverUrl?: string
}

type Props = {
  model: LibraryPresentationModel
  books: BookItem[]
  selectedBook: BookItem | null
  selectedBookId: string | null
  open: boolean
  loading: boolean
  query: string
  searching: boolean
  error: string | null
  results: SearchBook[]
  addingCandidateId: string | null
  onOpen: () => void
  onClose: () => void
  onQueryChange: (value: string) => void
  onSearch: () => void
  onSelectBook: (id: string) => void
  onAddBook: (id: string) => void
  onPatchBook: (patch: Partial<BookItem>) => void
  onRemoveBook: (id: string) => void
}

const paper = '#F5F3F0'
const ink = '#3A3733'
const subtleBorder = 'rgba(58,55,51,0.09)'
const mutedText = 'rgba(58,55,51,0.45)'
const cardBg = '#ffffff'

const inter = (size = 13, weight = 400, color = ink) => ({
  fontFamily: 'Inter, sans-serif',
  fontSize: size,
  fontWeight: weight,
  color,
})

const playfair = (size = 16, weight = 500, color = ink) => ({
  fontFamily: '"Playfair Display", serif',
  fontSize: size,
  fontWeight: weight,
  color,
})

const statusConfig = {
  reading: { label: 'Reading', color: '#A0673A', bg: 'rgba(160,103,58,0.10)' },
  finished: { label: 'Finished', color: '#5A7A62', bg: 'rgba(90,122,98,0.10)' },
  'want-to-read': { label: 'Want to Read', color: '#6B6560', bg: 'rgba(107,101,96,0.10)' },
} as const

const StatusPill = ({ status }: { status: BookItem['status'] }) => {
  const cfg = statusConfig[status]
  return (
    <span
      style={{
        ...inter(10, 500, cfg.color),
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        background: cfg.bg,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {cfg.label}
    </span>
  )
}

const CardRow = ({ book }: { book: LibraryPresentationModel['previewRows'][number] }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
    <div
      style={{
        width: 34,
        height: 46,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: 3,
        boxShadow: '2px 2px 8px rgba(58,55,51,0.15), inset -1px 0 0 rgba(0,0,0,0.08)',
        background: 'rgba(58,55,51,0.08)',
      }}
    >
      {book.coverUrl ? <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} /> : null}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <p style={{ ...playfair(13, 500), lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</p>
      </div>
      <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.50)'), lineHeight: 1, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {book.authorLine}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 2, overflow: 'hidden', borderRadius: 999, background: 'rgba(58,55,51,0.10)' }}>
          <div style={{ width: `${book.progress}%`, height: '100%', borderRadius: 999, background: book.statusColor }} />
        </div>
      </div>
    </div>
  </div>
)

const SidebarBookItem = ({ book, selected, onClick }: { book: BookItem; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderRadius: 16,
      textAlign: 'left',
      background: selected ? 'rgba(58,55,51,0.06)' : 'transparent',
      border: selected ? '1px solid rgba(58,55,51,0.10)' : '1px solid transparent',
      cursor: 'pointer',
    }}
  >
    <div
      style={{
        width: 36,
        height: 50,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: 3,
        boxShadow: '1px 2px 8px rgba(58,55,51,0.18), inset -1px 0 0 rgba(0,0,0,0.07)',
        background: 'rgba(58,55,51,0.08)',
      }}
    >
      {book.coverUrl ? <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} /> : null}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ ...playfair(13, 500), marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</p>
      <p style={{ ...inter(11, 400, mutedText), marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.authors.join(', ')}</p>
      <div style={{ height: 2, overflow: 'hidden', borderRadius: 999, background: 'rgba(58,55,51,0.08)' }}>
        <div style={{ width: `${book.progress}%`, height: '100%', borderRadius: 999, background: statusConfig[book.status].color }} />
      </div>
    </div>
    <div style={{ width: 6, height: 6, flexShrink: 0, borderRadius: 999, background: statusConfig[book.status].color, opacity: 0.8 }} />
  </button>
)

export const LibraryCardSurface = ({
  model,
  books,
  selectedBook,
  selectedBookId,
  open,
  loading,
  query,
  error,
  results,
  addingCandidateId,
  onOpen,
  onClose,
  onQueryChange,
  onSearch,
  onSelectBook,
  onAddBook,
  onPatchBook,
  onRemoveBook,
}: Props) => {
  const readingCount = books.filter((book) => book.status === 'reading').length
  const finishedCount = books.filter((book) => book.status === 'finished').length
  const wantToReadCount = books.filter((book) => book.status === 'want-to-read').length
  const previewBooks = model.previewRows.slice(0, 3)

  const filteredBooks = useMemo(() => books, [books])

  return (
    <>
      <div
        onClick={onOpen}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: books.length === 0 ? 280 : 0,
          overflow: 'hidden',
          borderRadius: 24,
          cursor: 'pointer',
          background: cardBg,
          border: '1px solid transparent',
          boxShadow: '0 12px 28px rgba(58, 55, 51, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid rgba(58,55,51,0.07)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <BookOpen size={14} color="rgba(58,55,51,0.40)" />
              <span style={{ ...inter(10, 600, 'rgba(58,55,51,0.40)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{model.header.eyebrow}</span>
            </div>
            <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>{model.header.title}</h3>
          </div>
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, color: 'rgba(58,55,51,0.40)' }}>
            <ChevronRight size={15} />
          </div>
        </div>

        <div style={{ flex: 1, padding: '0 20px' }}>
          {loading ? (
            <LifeCardLoader />
          ) : books.length === 0 ? (
            <div style={{ display: 'flex', flex: 1, minHeight: 180, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderRadius: 999, background: 'rgba(58,55,51,0.06)' }}>
                <BookOpen size={20} color="rgba(58,55,51,0.35)" />
              </div>
              <p style={{ ...playfair(14, 500), marginBottom: 6 }}>Your shelf is empty</p>
              <p style={{ ...inter(12, 400, mutedText), lineHeight: 1.5, marginBottom: 16 }}>Search for books by title,<br />author, or ISBN to begin.</p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen()
                }}
                style={{
                  ...inter(11, 500),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(58,55,51,0.08)',
                  border: '1px solid rgba(58,55,51,0.12)',
                  letterSpacing: '0.03em',
                }}
              >
                <Search size={11} />
                <span>Browse Library</span>
              </button>
            </div>
          ) : (
            <div>
              {previewBooks.map((book, index) => (
                <div key={book.id}>
                  <CardRow book={book} />
                  {index < previewBooks.length - 1 ? <div style={{ height: 1, background: 'rgba(58,55,51,0.06)' }} /> : null}
                </div>
              ))}
              {books.length > 3 ? (
                <div style={{ ...inter(11, 400, 'rgba(58,55,51,0.38)'), padding: '8px 0', textAlign: 'center', borderTop: '1px solid rgba(58,55,51,0.06)' }}>
                  +{books.length - 3} more {books.length - 3 === 1 ? 'book' : 'books'} on your shelf
                </div>
              ) : null}
            </div>
          )}
        </div>

        {!loading && books.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px', marginTop: 'auto', borderTop: '1px solid rgba(58,55,51,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: statusConfig.reading.color }} />
              <span style={{ ...inter(11, 500, mutedText) }}>Reading</span>
              <span style={{ ...inter(12, 600), marginLeft: 2 }}><AppNumber value={readingCount} animated /></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: statusConfig.finished.color }} />
              <span style={{ ...inter(11, 500, mutedText) }}>Finished</span>
              <span style={{ ...inter(12, 600), marginLeft: 2 }}><AppNumber value={finishedCount} animated /></span>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={open} onClose={onClose} panelClassName="life-modal__panel" contentClassName="life-modal__content">
        <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', background: paper }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: `1px solid ${subtleBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BookOpen size={16} color="rgba(58,55,51,0.40)" />
              <h1 style={{ ...playfair(22, 500) }}>Library</h1>
              <span style={{ ...inter(11, 500, mutedText), marginLeft: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(58,55,51,0.07)' }}>
                {books.length} {books.length === 1 ? 'book' : 'books'}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 999, background: 'transparent', color: 'rgba(58,55,51,0.40)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
            <div style={{ width: 300, display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: `1px solid ${subtleBorder}`, background: '#FAF8F5' }}>
              <div style={{ padding: '20px 16px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, borderRadius: 12, padding: '0 12px', background: 'rgba(58,55,51,0.06)', border: '1px solid rgba(58,55,51,0.09)' }}>
                  <Search size={13} color="rgba(58,55,51,0.35)" />
                  <input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onSearch()
                    }}
                    placeholder="Title, author, or ISBN..."
                    style={{ ...inter(13, 400), flex: 1, border: 'none', outline: 'none', background: 'transparent' }}
                  />
                  {query ? (
                    <button type="button" onClick={() => onQueryChange('')} style={{ border: 'none', background: 'transparent', color: 'rgba(58,55,51,0.35)', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              </div>

              {results.length > 0 ? (
                <div style={{ padding: '0 16px 12px', borderBottom: `1px solid ${subtleBorder}` }}>
                  <p style={{ ...inter(10, 500, 'rgba(58,55,51,0.38)'), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>Search Results</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {results.map((book) => (
                      <div key={book.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: cardBg, border: `1px solid ${subtleBorder}` }}>
                        <div style={{ width: 32, height: 44, flexShrink: 0, overflow: 'hidden', borderRadius: 3, background: 'rgba(58,55,51,0.08)' }}>
                          {book.coverUrl ? <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ ...playfair(13, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</p>
                          <p style={{ ...inter(11, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.authors.join(', ')}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAddBook(book.id)}
                          style={{
                            ...inter(11, 500, addingCandidateId === book.id ? statusConfig['want-to-read'].color : ink),
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 10px',
                            borderRadius: 999,
                            background: addingCandidateId === book.id ? statusConfig['want-to-read'].bg : 'rgba(58,55,51,0.07)',
                            border: `1px solid ${addingCandidateId === book.id ? 'rgba(107,101,96,0.15)' : 'rgba(58,55,51,0.10)'}`,
                            cursor: 'pointer',
                          }}
                        >
                          {addingCandidateId === book.id ? <CheckCheck size={11} /> : <Plus size={11} />}
                          <span>{addingCandidateId === book.id ? 'Added' : 'Add'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {error ? <p style={{ ...inter(12, 400, '#9D4C4C'), padding: '0 20px 12px' }}>{error}</p> : null}

              <div style={{ padding: '0 16px 12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { key: 'all', label: 'All', count: books.length },
                    { key: 'reading', label: 'Reading', count: readingCount },
                    { key: 'finished', label: 'Finished', count: finishedCount },
                    { key: 'want-to-read', label: 'Want to Read', count: wantToReadCount },
                  ].map((item, index) => (
                    <div
                      key={item.key}
                      style={{
                        ...inter(11, 500, index === 0 ? ink : mutedText),
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: index === 0 ? 'rgba(58,55,51,0.08)' : 'transparent',
                        border: index === 0 ? '1px solid rgba(58,55,51,0.10)' : '1px solid transparent',
                      }}
                    >
                      {item.label} {item.count}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ minHeight: 0, flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
                {loading ? (
                  <LifePanelLoader />
                ) : filteredBooks.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderRadius: 999, background: 'rgba(58,55,51,0.05)' }}>
                      <BookOpen size={20} color="rgba(58,55,51,0.25)" />
                    </div>
                    <p style={{ ...playfair(16, 500, 'rgba(58,55,51,0.60)'), marginBottom: 6 }}>Nothing on your shelf yet</p>
                    <p style={{ ...inter(12, 400, 'rgba(58,55,51,0.38)'), lineHeight: 1.65, marginBottom: 16 }}>Use the search above to find books and add them to your personal library.</p>
                    <button type="button" onClick={onSearch} style={{ ...inter(12, 500), display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: 'rgba(58,55,51,0.07)', border: '1px solid rgba(58,55,51,0.12)', cursor: 'pointer' }}>
                      <Search size={12} />
                      <span>Search for books</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredBooks.map((book) => (
                      <SidebarBookItem key={book.id} book={book} selected={selectedBookId === book.id} onClick={() => onSelectBook(book.id)} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', minWidth: 0, minHeight: 0, flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
              {selectedBook ? (
                <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', overflowY: 'auto' }}>
                  <div style={{ position: 'relative', display: 'flex', gap: 32, padding: '40px 40px 32px', borderBottom: `1px solid ${subtleBorder}` }}>
                    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.07 }}>
                      {selectedBook.coverUrl ? <img src={selectedBook.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(24px)', transform: 'scale(1.1)' }} /> : null}
                    </div>
                    <div style={{ position: 'relative', width: 110, height: 158, flexShrink: 0, overflow: 'hidden', borderRadius: 5, boxShadow: '4px 6px 20px rgba(58,55,51,0.22), 2px 2px 6px rgba(58,55,51,0.10), inset -2px 0 0 rgba(0,0,0,0.08)' }}>
                      {selectedBook.coverUrl ? <img src={selectedBook.coverUrl} alt={selectedBook.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} /> : null}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <StatusPill status={selectedBook.status} />
                      <h2 style={{ ...playfair(22, 500), lineHeight: 1.25, marginTop: 8, marginBottom: 4 }}>{selectedBook.title}</h2>
                      <p style={{ ...inter(14, 400, 'rgba(58,55,51,0.60)'), marginBottom: 12 }}>{selectedBook.authors.join(' & ')}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        {selectedBook.publisher ? <span style={inter(11, 400, mutedText)}><span style={{ opacity: 0.6 }}>Published by </span>{selectedBook.publisher}</span> : null}
                        {selectedBook.publisher && selectedBook.publishedDate ? <span style={{ color: 'rgba(58,55,51,0.20)' }}>·</span> : null}
                        {selectedBook.publishedDate ? <span style={inter(11, 400, mutedText)}>{selectedBook.publishedDate}</span> : null}
                      </div>
                      {selectedBook.subjects.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {selectedBook.subjects.map((subject) => (
                            <span key={subject} style={{ ...inter(10, 400, 'rgba(58,55,51,0.55)'), padding: '2px 8px', borderRadius: 999, background: 'rgba(58,55,51,0.06)', border: '1px solid rgba(58,55,51,0.09)', letterSpacing: '0.03em' }}>
                              {subject}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ padding: '24px 40px', borderBottom: `1px solid ${subtleBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                      <p style={{ ...inter(11, 500, mutedText), marginRight: 8, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Status</p>
                      {(['want-to-read', 'reading', 'finished'] as BookItem['status'][]).map((status) => {
                        const cfg = statusConfig[status]
                        const active = selectedBook.status === status
                        const Icon = status === 'want-to-read' ? Clock : status === 'reading' ? BookOpen : CheckCheck
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => onPatchBook({ status, progress: status === 'finished' ? 100 : selectedBook.progress })}
                            style={{
                              ...inter(11, active ? 500 : 400, active ? cfg.color : mutedText),
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 999,
                              background: active ? cfg.bg : 'transparent',
                              border: `1px solid ${active ? 'rgba(58,55,51,0.12)' : 'rgba(58,55,51,0.08)'}`,
                              cursor: 'pointer',
                            }}
                          >
                            <Icon size={12} />
                            <span>{cfg.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <p style={{ ...inter(11, 500, mutedText), letterSpacing: '0.07em', textTransform: 'uppercase' }}>Reading Progress</p>
                        <span style={inter(12, 600)}>{selectedBook.progress}%</span>
                      </div>
                      <ProgressTrack
                        value={selectedBook.progress}
                        onChange={(progress) => onPatchBook({ progress })}
                        label="Reading Progress"
                        showLabel={false}
                        color={statusConfig[selectedBook.status].color}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={inter(10, 400, 'rgba(58,55,51,0.30)')}>0%</span>
                        <span style={inter(10, 400, 'rgba(58,55,51,0.30)')}>50%</span>
                        <span style={inter(10, 400, 'rgba(58,55,51,0.30)')}>100%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '24px 40px', borderBottom: `1px solid ${subtleBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ color: mutedText }}><BookMarked size={13} /></span>
                      <p style={{ ...inter(11, 500, mutedText), letterSpacing: '0.07em', textTransform: 'uppercase' }}>My Reflection</p>
                    </div>
                    <textarea
                      value={selectedBook.reflection ?? ''}
                      onChange={(event) => onPatchBook({ reflection: event.target.value })}
                      placeholder="What stayed with you? A passage, a thought, a question this book left open..."
                      rows={5}
                      style={{
                        width: '100%',
                        resize: 'none',
                        outline: 'none',
                        borderRadius: 10,
                        border: '1px solid rgba(58,55,51,0.08)',
                        background: 'rgba(58,55,51,0.025)',
                        padding: '14px 16px',
                        fontFamily: '"Playfair Display", serif',
                        fontSize: 13,
                        fontStyle: selectedBook.reflection ? 'italic' : 'normal',
                        lineHeight: 1.75,
                        color: ink,
                      }}
                    />
                  </div>

                  {(selectedBook.description || selectedBook.summary) ? (
                    <div style={{ padding: '24px 40px', borderBottom: `1px solid ${subtleBorder}` }}>
                      <p style={{ ...inter(11, 500, mutedText), letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>About this Book</p>
                      {selectedBook.summary ? <p style={{ ...playfair(14, 400, 'rgba(58,55,51,0.75)'), fontStyle: 'italic', lineHeight: 1.65, marginBottom: 12 }}>"{selectedBook.summary}"</p> : null}
                      {selectedBook.description ? <p style={{ ...inter(13, 400, 'rgba(58,55,51,0.60)'), lineHeight: 1.75 }}>{selectedBook.description}</p> : null}
                    </div>
                  ) : null}

                  {(selectedBook.isbn10 || selectedBook.isbn13) ? (
                    <div style={{ padding: '16px 40px', borderBottom: `1px solid ${subtleBorder}` }}>
                      <p style={inter(11, 400, 'rgba(58,55,51,0.35)')}>
                        <span style={{ opacity: 0.7 }}>ISBN </span>
                        {selectedBook.isbn13 ?? selectedBook.isbn10}
                      </p>
                    </div>
                  ) : null}

                  <div style={{ padding: '24px 40px' }}>
                    <button
                      type="button"
                      onClick={() => onRemoveBook(selectedBook.id)}
                      style={{
                        ...inter(12, 400, 'rgba(58,55,51,0.35)'),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(58,55,51,0.08)',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Remove from Library</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderRadius: 18, background: 'rgba(58,55,51,0.05)', border: `1px solid ${subtleBorder}` }}>
                    <BookMarked size={22} color="rgba(58,55,51,0.25)" />
                  </div>
                  <p style={{ ...playfair(18, 500, 'rgba(58,55,51,0.55)'), marginBottom: 8 }}>Select a book to explore</p>
                  <p style={{ ...inter(13, 400, 'rgba(58,55,51,0.35)'), lineHeight: 1.65, maxWidth: 280 }}>Choose a title from your collection to view details, track your progress, and write a reflection.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}
