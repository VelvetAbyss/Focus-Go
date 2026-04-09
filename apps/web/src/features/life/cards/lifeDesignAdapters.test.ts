import { describe, expect, it } from 'vitest'
import type { BookItem, LifeSubscription, MediaItem } from '../../../data/models/types'
import type { DailyReviewAnalytics } from './dailyReviewAnalytics'
import {
  buildDailyReviewPresentationModel,
  buildLibraryPresentationModel,
  buildMediaPresentationModel,
  buildSubscriptionPresentationModel,
} from './lifeDesignAdapters'

const makeBook = (overrides: Partial<BookItem> = {}): BookItem => ({
  id: overrides.id ?? 'book-1',
  createdAt: 1,
  updatedAt: 1,
  source: 'manual',
  sourceId: overrides.sourceId ?? 'book-1',
  title: overrides.title ?? 'Book',
  authors: overrides.authors ?? ['Author'],
  status: overrides.status ?? 'reading',
  progress: overrides.progress ?? 25,
  coverUrl: overrides.coverUrl,
  description: overrides.description,
  publisher: overrides.publisher,
  publishedDate: overrides.publishedDate,
  subjects: overrides.subjects ?? [],
  summary: overrides.summary,
  outline: overrides.outline,
  reflection: overrides.reflection,
  isbn10: overrides.isbn10,
  isbn13: overrides.isbn13,
  openLibraryKey: overrides.openLibraryKey,
  googleBooksId: overrides.googleBooksId,
  doi: overrides.doi,
  lastSyncedAt: overrides.lastSyncedAt,
})

const makeMedia = (overrides: Partial<MediaItem> = {}): MediaItem => ({
  id: overrides.id ?? 'media-1',
  createdAt: 1,
  updatedAt: 1,
  source: 'tmdb',
  sourceId: overrides.sourceId ?? '1',
  tmdbId: overrides.tmdbId ?? 1,
  mediaType: overrides.mediaType ?? 'movie',
  title: overrides.title ?? 'Title',
  originalTitle: overrides.originalTitle,
  status: overrides.status ?? 'watching',
  progress: overrides.progress ?? 40,
  posterUrl: overrides.posterUrl,
  backdropUrl: overrides.backdropUrl,
  overview: overrides.overview,
  releaseDate: overrides.releaseDate,
  director: overrides.director,
  cast: overrides.cast ?? [],
  genres: overrides.genres ?? [],
  voteAverage: overrides.voteAverage,
  lastSyncedAt: overrides.lastSyncedAt,
})

const makeSubscription = (overrides: Partial<LifeSubscription> = {}): LifeSubscription => ({
  id: overrides.id ?? 'sub-1',
  createdAt: 1,
  updatedAt: 1,
  name: overrides.name ?? 'Netflix',
  amount: overrides.amount ?? 12,
  currency: overrides.currency ?? 'USD',
  cycle: overrides.cycle ?? 'monthly',
})

describe('lifeDesignAdapters', () => {
  it('maps library rows into design-friendly preview and stats', () => {
    const model = buildLibraryPresentationModel([
      makeBook({ id: 'b1', title: 'The Lord of the Rings', authors: ['J. R. R. Tolkien'], progress: 72, status: 'reading' }),
      makeBook({ id: 'b2', title: 'Little Women', authors: ['Louisa May Alcott'], progress: 34, status: 'reading' }),
      makeBook({ id: 'b3', title: 'Dune', authors: ['Frank Herbert'], progress: 58, status: 'finished' }),
    ])

    expect(model.header.title).toBe('Library')
    expect(model.previewRows).toHaveLength(3)
    expect(model.previewRows[0]?.title).toBe('The Lord of the Rings')
    expect(model.stats.reading).toBe(2)
    expect(model.stats.done).toBe(1)
  })

  it('maps media rows into watchlist preview and derived labels', () => {
    const model = buildMediaPresentationModel([
      makeMedia({ id: 'm1', title: 'Severance', mediaType: 'tv', releaseDate: '2022-02-18', cast: ['Adam Scott'], progress: 68 }),
      makeMedia({ id: 'm2', title: 'Oppenheimer', mediaType: 'movie', releaseDate: '2023-07-21', status: 'completed', progress: 100 }),
    ])

    expect(model.header.title).toBe('Media')
    expect(model.previewRows[0]?.metaLine).toContain('2022')
    expect(model.stats.watchingNow).toBe(1)
    expect(model.stats.completed).toBe(1)
  })

  it('maps daily review analytics into card and detail panels', () => {
    const analytics: DailyReviewAnalytics = {
      summary: {
        completedTasks: 3,
        completedSubtasks: 5,
        focusMinutes: 90,
        diaryWritten: true,
        noteChars: 240,
        focusPresenceMinutes: 90,
      },
      completedTasks: [
        {
          id: 't1',
          title: 'Ship feature',
          completedAt: Date.parse('2026-04-08T08:00:00Z'),
          subtasks: [{ id: 's1', title: 'Verify', done: true }],
        },
      ],
    }

    const model = buildDailyReviewPresentationModel(analytics, analytics, analytics)

    expect(model.header.title).toBe('Daily Review')
    expect(model.todayMetrics).toHaveLength(6)
    expect(model.detailRanges.week.tasks[0]?.title).toBe('Ship feature')
  })

  it('falls back when completed task titles are empty', () => {
    const analytics: DailyReviewAnalytics = {
      summary: {
        completedTasks: 1,
        completedSubtasks: 1,
        focusMinutes: 10,
        diaryWritten: false,
        noteChars: 0,
        focusPresenceMinutes: 10,
      },
      completedTasks: [
        {
          id: 't-empty',
          title: '   ',
          completedAt: Date.parse('2026-04-08T08:00:00Z'),
          subtasks: [{ id: 's-empty', title: '', done: true }],
        },
      ],
    }

    const model = buildDailyReviewPresentationModel(analytics, analytics, analytics)

    expect(model.detailRanges.week.tasks[0]?.title).toBe('Untitled task')
    expect(model.detailRanges.week.tasks[0]?.subtasks[0]?.title).toBe('Untitled subtask')
  })

  it('maps subscriptions into grouped totals and visual metadata', () => {
    const model = buildSubscriptionPresentationModel([
      makeSubscription({ id: 's1', name: 'Netflix', amount: 15.99, currency: 'USD', cycle: 'monthly' }),
      makeSubscription({ id: 's2', name: '微信读书', amount: 30, currency: 'CNY', cycle: 'monthly' }),
      makeSubscription({ id: 's3', name: 'Adobe CC', amount: 240, currency: 'USD', cycle: 'yearly' }),
    ])

    expect(model.header.title).toBe('Subscriptions')
    expect(model.monthlyTotalLabel).toContain('$')
    expect(model.monthlyTotalLabel).toContain('¥')
    expect(model.previewRows).toHaveLength(3)
    expect(model.stats.activeServices).toBe(3)
  })
})
