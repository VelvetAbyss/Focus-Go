import type { BookItem, LifePerson, LifePodcast, LifeSubscription, MediaItem } from '../../../data/models/types'
import type { DailyReviewAnalytics } from './dailyReviewAnalytics'

const INK = '#3A3733'

const bookStatusConfig = {
  reading: { label: 'Reading', color: '#A0673A', bg: 'rgba(160, 103, 58, 0.10)' },
  finished: { label: 'Finished', color: '#5A7A62', bg: 'rgba(90, 122, 98, 0.10)' },
  'want-to-read': { label: 'Want to Read', color: '#6B6560', bg: 'rgba(107, 101, 96, 0.10)' },
} as const

const mediaStatusConfig = {
  watching: { label: 'Watching', color: '#7A6A9E', bg: 'rgba(122, 106, 158, 0.10)' },
  completed: { label: 'Finished', color: '#5A7A62', bg: 'rgba(90, 122, 98, 0.10)' },
  'want-to-watch': { label: 'Want to Watch', color: '#6B6560', bg: 'rgba(107, 101, 96, 0.10)' },
} as const

const subscriptionPalette = ['#E87070', '#6EAB7A', '#7AADE5', '#E8A85F', '#C07AC0', '#7ABDE5', '#89C0A0', '#D4A06A']
const categoryMap = [
  { match: /netflix|disney|prime|hbo|bilibili|youtube/i, label: 'Entertainment', emoji: '🎬' },
  { match: /spotify|apple music|qq music|网易云/i, label: 'Music', emoji: '🎵' },
  { match: /figma|notion|craft|todoist/i, label: 'Productivity', emoji: '💼' },
  { match: /icloud|dropbox|google one/i, label: 'Cloud & Storage', emoji: '☁️' },
  { match: /read|kindle|udemy|coursera/i, label: 'Learning', emoji: '📚' },
]

const hashValue = (value: string) => value.split('').reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7)
const pickColor = (value: string) => subscriptionPalette[Math.abs(hashValue(value)) % subscriptionPalette.length]
const formatMoney = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ''))
const currencySymbol = (currency: 'USD' | 'CNY') => (currency === 'CNY' ? '¥' : '$')
const yearlyToMonthly = (item: Pick<LifeSubscription, 'amount' | 'cycle'>) => (item.cycle === 'yearly' ? item.amount / 12 : item.amount)
const formatDate = (value: number) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0)
const yearFromDate = (value?: string) => (value ? value.slice(0, 4) : 'TBA')
const fallbackTaskTitle = (value?: string) => {
  const title = typeof value === 'string' ? value.trim() : ''
  return title || 'Untitled task'
}
const fallbackSubtaskTitle = (value?: string) => {
  const title = typeof value === 'string' ? value.trim() : ''
  return title || 'Untitled subtask'
}
const getDaysUntilBilling = (item: LifeSubscription, today = new Date()) => {
  if (!item.billingDay) return null
  if (item.cycle === 'yearly' && item.billingMonth && item.billingMonth !== today.getMonth() + 1) return null
  const delta = item.billingDay - today.getDate()
  return delta < 0 ? null : delta
}

export type LibraryPresentationModel = {
  header: { eyebrow: string; title: string; subTitle: string }
  previewRows: Array<{
    id: string
    title: string
    authorLine: string
    coverUrl?: string
    progress: number
    statusLabel: string
    statusColor: string
    statusBg: string
  }>
  stats: { reading: number; done: number }
}

export type MediaPresentationModel = {
  header: { eyebrow: string; title: string; subTitle: string }
  previewRows: Array<{
    id: string
    title: string
    posterUrl?: string
    type: 'movie' | 'tv'
    metaLine: string
    progress: number
    statusLabel: string
    statusColor: string
    statusBg: string
  }>
  stats: { watchingNow: number; completed: number }
}

export type DailyReviewPresentationModel = {
  header: { eyebrow: string; title: string; subTitle: string }
  todayMetrics: Array<{ key: string; label: string; value: string | number; accent?: string }>
  detailRanges: Record<
    'week' | 'month',
    {
      summary: Array<{ key: string; label: string; value: string | number; sub?: string }>
      tasks: Array<{ id: string; title: string; completedLabel: string; subtasks: Array<{ id: string; title: string; done: boolean }> }>
    }
  >
}

export type SubscriptionPresentationModel = {
  header: { eyebrow: string; title: string; subTitle: string }
  monthlyTotalLabel: string
  annualTotalLabel: string
  previewRows: Array<{
    id: string
    name: string
    color: string
    emoji: string
    categoryLabel: string
    priceLabel: string
    monthlyLabel: string
    isPaid: boolean
    dueSoonLabel: string | null
  }>
  stats: { activeServices: number; reminders: number; dueSoon: number }
}

export type PodcastPresentationModel = {
  nowPlaying: {
    title: string
    podcastName: string
    duration?: string
    isPlaying: boolean
    source: LifePodcast['source']
    coverColor: string
    coverEmoji: string
    artworkUrl?: string
  } | null
  recentEpisodes: Array<{
    id: string
    title: string
    duration?: string
    coverEmoji: string
  }>
  statsLabel: string
}

export type PeoplePresentationModel = {
  preview: Array<{
    id: string
    name: string
    group: LifePerson['group']
    avatarInitials: string
    avatarColor: string
    secondary: string
    birthdaySoon: boolean
  }>
  statsLabel: string
}

export const buildLibraryPresentationModel = (books: readonly BookItem[]): LibraryPresentationModel => ({
  header: { eyebrow: 'Library', title: 'Library', subTitle: 'Your Shelf' },
  previewRows: books.slice(0, 3).map((book) => ({
    id: book.id,
    title: book.title,
    authorLine: book.authors.join(', ') || 'Unknown author',
    coverUrl: book.coverUrl,
    progress: book.progress,
    statusLabel: bookStatusConfig[book.status].label,
    statusColor: bookStatusConfig[book.status].color,
    statusBg: bookStatusConfig[book.status].bg,
  })),
  stats: {
    reading: books.filter((book) => book.status === 'reading').length,
    done: books.filter((book) => book.status === 'finished').length,
  },
})

export const buildMediaPresentationModel = (items: readonly MediaItem[]): MediaPresentationModel => ({
  header: { eyebrow: 'Media', title: 'Media', subTitle: 'Watchlist' },
  previewRows: items.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    posterUrl: item.posterUrl,
    type: item.mediaType,
    metaLine: `${item.director ?? item.cast[0] ?? 'Unknown'} · ${yearFromDate(item.releaseDate)}`,
    progress: item.progress,
    statusLabel: mediaStatusConfig[item.status].label,
    statusColor: mediaStatusConfig[item.status].color,
    statusBg: mediaStatusConfig[item.status].bg,
  })),
  stats: {
    watchingNow: items.filter((item) => item.status === 'watching').length,
    completed: items.filter((item) => item.status === 'completed').length,
  },
})

const summaryToMetrics = (analytics: DailyReviewAnalytics) => [
  { key: 'tasks', label: 'Tasks', value: analytics.summary.completedTasks },
  { key: 'subtasks', label: 'Subtasks', value: analytics.summary.completedSubtasks },
  { key: 'focus', label: 'Focus min', value: analytics.summary.focusMinutes },
  { key: 'diary', label: 'Diary', value: analytics.summary.diaryWritten ? 'Yes' : 'No' },
  { key: 'notes', label: 'Note chars', value: analytics.summary.noteChars },
  { key: 'stay', label: 'Focus stay', value: `${analytics.summary.focusPresenceMinutes}m` },
] as const

const toDailyTasks = (analytics: DailyReviewAnalytics) =>
  analytics.completedTasks.map((task) => ({
    id: task.id,
    title: fallbackTaskTitle(task.title),
    completedLabel: formatDate(task.completedAt),
    subtasks: task.subtasks.map((subtask) => ({ id: subtask.id, title: fallbackSubtaskTitle(subtask.title), done: subtask.done })),
  }))

export const buildDailyReviewPresentationModel = (
  today: DailyReviewAnalytics,
  week: DailyReviewAnalytics,
  month: DailyReviewAnalytics,
): DailyReviewPresentationModel => ({
  header: { eyebrow: 'Today', title: 'Daily Review', subTitle: 'Review' },
  todayMetrics: [...summaryToMetrics(today)],
  detailRanges: {
    week: {
      summary: [
        { key: 'tasks', label: 'Tasks', value: week.summary.completedTasks },
        { key: 'subtasks', label: 'Subtasks', value: week.summary.completedSubtasks },
        { key: 'focus', label: 'Focus Minutes', value: week.summary.focusMinutes },
        { key: 'diary', label: 'Diary Days', value: week.summary.diaryWritten ? 1 : 0, sub: 'Last 7 days' },
        { key: 'notes', label: 'Notes', value: week.summary.noteChars },
        { key: 'stay', label: 'Focus Stay', value: `${average([week.summary.focusPresenceMinutes])}%`, sub: 'Avg.' },
      ],
      tasks: toDailyTasks(week),
    },
    month: {
      summary: [
        { key: 'tasks', label: 'Tasks', value: month.summary.completedTasks },
        { key: 'subtasks', label: 'Subtasks', value: month.summary.completedSubtasks },
        { key: 'focus', label: 'Focus Minutes', value: month.summary.focusMinutes },
        { key: 'diary', label: 'Diary Days', value: month.summary.diaryWritten ? 1 : 0, sub: 'Last 30 days' },
        { key: 'notes', label: 'Notes', value: month.summary.noteChars },
        { key: 'stay', label: 'Focus Stay', value: `${average([month.summary.focusPresenceMinutes])}%`, sub: 'Avg.' },
      ],
      tasks: toDailyTasks(month),
    },
  },
})

export const buildSubscriptionPresentationModel = (items: readonly LifeSubscription[]): SubscriptionPresentationModel => {
  const monthlyTotals = items.reduce<Record<'USD' | 'CNY', number>>(
    (sum, item) => {
      sum[item.currency] += yearlyToMonthly(item)
      return sum
    },
    { USD: 0, CNY: 0 },
  )
  const annualTotals = items.reduce<Record<'USD' | 'CNY', number>>(
    (sum, item) => {
      sum[item.currency] += item.cycle === 'yearly' ? item.amount : item.amount * 12
      return sum
    },
    { USD: 0, CNY: 0 },
  )

  const formatTotals = (totals: Record<'USD' | 'CNY', number>, suffix: string) =>
    (['USD', 'CNY'] as const)
      .filter((currency) => totals[currency] > 0)
      .map((currency) => `${currencySymbol(currency)}${formatMoney(totals[currency])}`)
      .join(' + ') + suffix

  const previewRows = items.slice(0, 3).map((item) => {
    const category = categoryMap.find((entry) => entry.match.test(item.name))
    const days = getDaysUntilBilling(item)
    return {
      id: item.id,
      name: item.name,
      color: item.color ?? pickColor(item.name),
      emoji: item.emoji ?? category?.emoji ?? '•',
      categoryLabel: item.category ?? category?.label ?? 'Other',
      priceLabel: `${currencySymbol(item.currency)}${formatMoney(item.amount)}/${item.cycle === 'yearly' ? 'yr' : 'mo'}`,
      monthlyLabel: `${currencySymbol(item.currency)}${formatMoney(yearlyToMonthly(item))}/mo`,
      isPaid: item.paymentStatus === 'paid',
      dueSoonLabel: days === null || days > 7 ? null : days === 0 ? 'today' : `${days}d`,
    }
  })

  return {
    header: { eyebrow: 'Monthly', title: 'Subscriptions', subTitle: 'Subscriptions' },
    monthlyTotalLabel: items.length ? formatTotals(monthlyTotals, ' /mo') : '$0 /mo',
    annualTotalLabel: items.length ? formatTotals(annualTotals, ' /yr') : '$0 /yr',
    previewRows,
    stats: {
      activeServices: items.length,
      reminders: items.filter((item) => item.reminder).length,
      dueSoon: items.filter((item) => {
        const days = getDaysUntilBilling(item)
        return days !== null && days <= 7
      }).length,
    },
  }
}

const groupColorMap: Record<LifePerson['group'], string> = {
  Family: '#E7C2B8',
  Friends: '#D5C7E8',
  Work: '#BDD3E4',
  Community: '#CBE0C3',
  Other: '#D8CFC7',
}

const daysUntilBirthday = (value?: string) => {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  const today = new Date()
  const next = new Date(today.getFullYear(), month - 1, day)
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / (24 * 60 * 60 * 1000))
}

export const buildPodcastPresentationModel = (items: readonly LifePodcast[]): PodcastPresentationModel => {
  const sorted = [...items].sort((left, right) => right.updatedAt - left.updatedAt)
  const active = sorted.find((item) => item.selectedEpisodeId || item.isPlaying) ?? sorted[0] ?? null
  const activeEpisode = active?.episodes.find((episode) => episode.id === active.selectedEpisodeId) ?? active?.episodes[0] ?? null
  const recentEpisodes = sorted.flatMap((podcast) =>
    podcast.episodes.slice(0, 5).map((episode) => ({
      id: `${podcast.id}:${episode.id}`,
      title: episode.title,
      duration: episode.duration,
      coverEmoji: podcast.coverEmoji ?? '🎙',
    })),
  ).slice(0, 30)

  return {
    nowPlaying: active && activeEpisode
      ? {
          title: activeEpisode.title,
          podcastName: active.name,
          duration: activeEpisode.duration,
          isPlaying: active.isPlaying === true,
          source: active.source,
          coverColor: active.coverColor ?? '#D8C2A6',
          coverEmoji: active.coverEmoji ?? '🎙',
          artworkUrl: active.artworkUrl,
        }
      : null,
    recentEpisodes,
    statsLabel: `${items.length} podcasts · ${items.reduce((sum, item) => sum + item.episodes.length, 0)} episodes`,
  }
}

export const buildPeoplePresentationModel = (items: readonly LifePerson[]): PeoplePresentationModel => {
  const preview = [...items]
    .sort((left, right) => {
      const leftBirthday = daysUntilBirthday(left.birthday) ?? 999
      const rightBirthday = daysUntilBirthday(right.birthday) ?? 999
      if (leftBirthday !== rightBirthday) return leftBirthday - rightBirthday
      return (right.lastInteraction ?? '').localeCompare(left.lastInteraction ?? '')
    })
    .slice(0, 3)
    .map((person) => {
      const birthdayDelta = daysUntilBirthday(person.birthday)
      const locationLine = [person.role, person.city].filter(Boolean).join(' · ')
      return {
        id: person.id,
        name: person.name,
        group: person.group,
        avatarInitials: person.avatarInitials,
        avatarColor: person.avatarColor ?? groupColorMap[person.group],
        secondary: birthdayDelta !== null && birthdayDelta <= 14
          ? birthdayDelta === 0 ? 'Birthday today' : `Birthday in ${birthdayDelta} days`
          : locationLine || (person.lastInteraction ? `Last contact ${person.lastInteraction}` : 'No recent notes'),
        birthdaySoon: birthdayDelta !== null && birthdayDelta <= 14,
      }
    })

  return {
    preview,
    statsLabel: `${items.length} people`,
  }
}

export const lifeDesignInk = INK
