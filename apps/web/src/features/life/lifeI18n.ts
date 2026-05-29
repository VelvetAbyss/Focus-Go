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
  | 'life.podcast.sequenceMode'
  | 'life.podcast.shuffleMode'
  | 'life.podcast.sequenceShort'
  | 'life.podcast.shuffleShort'
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
  | 'life.subscriptions.health'
  | 'life.subscriptions.security'
  | 'life.subscriptions.developer'
  | 'life.subscriptions.news'
  | 'life.subscriptions.other'
  | 'life.subscriptions.overview'
  | 'life.subscriptions.monthlyTotal'
  | 'life.subscriptions.noTrackedYet'
  | 'life.subscriptions.noDataYet'
  | 'life.subscriptions.addToSeeOverview'
  | 'life.subscriptions.annualOverview'
  | 'life.subscriptions.exchangeRate'
  | 'life.subscriptions.unifiedEstimate'
  | 'life.subscriptions.monthlyBurden'
  | 'life.subscriptions.byCategoryAnnual'
  | 'life.subscriptions.dueWithinDays'
  | 'life.subscriptions.today'
  | 'life.subscriptions.inDays'
  | 'life.subscriptions.emptyListTitle'
  | 'life.subscriptions.emptyListDescription'
  | 'life.subscriptions.newSubscription'
  | 'life.subscriptions.basics'
  | 'life.subscriptions.serviceName'
  | 'life.subscriptions.serviceNamePlaceholder'
  | 'life.subscriptions.amount'
  | 'life.subscriptions.currency'
  | 'life.subscriptions.billingCycle'
  | 'life.subscriptions.yearly'
  | 'life.subscriptions.perMonth'
  | 'life.subscriptions.estFromYearly'
  | 'life.subscriptions.category'
  | 'life.subscriptions.schedule'
  | 'life.subscriptions.billingDay'
  | 'life.subscriptions.billingDayPlaceholder'
  | 'life.subscriptions.billingMonth'
  | 'life.subscriptions.billingMonthPlaceholder'
  | 'life.subscriptions.reminderOn'
  | 'life.subscriptions.noReminder'
  | 'life.subscriptions.appearance'
  | 'life.subscriptions.icon'
  | 'life.subscriptions.iconSearchHint'
  | 'life.subscriptions.iconSearching'
  | 'life.subscriptions.noIconsFound'
  | 'life.subscriptions.colour'
  | 'life.subscriptions.paymentStatus'
  | 'life.subscriptions.unpaid'
  | 'life.subscriptions.paid'
  | 'life.subscriptions.paymentStatusHint'
  | 'life.subscriptions.cancel'
  | 'life.subscriptions.remove'
  | 'life.subscriptions.autoSaved'
  | 'life.subscriptions.servicesCount'
  | 'life.subscriptions.allCount'
  | 'life.subscriptions.unpaidCount'
  | 'life.subscriptions.paidCount'
  | 'life.subscriptions.noFiltered'
  | 'life.subscriptions.yearlyHint'
  | 'life.subscriptions.close'
  | 'life.trips.planNext'
  | 'life.trips.emptyDescription'
  | 'life.trips.checklist'
  | 'life.trips.days'
  | 'life.trips.travelers'
  | 'life.trips.status.planning'
  | 'life.trips.status.booked'
  | 'life.trips.status.active'
  | 'life.trips.status.completed'
  | 'life.trips.title'
  | 'life.trips.dashboard'
  | 'life.trips.description'
  | 'life.trips.newTrip'
  | 'life.trips.creating'
  | 'life.trips.createTrip'
  | 'life.trips.deleteConfirm'
  | 'life.trips.noTrips'
  | 'life.trips.noTripsDesc'
  | 'life.trips.destinationPending'
  | 'life.trips.dateTo'
  | 'life.trips.daysCount'
  | 'life.trips.travelersCount'
  | 'life.trips.detail.overview'
  | 'life.trips.detail.itinerary'
  | 'life.trips.detail.transport'
  | 'life.trips.detail.stay'
  | 'life.trips.detail.food'
  | 'life.trips.detail.budget'
  | 'life.trips.detail.notes'
  | 'life.trips.detail.allTrips'
  | 'life.trips.detail.tripWorkspace'
  | 'life.trips.detail.tripPlanner'
  | 'life.trips.detail.daysLabel'
  | 'life.trips.detail.travelersLabel'
  | 'life.trips.detail.doneLabel'
  | 'life.trips.detail.saving'
  | 'life.trips.detail.saved'
  | 'life.trips.detail.retry'
  | 'life.trips.detail.tripNotFound'
  | 'life.trips.detail.tripNotFoundDesc'
  | 'life.trips.detail.backToTrips'
  | 'life.trips.detail.duration'
  | 'life.trips.detail.destinationPending'
  | 'life.trips.detail.deleteConfirm'
  | 'life.trips.detail.deleteTrip'
  | 'life.trips.detail.export'
  | 'life.trips.detail.exportPdf'
  | 'life.trips.detail.exportIcal'
  | 'life.trips.detail.nextActions'
  | 'life.trips.detail.addDay'
  | 'life.trips.detail.addActivity'
  | 'life.trips.detail.addRoute'
  | 'life.trips.detail.addStay'
  | 'life.trips.detail.addPlace'
  | 'life.trips.detail.addBudgetItem'
  | 'life.trips.detail.addGroup'
  | 'life.trips.detail.addItem'
  | 'life.trips.detail.remove'
  | 'life.trips.detail.removeDay'
  | 'life.trips.detail.overallProgress'
  | 'life.trips.detail.datePending'
  | 'life.trips.detail.planned'
  | 'life.trips.detail.estimated'
  | 'life.trips.detail.actual'
  | 'life.trips.detail.remaining'
  | 'life.trips.detail.split.total'
  | 'life.trips.detail.split.perPerson'
  | 'life.trips.detail.split.perDay'
  | 'life.trips.detail.split.perPersonNote'
  | 'life.trips.detail.split.perDayNote'
  | 'life.trips.detail.breakdown'
  | 'life.trips.detail.balance'
  | 'life.trips.detail.left'
  | 'life.trips.detail.over'
  | 'life.trips.detail.overrunWarn'
  | 'life.trips.detail.addPackTemplate'
  | 'life.trips.detail.packedCount'
  | 'life.trips.detail.tripMemo'
  | 'life.trips.filter.all'
  | 'life.trips.filter.planning'
  | 'life.trips.filter.booked'
  | 'life.trips.filter.ongoing'
  | 'life.trips.filter.done'
  | 'life.trips.countdown.dminus'
  | 'life.trips.countdown.today'
  | 'life.trips.countdown.ongoing'
  | 'life.trips.countdown.ended'
  | 'life.trips.readiness.title'
  | 'life.trips.readiness.transport'
  | 'life.trips.readiness.stays'
  | 'life.trips.readiness.food'
  | 'life.trips.readinessConfirmed'
  | 'life.trips.budgetTitle'
  | 'life.trips.budgetUsed'
  | 'life.trips.budgetOverrun'
  | 'life.trips.budgetUntracked'
  | 'life.trips.checklistTitle'
  | 'life.trips.highlightsTitle'
  | 'life.trips.openWorkspace'
  | 'life.trips.view.grid'
  | 'life.trips.view.timeline'
  | 'life.trips.view.calendar'
  | 'life.trips.calendar.prev'
  | 'life.trips.calendar.next'
  | 'life.trips.calendar.today'
  | 'life.trips.calendar.empty'
  | 'life.trips.timeline.undated'
  | 'life.trips.card.now'
  | 'life.trips.card.next'
  | 'life.trips.card.freeDay'
  | 'life.trips.card.dayOf'
  | 'life.trips.card.inMinutes'
  | 'life.trips.card.inHours'
  | 'life.trips.card.packing'
  | 'life.trips.card.todo'
  | 'life.trips.card.allSet'
  | 'life.trips.card.openTrip'
  | 'life.trips.card.templates'
  | 'life.trips.card.startTemplate'
  | 'life.trips.nextDeparture'
  | 'life.trips.shape'
  | 'life.trips.summary.upcoming'
  | 'life.trips.summary.ongoing'
  | 'life.trips.summary.past'
  | 'life.trips.summary.total'
  | 'life.library.title'
  | 'life.library.bookCount'
  | 'life.library.searchPlaceholder'
  | 'life.library.searchResults'
  | 'life.library.all'
  | 'life.library.add'
  | 'life.library.added'
  | 'life.library.shelfEmpty'
  | 'life.library.searchAbove'
  | 'life.library.searchForBooks'
  | 'life.library.publishedBy'
  | 'life.library.status'
  | 'life.library.readingProgress'
  | 'life.library.myReflection'
  | 'life.library.aboutBook'
  | 'life.library.removeFromLibrary'
  | 'life.library.selectBook'
  | 'life.library.selectBookDesc'
  | 'life.library.moreBooks'
  | 'life.media.noMedia'
  | 'life.media.status'
  | 'life.media.progress'
  | 'life.media.myNotes'
  | 'life.media.synopsis'
  | 'life.media.selectTitle'
  | 'life.media.wantToWatch'
  | 'life.people.title'
  | 'life.people.newPerson'
  | 'life.people.name'
  | 'life.people.category'
  | 'life.people.group'
  | 'life.people.role'
  | 'life.people.city'
  | 'life.people.email'
  | 'life.people.phone'
  | 'life.people.birthday'
  | 'life.people.lastInteraction'
  | 'life.people.initials'
  | 'life.people.avatarColor'
  | 'life.people.notes'
  | 'life.people.save'
  | 'life.people.remove'
  | 'life.podcast.emptyTitle'
  | 'life.podcast.emptyDescription'
  | 'life.podcast.findPodcast'
  | 'life.podcast.searchPlaceholder'
  | 'life.podcast.neteaseChannel'
  | 'life.podcast.presetChannel'
  | 'life.podcast.import'
  | 'life.podcast.nowPlaying'
  | 'life.podcast.play'
  | 'life.podcast.viewOnApple'
  | 'life.podcast.openChannel'
  | 'life.podcast.refresh'
  | 'life.podcast.remove'
  | 'life.podcast.episodes'
  | 'life.podcast.noDate'
  | 'life.podcast.openInApple'
  | 'life.podcast.searchStart'
  | 'life.podcast.metadataApple'
  | 'life.podcast.search'

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
  'life.podcast.sequenceMode': 'Play episodes in order',
  'life.podcast.shuffleMode': 'Play random episodes',
  'life.podcast.sequenceShort': 'Order',
  'life.podcast.shuffleShort': 'Random',
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
  'life.subscriptions.health': 'Health & Fitness',
  'life.subscriptions.security': 'Security',
  'life.subscriptions.developer': 'Developer Tools',
  'life.subscriptions.news': 'News & Media',
  'life.subscriptions.other': 'Other',
  'life.subscriptions.overview': 'Overview',
  'life.subscriptions.monthlyTotal': 'Monthly total',
  'life.subscriptions.noTrackedYet': 'No subscriptions tracked yet',
  'life.subscriptions.noDataYet': 'No data yet',
  'life.subscriptions.addToSeeOverview': 'Add subscriptions to see your annual overview.',
  'life.subscriptions.annualOverview': 'Annual overview · {{year}}',
  'life.subscriptions.exchangeRate': 'Exchange rate',
  'life.subscriptions.unifiedEstimate': 'Unified (est.)',
  'life.subscriptions.monthlyBurden': 'Monthly burden',
  'life.subscriptions.byCategoryAnnual': 'By category · annual',
  'life.subscriptions.dueWithinDays': 'Due within {{count}} days',
  'life.subscriptions.today': 'Today',
  'life.subscriptions.inDays': 'In {{count}}d',
  'life.subscriptions.emptyListTitle': 'No subscriptions yet.',
  'life.subscriptions.emptyListDescription': 'Create your first one.',
  'life.subscriptions.newSubscription': 'New Subscription',
  'life.subscriptions.basics': 'Basics',
  'life.subscriptions.serviceName': 'Service name',
  'life.subscriptions.serviceNamePlaceholder': 'e.g. Netflix, iCloud+',
  'life.subscriptions.amount': 'Amount',
  'life.subscriptions.currency': 'Currency',
  'life.subscriptions.billingCycle': 'Billing cycle',
  'life.subscriptions.yearly': 'Yearly',
  'life.subscriptions.perMonth': 'per month',
  'life.subscriptions.estFromYearly': '(est. from {{amount}}/yr)',
  'life.subscriptions.category': 'Category',
  'life.subscriptions.schedule': 'Schedule',
  'life.subscriptions.billingDay': 'Billing day',
  'life.subscriptions.billingDayPlaceholder': 'Day (1–31)',
  'life.subscriptions.billingMonth': 'Billing month',
  'life.subscriptions.billingMonthPlaceholder': 'Month (1–12)',
  'life.subscriptions.reminderOn': 'Renewal reminder on',
  'life.subscriptions.noReminder': 'No reminder',
  'life.subscriptions.appearance': 'Appearance',
  'life.subscriptions.icon': 'Icon',
  'life.subscriptions.iconSearchHint': 'Enter a service name to auto-search icons.',
  'life.subscriptions.iconSearching': 'Searching…',
  'life.subscriptions.noIconsFound': 'No icons found.',
  'life.subscriptions.colour': 'Colour',
  'life.subscriptions.paymentStatus': 'Payment status',
  'life.subscriptions.unpaid': 'Unpaid',
  'life.subscriptions.paid': 'Paid ✓',
  'life.subscriptions.paymentStatusHint': 'Mark whether this period\'s payment has been made.',
  'life.subscriptions.cancel': 'Cancel',
  'life.subscriptions.remove': 'Remove',
  'life.subscriptions.autoSaved': 'Auto-saved',
  'life.subscriptions.servicesCount': '{{count}} services',
  'life.subscriptions.allCount': 'All {{count}}',
  'life.subscriptions.unpaidCount': 'Unpaid {{count}}',
  'life.subscriptions.paidCount': 'Paid {{count}}',
  'life.subscriptions.noFiltered': 'No {{status}} subscriptions',
  'life.subscriptions.yearlyHint': 'Yearly prices shown as estimated monthly. Currencies listed separately.',
  'life.subscriptions.close': 'Close',
  'life.trips.planNext': 'Plan your next trip',
  'life.trips.emptyDescription': 'Open the trips workspace to create an itinerary, budget, and checklist.',
  'life.trips.checklist': 'Checklist',
  'life.trips.days': '{{count}} days',
  'life.trips.travelers': '{{count}} travelers',
  'life.trips.status.planning': 'Planning',
  'life.trips.status.booked': 'Booked',
  'life.trips.status.active': 'Active',
  'life.trips.status.completed': 'Completed',
  'life.trips.title': 'Trips',
  'life.trips.dashboard': 'Dashboard',
  'life.trips.description': 'Build trips, open a detail workspace, and keep plans updated automatically.',
  'life.trips.newTrip': 'New Trip',
  'life.trips.creating': 'Creating…',
  'life.trips.createTrip': 'Create Trip',
  'life.trips.deleteConfirm': 'Delete this trip?',
  'life.trips.noTrips': 'No trips yet',
  'life.trips.noTripsDesc': 'Create the first trip to open the planning workspace.',
  'life.trips.destinationPending': 'Destination pending',
  'life.trips.dateTo': ' to ',
  'life.trips.daysCount': '{{count}} days',
  'life.trips.travelersCount': '{{count}} travelers',
  'life.trips.detail.overview': 'Overview',
  'life.trips.detail.itinerary': 'Itinerary',
  'life.trips.detail.transport': 'Transport',
  'life.trips.detail.stay': 'Stay',
  'life.trips.detail.food': 'Food',
  'life.trips.detail.budget': 'Budget',
  'life.trips.detail.notes': 'Notes',
  'life.trips.detail.allTrips': 'All Trips',
  'life.trips.detail.tripWorkspace': 'Trip Workspace',
  'life.trips.detail.tripPlanner': 'Trip planner',
  'life.trips.detail.daysLabel': 'Days',
  'life.trips.detail.travelersLabel': 'Travelers',
  'life.trips.detail.doneLabel': 'Done',
  'life.trips.detail.saving': 'Saving…',
  'life.trips.detail.saved': 'Saved',
  'life.trips.detail.retry': 'Retry',
  'life.trips.detail.tripNotFound': 'Trip not found',
  'life.trips.detail.tripNotFoundDesc': 'This trip was removed or the link is no longer valid.',
  'life.trips.detail.backToTrips': 'Back to Trips',
  'life.trips.detail.duration': 'Duration',
  'life.trips.detail.destinationPending': 'Destination pending',
  'life.trips.detail.deleteConfirm': 'Delete this trip?',
  'life.trips.detail.deleteTrip': 'Delete Trip',
  'life.trips.detail.export': 'Export',
  'life.trips.detail.exportPdf': 'Export PDF',
  'life.trips.detail.exportIcal': 'Export iCal (.ics)',
  'life.trips.detail.nextActions': 'Next Actions',
  'life.trips.detail.addDay': 'Add Day',
  'life.trips.detail.addActivity': 'Add Activity',
  'life.trips.detail.addRoute': 'Add Route',
  'life.trips.detail.addStay': 'Add Stay',
  'life.trips.detail.addPlace': 'Add Place',
  'life.trips.detail.addBudgetItem': 'Add Budget Item',
  'life.trips.detail.addGroup': 'Add Group',
  'life.trips.detail.addItem': 'Add Item',
  'life.trips.detail.remove': 'Remove',
  'life.trips.detail.removeDay': 'Remove Day',
  'life.trips.detail.overallProgress': 'Overall progress',
  'life.trips.detail.datePending': 'Date pending',
  'life.trips.detail.planned': 'Planned',
  'life.trips.detail.estimated': 'Estimated',
  'life.trips.detail.actual': 'Actual',
  'life.trips.detail.remaining': 'Remaining',
  'life.trips.detail.split.total': 'Total',
  'life.trips.detail.split.perPerson': 'Per person',
  'life.trips.detail.split.perDay': 'Per day',
  'life.trips.detail.split.perPersonNote': 'Split across {{count}} travelers',
  'life.trips.detail.split.perDayNote': 'Split across {{count}} days',
  'life.trips.detail.breakdown': 'Breakdown',
  'life.trips.detail.balance': 'Balance',
  'life.trips.detail.left': 'left',
  'life.trips.detail.over': 'Over by ${{count}}',
  'life.trips.detail.overrunWarn': 'Spending is {{count}}% of plan',
  'life.trips.detail.addPackTemplate': 'Packing template',
  'life.trips.detail.packedCount': '{{done}} of {{total}} packed',
  'life.trips.detail.tripMemo': 'Trip memo',
  'life.trips.filter.all': 'All',
  'life.trips.filter.planning': 'Planning',
  'life.trips.filter.booked': 'Booked',
  'life.trips.filter.ongoing': 'Ongoing',
  'life.trips.filter.done': 'Past',
  'life.trips.countdown.dminus': 'D-{{count}}',
  'life.trips.countdown.today': 'Departing today',
  'life.trips.countdown.ongoing': 'Ongoing',
  'life.trips.countdown.ended': 'Wrapped',
  'life.trips.readiness.title': 'Readiness',
  'life.trips.readiness.transport': 'Transport',
  'life.trips.readiness.stays': 'Stays',
  'life.trips.readiness.food': 'Food',
  'life.trips.readinessConfirmed': '{{done}}/{{total}} confirmed',
  'life.trips.budgetTitle': 'Budget',
  'life.trips.budgetUsed': '{{pct}}% used · ${{used}}',
  'life.trips.budgetOverrun': 'Over by ${{amount}}',
  'life.trips.budgetUntracked': 'No spend logged yet',
  'life.trips.checklistTitle': 'Checklist',
  'life.trips.highlightsTitle': 'Highlights',
  'life.trips.openWorkspace': 'Open workspace →',
  'life.trips.view.grid': 'Grid',
  'life.trips.view.timeline': 'Timeline',
  'life.trips.view.calendar': 'Calendar',
  'life.trips.calendar.prev': 'Previous month',
  'life.trips.calendar.next': 'Next month',
  'life.trips.calendar.today': 'Today',
  'life.trips.calendar.empty': 'No trips this month',
  'life.trips.timeline.undated': 'Dates pending',
  'life.trips.card.now': 'Now',
  'life.trips.card.next': 'Next',
  'life.trips.card.freeDay': 'No plans today — explore freely',
  'life.trips.card.dayOf': 'Day {{count}}',
  'life.trips.card.inMinutes': 'in {{count}} min',
  'life.trips.card.inHours': 'in {{count}} h',
  'life.trips.card.packing': 'Packing',
  'life.trips.card.todo': 'To do',
  'life.trips.card.allSet': "You're all set",
  'life.trips.card.openTrip': 'Open trip',
  'life.trips.card.templates': 'Start from a template',
  'life.trips.card.startTemplate': 'Plan your next escape',
  'life.trips.nextDeparture': 'Next departure',
  'life.trips.shape': 'Trip shape',
  'life.trips.summary.upcoming': 'Upcoming',
  'life.trips.summary.ongoing': 'Ongoing',
  'life.trips.summary.past': 'Past',
  'life.trips.summary.total': 'Total',
  'life.library.title': 'Library',
  'life.library.bookCount': '{{count}} books',
  'life.library.searchPlaceholder': 'Title, author, or ISBN...',
  'life.library.searchResults': 'Search Results',
  'life.library.all': 'All',
  'life.library.add': 'Add',
  'life.library.added': 'Added',
  'life.library.shelfEmpty': 'Nothing on your shelf yet',
  'life.library.searchAbove': 'Use the search above to find books and add them to your personal library.',
  'life.library.searchForBooks': 'Search for books',
  'life.library.publishedBy': 'Published by ',
  'life.library.status': 'Status',
  'life.library.readingProgress': 'Reading Progress',
  'life.library.myReflection': 'My Reflection',
  'life.library.aboutBook': 'About this Book',
  'life.library.removeFromLibrary': 'Remove from Library',
  'life.library.selectBook': 'Select a book to explore',
  'life.library.selectBookDesc': 'Choose a title from your collection to view details, track your progress, and write a reflection.',
  'life.library.moreBooks': '+{{count}} more books on your shelf',
  'life.media.noMedia': 'No media yet.',
  'life.media.status': 'Status',
  'life.media.progress': 'Progress',
  'life.media.myNotes': 'My Notes',
  'life.media.synopsis': 'Synopsis',
  'life.media.selectTitle': 'Select a title to inspect details.',
  'life.media.wantToWatch': 'Want to Watch',
  'life.people.title': 'People',
  'life.people.newPerson': 'New person',
  'life.people.name': 'Name',
  'life.people.category': 'Category',
  'life.people.group': 'Group',
  'life.people.role': 'Role',
  'life.people.city': 'City',
  'life.people.email': 'Email',
  'life.people.phone': 'Phone',
  'life.people.birthday': 'Birthday',
  'life.people.lastInteraction': 'Last Interaction',
  'life.people.initials': 'Initials',
  'life.people.avatarColor': 'Avatar Color',
  'life.people.notes': 'Notes',
  'life.people.save': 'Save',
  'life.people.remove': 'Remove',
  'life.podcast.emptyTitle': 'Your podcast shelf is empty',
  'life.podcast.emptyDescription': 'Search podcasts or import a Netease channel link.',
  'life.podcast.findPodcast': 'Find podcast',
  'life.podcast.searchPlaceholder': 'Search podcast or paste a Netease link',
  'life.podcast.neteaseChannel': 'Netease channel',
  'life.podcast.presetChannel': 'Preset Netease channel',
  'life.podcast.import': 'Import',
  'life.podcast.nowPlaying': 'Now Playing',
  'life.podcast.play': 'Play',
  'life.podcast.viewOnApple': 'View on Apple Podcasts',
  'life.podcast.openChannel': 'Open Channel',
  'life.podcast.refresh': 'Refresh',
  'life.podcast.remove': 'Remove',
  'life.podcast.episodes': 'Episodes',
  'life.podcast.noDate': 'No date',
  'life.podcast.openInApple': 'Open in Apple Podcasts',
  'life.podcast.searchStart': 'Search and add a podcast to start.',
  'life.podcast.metadataApple': 'Metadata courtesy of Apple Podcasts',
  'life.podcast.search': 'Search',
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
  'life.podcast.sequenceMode': '按顺序播放剧集',
  'life.podcast.shuffleMode': '随机播放剧集',
  'life.podcast.sequenceShort': '顺序',
  'life.podcast.shuffleShort': '随机',
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
  'life.subscriptions.health': '健康与健身',
  'life.subscriptions.security': '安全',
  'life.subscriptions.developer': '开发工具',
  'life.subscriptions.news': '新闻与媒体',
  'life.subscriptions.other': '其他',
  'life.subscriptions.overview': '概览',
  'life.subscriptions.monthlyTotal': '月度总计',
  'life.subscriptions.noTrackedYet': '还没有记录任何订阅',
  'life.subscriptions.noDataYet': '暂无数据',
  'life.subscriptions.addToSeeOverview': '添加订阅后即可查看年度概览。',
  'life.subscriptions.annualOverview': '年度概览 · {{year}}',
  'life.subscriptions.exchangeRate': '汇率',
  'life.subscriptions.unifiedEstimate': '统一估算',
  'life.subscriptions.monthlyBurden': '月度负担',
  'life.subscriptions.byCategoryAnnual': '按分类 · 年度',
  'life.subscriptions.dueWithinDays': '{{count}} 天内到期',
  'life.subscriptions.today': '今天',
  'life.subscriptions.inDays': '{{count}} 天后',
  'life.subscriptions.emptyListTitle': '还没有订阅。',
  'life.subscriptions.emptyListDescription': '创建你的第一个订阅。',
  'life.subscriptions.newSubscription': '新订阅',
  'life.subscriptions.basics': '基础信息',
  'life.subscriptions.serviceName': '服务名称',
  'life.subscriptions.serviceNamePlaceholder': '例如 Netflix、iCloud+',
  'life.subscriptions.amount': '金额',
  'life.subscriptions.currency': '币种',
  'life.subscriptions.billingCycle': '计费周期',
  'life.subscriptions.yearly': '每年',
  'life.subscriptions.perMonth': '每月',
  'life.subscriptions.estFromYearly': '（由 {{amount}}/年估算）',
  'life.subscriptions.category': '分类',
  'life.subscriptions.schedule': '时间安排',
  'life.subscriptions.billingDay': '扣费日',
  'life.subscriptions.billingDayPlaceholder': '日期（1–31）',
  'life.subscriptions.billingMonth': '扣费月',
  'life.subscriptions.billingMonthPlaceholder': '月份（1–12）',
  'life.subscriptions.reminderOn': '开启续费提醒',
  'life.subscriptions.noReminder': '不提醒',
  'life.subscriptions.appearance': '外观',
  'life.subscriptions.icon': '图标',
  'life.subscriptions.iconSearchHint': '输入服务名后可自动搜索图标。',
  'life.subscriptions.iconSearching': '搜索中…',
  'life.subscriptions.noIconsFound': '未找到图标。',
  'life.subscriptions.colour': '颜色',
  'life.subscriptions.paymentStatus': '支付状态',
  'life.subscriptions.unpaid': '未支付',
  'life.subscriptions.paid': '已支付 ✓',
  'life.subscriptions.paymentStatusHint': '标记本期是否已经支付。',
  'life.subscriptions.cancel': '取消',
  'life.subscriptions.remove': '删除',
  'life.subscriptions.autoSaved': '已自动保存',
  'life.subscriptions.servicesCount': '{{count}} 个服务',
  'life.subscriptions.allCount': '全部 {{count}}',
  'life.subscriptions.unpaidCount': '未支付 {{count}}',
  'life.subscriptions.paidCount': '已支付 {{count}}',
  'life.subscriptions.noFiltered': '没有{{status}}订阅',
  'life.subscriptions.yearlyHint': '年付价格按月均估算展示。不同币种分开显示。',
  'life.subscriptions.close': '关闭',
  'life.trips.planNext': '规划下一次旅行',
  'life.trips.emptyDescription': '打开旅行工作区，创建行程、预算和清单。',
  'life.trips.checklist': '清单',
  'life.trips.days': '{{count}} 天',
  'life.trips.travelers': '{{count}} 位同行者',
  'life.trips.status.planning': '规划中',
  'life.trips.status.booked': '已预订',
  'life.trips.status.active': '进行中',
  'life.trips.status.completed': '已完成',
  'life.trips.title': '旅行',
  'life.trips.dashboard': '仪表盘',
  'life.trips.description': '创建旅行，打开详情工作区，让计划自动同步更新。',
  'life.trips.newTrip': '新建旅行',
  'life.trips.creating': '创建中…',
  'life.trips.createTrip': '创建旅行',
  'life.trips.deleteConfirm': '确认删除此旅行？',
  'life.trips.noTrips': '还没有旅行',
  'life.trips.noTripsDesc': '创建第一个旅行来开始规划。',
  'life.trips.destinationPending': '目的地待定',
  'life.trips.dateTo': ' 至 ',
  'life.trips.daysCount': '{{count}} 天',
  'life.trips.travelersCount': '{{count}} 位同行者',
  'life.trips.detail.overview': '概览',
  'life.trips.detail.itinerary': '行程',
  'life.trips.detail.transport': '交通',
  'life.trips.detail.stay': '住宿',
  'life.trips.detail.food': '餐饮',
  'life.trips.detail.budget': '预算',
  'life.trips.detail.notes': '备注',
  'life.trips.detail.allTrips': '所有旅行',
  'life.trips.detail.tripWorkspace': '旅行工作区',
  'life.trips.detail.tripPlanner': '旅行规划',
  'life.trips.detail.daysLabel': '天数',
  'life.trips.detail.travelersLabel': '同行者',
  'life.trips.detail.doneLabel': '已完成',
  'life.trips.detail.saving': '保存中…',
  'life.trips.detail.saved': '已保存',
  'life.trips.detail.retry': '重试',
  'life.trips.detail.tripNotFound': '旅行不存在',
  'life.trips.detail.tripNotFoundDesc': '该旅行已被删除或链接已失效。',
  'life.trips.detail.backToTrips': '返回旅行列表',
  'life.trips.detail.duration': '时长',
  'life.trips.detail.destinationPending': '目的地待定',
  'life.trips.detail.deleteConfirm': '确认删除此旅行？',
  'life.trips.detail.deleteTrip': '删除旅行',
  'life.trips.detail.export': '导出',
  'life.trips.detail.exportPdf': '导出 PDF',
  'life.trips.detail.exportIcal': '导出 iCal（.ics）',
  'life.trips.detail.nextActions': '下一步行动',
  'life.trips.detail.addDay': '添加天数',
  'life.trips.detail.addActivity': '添加活动',
  'life.trips.detail.addRoute': '添加路线',
  'life.trips.detail.addStay': '添加住宿',
  'life.trips.detail.addPlace': '添加地点',
  'life.trips.detail.addBudgetItem': '添加预算项',
  'life.trips.detail.addGroup': '添加分组',
  'life.trips.detail.addItem': '添加项目',
  'life.trips.detail.remove': '移除',
  'life.trips.detail.removeDay': '移除这天',
  'life.trips.detail.overallProgress': '整体进度',
  'life.trips.detail.datePending': '日期待定',
  'life.trips.detail.planned': '计划',
  'life.trips.detail.estimated': '预估',
  'life.trips.detail.actual': '实际',
  'life.trips.detail.remaining': '剩余',
  'life.trips.detail.split.total': '总计',
  'life.trips.detail.split.perPerson': '按人均',
  'life.trips.detail.split.perDay': '按每日',
  'life.trips.detail.split.perPersonNote': '按 {{count}} 位旅客均摊',
  'life.trips.detail.split.perDayNote': '按 {{count}} 天均摊',
  'life.trips.detail.breakdown': '明细',
  'life.trips.detail.balance': '结余',
  'life.trips.detail.left': '剩余',
  'life.trips.detail.over': '超支 ${{count}}',
  'life.trips.detail.overrunWarn': '已花费预算的 {{count}}%',
  'life.trips.detail.addPackTemplate': '打包模板',
  'life.trips.detail.packedCount': '已打包 {{done}}/{{total}}',
  'life.trips.detail.tripMemo': '旅行备忘',
  'life.trips.filter.all': '全部',
  'life.trips.filter.planning': '规划中',
  'life.trips.filter.booked': '已预订',
  'life.trips.filter.ongoing': '进行中',
  'life.trips.filter.done': '已结束',
  'life.trips.countdown.dminus': 'D-{{count}}',
  'life.trips.countdown.today': '今日出发',
  'life.trips.countdown.ongoing': '进行中',
  'life.trips.countdown.ended': '已结束',
  'life.trips.readiness.title': '准备进度',
  'life.trips.readiness.transport': '交通',
  'life.trips.readiness.stays': '住宿',
  'life.trips.readiness.food': '餐饮',
  'life.trips.readinessConfirmed': '{{done}}/{{total}} 已确认',
  'life.trips.budgetTitle': '预算',
  'life.trips.budgetUsed': '已用 {{pct}}% · ${{used}}',
  'life.trips.budgetOverrun': '超支 ${{amount}}',
  'life.trips.budgetUntracked': '尚未记录支出',
  'life.trips.checklistTitle': '清单',
  'life.trips.highlightsTitle': '亮点',
  'life.trips.openWorkspace': '查看工作区 →',
  'life.trips.view.grid': '卡片',
  'life.trips.view.timeline': '时间轴',
  'life.trips.view.calendar': '日历',
  'life.trips.calendar.prev': '上个月',
  'life.trips.calendar.next': '下个月',
  'life.trips.calendar.today': '今天',
  'life.trips.calendar.empty': '本月没有行程',
  'life.trips.timeline.undated': '日期待定',
  'life.trips.card.now': '正在进行',
  'life.trips.card.next': '接下来',
  'life.trips.card.freeDay': '今天没有安排，自由探索',
  'life.trips.card.dayOf': '第 {{count}} 天',
  'life.trips.card.inMinutes': '{{count}} 分钟后',
  'life.trips.card.inHours': '{{count}} 小时后',
  'life.trips.card.packing': '打包进度',
  'life.trips.card.todo': '待办',
  'life.trips.card.allSet': '一切就绪',
  'life.trips.card.openTrip': '打开行程',
  'life.trips.card.templates': '从模板开始',
  'life.trips.card.startTemplate': '规划下一次出发',
  'life.trips.nextDeparture': '即将出发',
  'life.trips.shape': '行程节奏',
  'life.trips.summary.upcoming': '即将出发',
  'life.trips.summary.ongoing': '进行中',
  'life.trips.summary.past': '已结束',
  'life.trips.summary.total': '全部',
  'life.library.title': '书库',
  'life.library.bookCount': '{{count}} 本书',
  'life.library.searchPlaceholder': '书名、作者或 ISBN...',
  'life.library.searchResults': '搜索结果',
  'life.library.all': '全部',
  'life.library.add': '添加',
  'life.library.added': '已添加',
  'life.library.shelfEmpty': '你的书架还是空的',
  'life.library.searchAbove': '使用上方搜索框找书，添加到你的书架。',
  'life.library.searchForBooks': '搜索书籍',
  'life.library.publishedBy': '出版商 ',
  'life.library.status': '阅读状态',
  'life.library.readingProgress': '阅读进度',
  'life.library.myReflection': '我的感想',
  'life.library.aboutBook': '关于此书',
  'life.library.removeFromLibrary': '从书架移除',
  'life.library.selectBook': '选择一本书来查看',
  'life.library.selectBookDesc': '从你的收藏中选择一本书，查看详情、追踪进度并写下感想。',
  'life.library.moreBooks': '书架上还有 +{{count}} 本书',
  'life.media.noMedia': '还没有影音内容。',
  'life.media.status': '状态',
  'life.media.progress': '进度',
  'life.media.myNotes': '我的笔记',
  'life.media.synopsis': '剧情简介',
  'life.media.selectTitle': '选择一部影音查看详情。',
  'life.media.wantToWatch': '想看',
  'life.people.title': '人际',
  'life.people.newPerson': '新联系人',
  'life.people.name': '姓名',
  'life.people.category': '类别',
  'life.people.group': '分组',
  'life.people.role': '职位',
  'life.people.city': '城市',
  'life.people.email': '邮箱',
  'life.people.phone': '电话',
  'life.people.birthday': '生日',
  'life.people.lastInteraction': '最近互动',
  'life.people.initials': '缩写',
  'life.people.avatarColor': '头像颜色',
  'life.people.notes': '备注',
  'life.people.save': '保存',
  'life.people.remove': '移除',
  'life.podcast.emptyTitle': '你的播客架还是空的',
  'life.podcast.emptyDescription': '搜索播客或导入网易频道链接。',
  'life.podcast.findPodcast': '查找播客',
  'life.podcast.searchPlaceholder': '搜索播客或粘贴网易链接',
  'life.podcast.neteaseChannel': '网易频道',
  'life.podcast.presetChannel': '预设网易频道',
  'life.podcast.import': '导入',
  'life.podcast.nowPlaying': '正在播放',
  'life.podcast.play': '播放',
  'life.podcast.viewOnApple': '在 Apple 播客中查看',
  'life.podcast.openChannel': '打开频道',
  'life.podcast.refresh': '刷新',
  'life.podcast.remove': '移除',
  'life.podcast.episodes': '剧集',
  'life.podcast.noDate': '无日期',
  'life.podcast.openInApple': '在 Apple 播客中打开',
  'life.podcast.searchStart': '搜索并添加播客以开始使用。',
  'life.podcast.metadataApple': '元数据由 Apple 播客提供',
  'life.podcast.search': '搜索',
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
