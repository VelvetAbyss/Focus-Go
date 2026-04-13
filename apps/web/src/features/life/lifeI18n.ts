import { useMemo } from 'react'
import { useI18n } from '../../shared/i18n/useI18n'

export type LifeKey =
  | 'life.card.library'
  | 'life.card.media'
  | 'life.card.dailyReview'
  | 'life.card.podcast'
  | 'life.card.people'
  | 'life.card.trips'
  | 'life.card.subscriptions'
  | 'life.dashboard.manageWidgets'
  | 'life.dashboard.editLayout'
  | 'life.library.emptyTitle'
  | 'life.library.emptyDescription'
  | 'life.library.browse'
  | 'life.library.reading'
  | 'life.library.finished'
  | 'life.library.wantToRead'
  | 'life.library.unknownAuthor'
  | 'life.media.emptyTitle'
  | 'life.media.emptyDescription'
  | 'life.media.watching'
  | 'life.media.finished'
  | 'life.media.queued'
  | 'life.media.all'
  | 'life.media.movies'
  | 'life.media.tv'
  | 'life.media.searchPlaceholder'
  | 'life.media.hint.tmdbMissing'
  | 'life.media.hint.searchFailed'
  | 'life.media.unknown'
  | 'life.daily.today'
  | 'life.daily.review'
  | 'life.daily.tasks'
  | 'life.daily.subtasks'
  | 'life.daily.focusMin'
  | 'life.daily.diary'
  | 'life.daily.noteChars'
  | 'life.daily.focusStay'
  | 'life.daily.yes'
  | 'life.daily.no'
  | 'life.daily.focusMinutes'
  | 'life.daily.diaryDays'
  | 'life.daily.notes'
  | 'life.daily.avg'
  | 'life.daily.last7Days'
  | 'life.daily.last30Days'
  | 'life.daily.viewReview'
  | 'life.daily.completed'
  | 'life.daily.completedTasks'
  | 'life.daily.noCompletedTasks'
  | 'life.daily.noCompletedTasksInRange'
  | 'life.daily.week'
  | 'life.daily.month'
  | 'life.daily.summary7days'
  | 'life.daily.summary30days'
  | 'life.daily.noSubtasks'
  | 'life.daily.subtasksCount'
  | 'life.people.emptyTitle'
  | 'life.people.emptyDescription'
  | 'life.people.addPerson'
  | 'life.people.count'
  | 'life.people.birthdayToday'
  | 'life.people.birthdayInDays'
  | 'life.people.lastContact'
  | 'life.people.noRecentNotes'
  | 'life.podcast.playing'
  | 'life.podcast.lastPlayed'
  | 'life.podcast.openOriginal'
  | 'life.podcast.openPlayer'
  | 'life.podcast.pause'
  | 'life.podcast.recentEpisodes'
  | 'life.podcast.stats'
  | 'life.podcast.netease'
  | 'life.podcast.apple'
  | 'life.podcast.error.noPlayable'
  | 'life.podcast.error.sourceUnavailable'
  | 'life.podcast.error.playbackBlocked'
  | 'life.podcast.error.playbackFailed'
  | 'life.podcast.error.import.login'
  | 'life.podcast.error.import.notDeployed'
  | 'life.podcast.error.import.invalidSession'
  | 'life.podcast.error.import.limit'
  | 'life.podcast.error.import.failed'
  | 'life.podcast.error.refresh.notDeployed'
  | 'life.podcast.error.refresh.invalidSession'
  | 'life.podcast.error.refresh.failed'
  | 'life.podcast.error.searchFailed'
  | 'life.subscriptions.monthly'
  | 'life.subscriptions.trackRecurring'
  | 'life.subscriptions.emptyDescription'
  | 'life.subscriptions.addSubscription'
  | 'life.subscriptions.manage'
  | 'life.subscriptions.moreServices'
  | 'life.subscriptions.paidSummary'
  | 'life.subscriptions.dueSoon'
  | 'life.subscriptions.entertainment'
  | 'life.subscriptions.music'
  | 'life.subscriptions.productivity'
  | 'life.subscriptions.cloud'
  | 'life.subscriptions.learning'
  | 'life.subscriptions.other'
  | 'life.trips.planNext'
  | 'life.trips.emptyDescription'
  | 'life.trips.checklist'
  | 'life.trips.days'
  | 'life.trips.travelers'
  | 'life.trips.status.planning'
  | 'life.trips.status.booked'
  | 'life.trips.status.active'
  | 'life.trips.status.completed'

type Values = Record<string, string | number>
type LifeLanguage = 'en' | 'zh'

const interpolate = (template: string, values?: Values) =>
  values ? template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(values[key] ?? `{{${key}}}`)) : template

const en: Record<LifeKey, string> = {
  'life.card.library': 'Library',
  'life.card.media': 'Media',
  'life.card.dailyReview': 'Daily Review',
  'life.card.podcast': 'Podcast',
  'life.card.people': 'People',
  'life.card.trips': 'Trips',
  'life.card.subscriptions': 'Subscriptions',
  'life.dashboard.manageWidgets': 'Manage life widgets',
  'life.dashboard.editLayout': 'Edit layout',
  'life.library.emptyTitle': 'Your shelf is empty',
  'life.library.emptyDescription': 'Search for books by title, author, or ISBN to begin.',
  'life.library.browse': 'Browse Library',
  'life.library.reading': 'Reading',
  'life.library.finished': 'Finished',
  'life.library.wantToRead': 'Want to Read',
  'life.library.unknownAuthor': 'Unknown author',
  'life.media.emptyTitle': 'Your watchlist is empty',
  'life.media.emptyDescription': 'Search for movies or TV shows to start your collection.',
  'life.media.watching': 'Watching',
  'life.media.finished': 'Finished',
  'life.media.queued': 'Queued',
  'life.media.all': 'All {{count}}',
  'life.media.movies': 'Movies {{count}}',
  'life.media.tv': 'TV {{count}}',
  'life.media.searchPlaceholder': 'Movie, series, director...',
  'life.media.hint.tmdbMissing': 'Set VITE_TMDB_API_KEY to enable TMDb search.',
  'life.media.hint.searchFailed': 'Media search failed. Try another title.',
  'life.media.unknown': 'Unknown',
  'life.daily.today': 'Today',
  'life.daily.review': 'Review',
  'life.daily.tasks': 'Tasks',
  'life.daily.subtasks': 'Subtasks',
  'life.daily.focusMin': 'Focus min',
  'life.daily.diary': 'Diary',
  'life.daily.noteChars': 'Note chars',
  'life.daily.focusStay': 'Focus stay',
  'life.daily.yes': 'Yes',
  'life.daily.no': 'No',
  'life.daily.focusMinutes': 'Focus Minutes',
  'life.daily.diaryDays': 'Diary Days',
  'life.daily.notes': 'Notes',
  'life.daily.avg': 'Avg.',
  'life.daily.last7Days': 'Last 7 days',
  'life.daily.last30Days': 'Last 30 days',
  'life.daily.viewReview': 'View review',
  'life.daily.completed': 'Completed',
  'life.daily.completedTasks': 'Completed Tasks',
  'life.daily.noCompletedTasks': 'No completed tasks',
  'life.daily.noCompletedTasksInRange': 'No completed tasks in this range.',
  'life.daily.week': 'Week',
  'life.daily.month': 'Month',
  'life.daily.summary7days': '7 days summary',
  'life.daily.summary30days': '30 days summary',
  'life.daily.noSubtasks': 'No subtasks',
  'life.daily.subtasksCount': '{{count}} subtasks',
  'life.people.emptyTitle': 'Keep your people close',
  'life.people.emptyDescription': 'Add important people and track birthdays or recent contact.',
  'life.people.addPerson': 'Add person',
  'life.people.count': '{{count}} people',
  'life.people.birthdayToday': 'Birthday today',
  'life.people.birthdayInDays': 'Birthday in {{days}} days',
  'life.people.lastContact': 'Last contact {{date}}',
  'life.people.noRecentNotes': 'No recent notes',
  'life.podcast.playing': 'PLAYING',
  'life.podcast.lastPlayed': 'LAST PLAYED',
  'life.podcast.openOriginal': 'Open Original',
  'life.podcast.openPlayer': 'Open Player',
  'life.podcast.pause': 'Pause',
  'life.podcast.recentEpisodes': 'Recent Episodes',
  'life.podcast.stats': '{{podcasts}} podcasts · {{episodes}} episodes',
  'life.podcast.netease': 'Netease (Open Original)',
  'life.podcast.apple': 'Apple Podcasts',
  'life.podcast.error.noPlayable': 'This episode has no playable audio URL yet.',
  'life.podcast.error.sourceUnavailable': 'This episode source is unavailable right now.',
  'life.podcast.error.playbackBlocked': 'Playback was blocked by the browser.',
  'life.podcast.error.playbackFailed': 'Podcast playback failed.',
  'life.podcast.error.import.login': 'Netease import requires login first.',
  'life.podcast.error.import.notDeployed': 'Netease import API is not deployed yet. Start or deploy focus-go-api first.',
  'life.podcast.error.import.invalidSession': 'Netease import requires a valid login session.',
  'life.podcast.error.import.limit': 'You can add up to {{limit}} Netease channels. Remove one to continue.',
  'life.podcast.error.import.failed': 'Netease podcast import failed. Check the channel link.',
  'life.podcast.error.refresh.notDeployed': 'Netease sync API is not deployed yet. Start or deploy focus-go-api first.',
  'life.podcast.error.refresh.invalidSession': 'Netease sync requires a valid login session.',
  'life.podcast.error.refresh.failed': 'Podcast refresh failed. Try again later.',
  'life.podcast.error.searchFailed': 'Podcast search failed. Try another title.',
  'life.subscriptions.monthly': 'Monthly',
  'life.subscriptions.trackRecurring': 'Track recurring services',
  'life.subscriptions.emptyDescription': 'Save monthly and yearly subscriptions in one place.',
  'life.subscriptions.addSubscription': 'Add subscription',
  'life.subscriptions.manage': 'Manage',
  'life.subscriptions.moreServices': '+{{count}} more services',
  'life.subscriptions.paidSummary': '{{paid}}/{{total}} paid',
  'life.subscriptions.dueSoon': '{{count}} due soon',
  'life.subscriptions.entertainment': 'Entertainment',
  'life.subscriptions.music': 'Music',
  'life.subscriptions.productivity': 'Productivity',
  'life.subscriptions.cloud': 'Cloud & Storage',
  'life.subscriptions.learning': 'Learning',
  'life.subscriptions.other': 'Other',
  'life.trips.planNext': 'Plan your next trip',
  'life.trips.emptyDescription': 'Open the trips workspace to create an itinerary, budget, and checklist.',
  'life.trips.checklist': 'Checklist',
  'life.trips.days': '{{count}} days',
  'life.trips.travelers': '{{count}} travelers',
  'life.trips.status.planning': 'Planning',
  'life.trips.status.booked': 'Booked',
  'life.trips.status.active': 'Active',
  'life.trips.status.completed': 'Completed',
}

const zh: Record<LifeKey, string> = {
  'life.card.library': '书库',
  'life.card.media': '影音',
  'life.card.dailyReview': '每日复盘',
  'life.card.podcast': '播客',
  'life.card.people': '人际',
  'life.card.trips': '旅行',
  'life.card.subscriptions': '订阅',
  'life.dashboard.manageWidgets': '管理 Life 组件',
  'life.dashboard.editLayout': '编辑布局',
  'life.library.emptyTitle': '你的书架还是空的',
  'life.library.emptyDescription': '按书名、作者或 ISBN 搜索，开始建立你的书架。',
  'life.library.browse': '浏览书库',
  'life.library.reading': '在读',
  'life.library.finished': '读完',
  'life.library.wantToRead': '想读',
  'life.library.unknownAuthor': '未知作者',
  'life.media.emptyTitle': '你的片单还是空的',
  'life.media.emptyDescription': '搜索电影或剧集，开始建立你的收藏。',
  'life.media.watching': '在看',
  'life.media.finished': '看完',
  'life.media.queued': '待看',
  'life.media.all': '全部 {{count}}',
  'life.media.movies': '电影 {{count}}',
  'life.media.tv': '剧集 {{count}}',
  'life.media.searchPlaceholder': '电影、剧集、导演...',
  'life.media.hint.tmdbMissing': '设置 VITE_TMDB_API_KEY 后可启用 TMDb 搜索。',
  'life.media.hint.searchFailed': '搜索影音失败，请换个标题试试。',
  'life.media.unknown': '未知',
  'life.daily.today': '今天',
  'life.daily.review': '复盘',
  'life.daily.tasks': '任务',
  'life.daily.subtasks': '子任务',
  'life.daily.focusMin': '专注分钟',
  'life.daily.diary': '日记',
  'life.daily.noteChars': '笔记字数',
  'life.daily.focusStay': '专注停留',
  'life.daily.yes': '有',
  'life.daily.no': '无',
  'life.daily.focusMinutes': '专注时长',
  'life.daily.diaryDays': '写日记天数',
  'life.daily.notes': '笔记',
  'life.daily.avg': '平均',
  'life.daily.last7Days': '最近 7 天',
  'life.daily.last30Days': '最近 30 天',
  'life.daily.viewReview': '查看复盘',
  'life.daily.completed': '已完成',
  'life.daily.completedTasks': '完成任务',
  'life.daily.noCompletedTasks': '没有已完成任务',
  'life.daily.noCompletedTasksInRange': '当前时间范围内没有已完成任务。',
  'life.daily.week': '周',
  'life.daily.month': '月',
  'life.daily.summary7days': '7 天汇总',
  'life.daily.summary30days': '30 天汇总',
  'life.daily.noSubtasks': '没有子任务',
  'life.daily.subtasksCount': '{{count}} 个子任务',
  'life.people.emptyTitle': '把重要的人留在身边',
  'life.people.emptyDescription': '记录重要的人，并追踪生日或最近联系。',
  'life.people.addPerson': '添加联系人',
  'life.people.count': '{{count}} 人',
  'life.people.birthdayToday': '今天生日',
  'life.people.birthdayInDays': '{{days}} 天后生日',
  'life.people.lastContact': '最近联系 {{date}}',
  'life.people.noRecentNotes': '暂无最近记录',
  'life.podcast.playing': '播放中',
  'life.podcast.lastPlayed': '最近播放',
  'life.podcast.openOriginal': '打开原链接',
  'life.podcast.openPlayer': '打开播放器',
  'life.podcast.pause': '暂停',
  'life.podcast.recentEpisodes': '最近剧集',
  'life.podcast.stats': '{{podcasts}} 个播客 · {{episodes}} 集',
  'life.podcast.netease': '网易云（打开原链接）',
  'life.podcast.apple': 'Apple 播客',
  'life.podcast.error.noPlayable': '当前剧集还没有可播放音频。',
  'life.podcast.error.sourceUnavailable': '当前剧集来源暂时不可用。',
  'life.podcast.error.playbackBlocked': '浏览器阻止了播放。',
  'life.podcast.error.playbackFailed': '播客播放失败。',
  'life.podcast.error.import.login': '导入网易播客前需要先登录。',
  'life.podcast.error.import.notDeployed': '网易导入接口还未部署，请先启动或部署 focus-go-api。',
  'life.podcast.error.import.invalidSession': '网易导入需要有效登录态。',
  'life.podcast.error.import.limit': '最多只能添加 {{limit}} 个网易频道，请先删除一个。',
  'life.podcast.error.import.failed': '导入网易播客失败，请检查频道链接。',
  'life.podcast.error.refresh.notDeployed': '网易同步接口还未部署，请先启动或部署 focus-go-api。',
  'life.podcast.error.refresh.invalidSession': '网易同步需要有效登录态。',
  'life.podcast.error.refresh.failed': '刷新播客失败，请稍后再试。',
  'life.podcast.error.searchFailed': '搜索播客失败，请换个标题试试。',
  'life.subscriptions.monthly': '月度',
  'life.subscriptions.trackRecurring': '追踪周期性订阅',
  'life.subscriptions.emptyDescription': '把月付和年付订阅统一放在一处管理。',
  'life.subscriptions.addSubscription': '添加订阅',
  'life.subscriptions.manage': '管理',
  'life.subscriptions.moreServices': '+{{count}} 个服务',
  'life.subscriptions.paidSummary': '{{paid}}/{{total}} 已支付',
  'life.subscriptions.dueSoon': '{{count}} 个即将扣费',
  'life.subscriptions.entertainment': '娱乐',
  'life.subscriptions.music': '音乐',
  'life.subscriptions.productivity': '效率',
  'life.subscriptions.cloud': '云存储',
  'life.subscriptions.learning': '学习',
  'life.subscriptions.other': '其他',
  'life.trips.planNext': '规划下一次旅行',
  'life.trips.emptyDescription': '打开旅行工作区，创建行程、预算和清单。',
  'life.trips.checklist': '清单',
  'life.trips.days': '{{count}} 天',
  'life.trips.travelers': '{{count}} 位同行者',
  'life.trips.status.planning': '规划中',
  'life.trips.status.booked': '已预订',
  'life.trips.status.active': '进行中',
  'life.trips.status.completed': '已完成',
}

const messagesByLanguage: Record<LifeLanguage, Record<LifeKey, string>> = { en, zh }

export const lifeT = (language: LifeLanguage, key: LifeKey, values?: Values) =>
  interpolate(messagesByLanguage[language][key] ?? messagesByLanguage.en[key] ?? key, values)

export type LifeTranslate = (key: LifeKey, values?: Values) => string

export const useLifeI18n = () => {
  const { language } = useI18n()
  const t = useMemo(() => ((key: LifeKey, values?: Values) => lifeT(language, key, values)) as LifeTranslate, [language])
  return { language, t }
}
