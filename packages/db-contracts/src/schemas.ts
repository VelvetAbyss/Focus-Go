import { z, type ZodTypeAny } from 'zod'
import type { IpcChannel } from './channels'

const emptySchema = z.object({}).strict()
const idSchema = z.object({ id: z.string().min(1) }).strict()
const taskStatusSchema = z.enum(['todo', 'doing', 'done'])
const taskPrioritySchema = z.enum(['high', 'medium', 'low']).nullable()

const baseEntitySchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.number(),
    updatedAt: z.number(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const taskSubtaskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    done: z.boolean(),
  })
  .strict()

const taskActivityLogSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['status', 'details']),
    message: z.string(),
    createdAt: z.number(),
  })
  .strict()

const taskNoteParagraphBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('paragraph'),
    text: z.string(),
  })
  .strict()

const taskNoteBlockSchema = taskNoteParagraphBlockSchema
const noteCollectionSchema = z.enum(['all-notes', 'work', 'personal', 'ideas'])
const noteThemeModeSchema = z.enum(['paper', 'graphite'])
const noteFontFamilySchema = z.enum(['uiSans', 'humanistSans', 'cnSans', 'serif', 'cnSerif', 'mono'])

const noteHeadingSchema = z
  .object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
    id: z.string().min(1),
  })
  .strict()

const noteBacklinkSchema = z
  .object({
    noteId: z.string().min(1),
    noteTitle: z.string(),
  })
  .strict()

const noteTagSchema = baseEntitySchema.extend({
  name: z.string(),
  icon: z.string().optional(),
  pinned: z.boolean(),
  parentId: z.string().nullable().optional(),
  noteCount: z.number(),
  sortOrder: z.number(),
})

const noteTagCreateInputSchema = z
  .object({
    name: z.string(),
    icon: z.string().optional(),
    pinned: z.boolean(),
    parentId: z.string().nullable().optional(),
    sortOrder: z.number(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const noteTagUpdateInputSchema = z
  .object({
    name: z.string().optional(),
    icon: z.string().optional(),
    pinned: z.boolean().optional(),
    parentId: z.string().nullable().optional(),
    noteCount: z.number().optional(),
    sortOrder: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const noteAppearanceSchema = baseEntitySchema.extend({
  id: z.literal('note_appearance'),
  theme: noteThemeModeSchema,
  font: noteFontFamilySchema,
  fontSize: z.number(),
  lineHeight: z.number(),
  contentWidth: z.number(),
  focusMode: z.boolean(),
})

const noteAppearanceUpsertInputSchema = z
  .object({
    id: z.literal('note_appearance'),
    theme: noteThemeModeSchema.optional(),
    font: noteFontFamilySchema.optional(),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
    contentWidth: z.number().optional(),
    focusMode: z.boolean().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const taskItemSchema = baseEntitySchema.extend({
  title: z.string(),
  description: z.string(),
  pinned: z.boolean(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reminderAt: z.number().optional(),
  reminderFiredAt: z.number().optional(),
  tags: z.array(z.string()),
  subtasks: z.array(taskSubtaskSchema),
  taskNoteBlocks: z.array(taskNoteBlockSchema),
  taskNoteContentMd: z.string().optional(),
  taskNoteContentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  activityLogs: z.array(taskActivityLogSchema),
})

const taskCreateInputSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    pinned: z.boolean().optional(),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    dueDate: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    reminderAt: z.number().optional(),
    reminderFiredAt: z.number().optional(),
    tags: z.array(z.string()).optional(),
    subtasks: z.array(taskSubtaskSchema).optional(),
    taskNoteBlocks: z.array(taskNoteBlockSchema).optional(),
    taskNoteContentMd: z.string().optional(),
    taskNoteContentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()

const widgetTodoScopeSchema = z.enum(['day', 'week', 'month'])
const noteEditorModeSchema = z.literal('document')
const noteItemSchema = baseEntitySchema.extend({
  title: z.string(),
  contentMd: z.string(),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  editorMode: noteEditorModeSchema,
  collection: noteCollectionSchema,
  tags: z.array(z.string()),
  excerpt: z.string(),
  pinned: z.boolean(),
  wordCount: z.number(),
  charCount: z.number(),
  paragraphCount: z.number(),
  imageCount: z.number(),
  fileCount: z.number(),
  headings: z.array(noteHeadingSchema),
  backlinks: z.array(noteBacklinkSchema),
  deletedAt: z.number().nullable().optional(),
})

const noteCreateInputSchema = z
  .object({
    title: z.string().optional(),
    contentMd: z.string().optional(),
    contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
    editorMode: noteEditorModeSchema.optional(),
    collection: noteCollectionSchema.optional(),
    tags: z.array(z.string()).optional(),
    pinned: z.boolean().optional(),
    backlinks: z.array(noteBacklinkSchema).optional(),
  })
  .strict()

const noteUpdateInputSchema = z
  .object({
    title: z.string().optional(),
    contentMd: z.string().optional(),
    contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
    editorMode: noteEditorModeSchema.optional(),
    collection: noteCollectionSchema.optional(),
    tags: z.array(z.string()).optional(),
    excerpt: z.string().optional(),
    pinned: z.boolean().optional(),
    wordCount: z.number().optional(),
    charCount: z.number().optional(),
    paragraphCount: z.number().optional(),
    imageCount: z.number().optional(),
    fileCount: z.number().optional(),
    headings: z.array(noteHeadingSchema).optional(),
    backlinks: z.array(noteBacklinkSchema).optional(),
    deletedAt: z.number().nullable().optional(),
  })
  .strict()

const widgetTodoSchema = baseEntitySchema.extend({
  scope: widgetTodoScopeSchema,
  title: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().optional(),
  done: z.boolean(),
  linkedHabitId: z.string().optional(),
})

const widgetTodoCreateInputSchema = z
  .object({
    scope: widgetTodoScopeSchema,
    title: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    dueDate: z.string().optional(),
    done: z.boolean(),
    linkedHabitId: z.string().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const habitTypeSchema = z.enum(['boolean', 'numeric', 'timer'])
const habitStatusSchema = z.enum(['completed', 'failed', 'frozen'])

const habitSchema = baseEntitySchema.extend({
  userId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  type: habitTypeSchema,
  color: z.string(),
  archived: z.boolean(),
  target: z.number().optional(),
  freezesAllowed: z.number(),
  sortOrder: z.number(),
})

const habitCreateInputSchema = z
  .object({
    userId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    type: habitTypeSchema,
    color: z.string(),
    archived: z.boolean(),
    target: z.number().optional(),
    freezesAllowed: z.number(),
    sortOrder: z.number(),
    workspaceId: z.string().optional(),
  })
  .strict()

const habitUpdateInputSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    type: habitTypeSchema.optional(),
    color: z.string().optional(),
    archived: z.boolean().optional(),
    target: z.number().optional(),
    freezesAllowed: z.number().optional(),
    sortOrder: z.number().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const habitLogSchema = baseEntitySchema.extend({
  userId: z.string(),
  habitId: z.string(),
  dateKey: z.string(),
  value: z.number().optional(),
  status: habitStatusSchema,
})

const habitListOptionsSchema = z.object({ archived: z.boolean().optional() }).strict()
const habitDailyProgressSchema = z.object({ completed: z.number(), total: z.number(), percent: z.number() }).strict()
const habitHeatmapCellSchema = z.object({ dateKey: z.string(), completed: z.number(), total: z.number() }).strict()

const noiseTrackSettingsSchema = z
  .object({
    enabled: z.boolean(),
    volume: z.number(),
  })
  .strict()

const noiseTracksSchema = z
  .object({
    cafe: noiseTrackSettingsSchema,
    fireplace: noiseTrackSettingsSchema,
    rain: noiseTrackSettingsSchema,
    wind: noiseTrackSettingsSchema,
    thunder: noiseTrackSettingsSchema,
    ocean: noiseTrackSettingsSchema,
  })
  .strict()

const focusSettingsSchema = baseEntitySchema.extend({
  focusMinutes: z.number(),
  breakMinutes: z.number(),
  longBreakMinutes: z.number(),
  noise: z
    .object({
      playing: z.boolean(),
      loop: z.boolean(),
      masterVolume: z.number(),
      tracks: noiseTracksSchema,
    })
    .strict()
    .optional(),
  noisePreset: z
    .object({
      presetId: z.string(),
      presetName: z.string(),
      scope: z.literal('focus-center'),
      isPlaying: z.boolean(),
      loop: z.boolean(),
      tracks: noiseTracksSchema,
    })
    .strict()
    .optional(),
  volume: z.number().optional(),
})

const focusSessionSchema = baseEntitySchema.extend({
  taskId: z.string().optional(),
  goal: z.string().optional(),
  plannedMinutes: z.number(),
  actualMinutes: z.number().optional(),
  status: z.enum(['active', 'completed', 'interrupted']),
  completedAt: z.number().optional(),
  interruptedAt: z.number().optional(),
  interruptionReason: z.string().optional(),
})

const focusSettingsUpsertInputSchema = z
  .object({
    focusMinutes: z.number(),
    breakMinutes: z.number(),
    longBreakMinutes: z.number(),
    noise: focusSettingsSchema.shape.noise,
    noisePreset: focusSettingsSchema.shape.noisePreset,
    volume: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const focusSessionStartInputSchema = z
  .object({
    taskId: z.string().optional(),
    goal: z.string().optional(),
    plannedMinutes: z.number().min(1),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const focusSessionCompleteInputSchema = z
  .object({
    id: z.string().min(1),
    actualMinutes: z.number().optional(),
    completedAt: z.number().optional(),
  })
  .strict()

const diaryEntrySchema = baseEntitySchema.extend({
  dateKey: z.string(),
  contentMd: z.string(),
  tags: z.array(z.string()),
  deletedAt: z.number().nullable().optional(),
  expiredAt: z.number().nullable().optional(),
})

const diaryEntryCreateInputSchema = z
  .object({
    dateKey: z.string(),
    contentMd: z.string(),
    tags: z.array(z.string()),
    deletedAt: z.number().nullable().optional(),
    expiredAt: z.number().nullable().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const spendEntrySchema = baseEntitySchema.extend({
  amount: z.number(),
  currency: z.string(),
  categoryId: z.string(),
  note: z.string().optional(),
  dateKey: z.string(),
})

const spendEntryCreateInputSchema = z
  .object({
    amount: z.number(),
    currency: z.string(),
    categoryId: z.string(),
    note: z.string().optional(),
    dateKey: z.string(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const subscriptionCycleSchema = z.enum(['monthly', 'yearly'])
const subscriptionCurrencySchema = z.enum(['USD', 'CNY'])
const subscriptionPaymentStatusSchema = z.enum(['paid', 'unpaid'])

const lifeSubscriptionSchema = baseEntitySchema.extend({
  name: z.string(),
  amount: z.number(),
  currency: subscriptionCurrencySchema,
  cycle: subscriptionCycleSchema,
  color: z.string().optional(),
  category: z.string().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  billingMonth: z.number().int().min(1).max(12).optional(),
  emoji: z.string().optional(),
  reminder: z.boolean().optional(),
  paymentStatus: subscriptionPaymentStatusSchema.optional(),
})

const lifeSubscriptionCreateInputSchema = z
  .object({
    name: z.string(),
    amount: z.number(),
    currency: subscriptionCurrencySchema,
    cycle: subscriptionCycleSchema,
    color: z.string().optional(),
    category: z.string().optional(),
    billingDay: z.number().int().min(1).max(31).optional(),
    billingMonth: z.number().int().min(1).max(12).optional(),
    emoji: z.string().optional(),
    reminder: z.boolean().optional(),
    paymentStatus: subscriptionPaymentStatusSchema.optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const lifeSubscriptionUpdateInputSchema = z
  .object({
    name: z.string().optional(),
    amount: z.number().optional(),
    currency: subscriptionCurrencySchema.optional(),
    cycle: subscriptionCycleSchema.optional(),
    color: z.string().optional(),
    category: z.string().optional(),
    billingDay: z.number().int().min(1).max(31).optional(),
    billingMonth: z.number().int().min(1).max(12).optional(),
    emoji: z.string().optional(),
    reminder: z.boolean().optional(),
    paymentStatus: subscriptionPaymentStatusSchema.optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const tripStatusSchema = z.enum(['Planning', 'Booked', 'Ready', 'Ongoing', 'Done'])
const transportMethodSchema = z.enum(['Flight', 'Train', 'Bus', 'Taxi', 'Subway', 'Walk', 'Car'])
const transportCategorySchema = z.enum(['intercity', 'local'])
const bookingStatusSchema = z.enum(['Confirmed', 'Pending', 'Not booked'])
const foodStatusSchema = z.enum(['Saved', 'Planned', 'Visited'])
const itineraryTypeSchema = z.enum(['spot', 'food', 'transport', 'hotel'])

const tripItineraryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  time: z.string(),
  location: z.string(),
  type: itineraryTypeSchema,
  notes: z.string().optional(),
}).strict()

const tripItineraryDaySchema = z.object({
  day: z.number(),
  date: z.string(),
  label: z.string(),
  items: z.array(tripItineraryItemSchema),
}).strict()

const tripTransportItemSchema = z.object({
  id: z.string(),
  category: transportCategorySchema,
  method: transportMethodSchema,
  from: z.string(),
  to: z.string(),
  departTime: z.string(),
  arriveTime: z.string(),
  date: z.string(),
  status: bookingStatusSchema,
  cost: z.number(),
  currency: z.string(),
  notes: z.string().optional(),
}).strict()

const tripStayItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  nights: z.number(),
  status: bookingStatusSchema,
  cost: z.number(),
  currency: z.string(),
  notes: z.string().optional(),
}).strict()

const tripFoodItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  area: z.string(),
  cuisine: z.string(),
  status: foodStatusSchema,
  priceRange: z.enum(['¥', '¥¥', '¥¥¥']),
  notes: z.string().optional(),
}).strict()

const tripBudgetCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  emoji: z.string(),
  planned: z.number(),
  actual: z.number(),
}).strict()

const tripChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
}).strict()

const tripChecklistGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  emoji: z.string(),
  items: z.array(tripChecklistItemSchema),
}).strict()

const tripRecordSchema = baseEntitySchema.extend({
  title: z.string(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: tripStatusSchema,
  travelers: z.number(),
  budgetPlanned: z.number(),
  budgetCurrency: z.string(),
  heroImage: z.string(),
  coverEmoji: z.string(),
  itinerary: z.array(tripItineraryDaySchema),
  transport: z.array(tripTransportItemSchema),
  stays: z.array(tripStayItemSchema),
  food: z.array(tripFoodItemSchema),
  budget: z.array(tripBudgetCategorySchema),
  checklist: z.array(tripChecklistGroupSchema),
  notes: z.string(),
})

const tripCreateInputSchema = z.object({
  title: z.string(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: tripStatusSchema,
  travelers: z.number(),
  budgetPlanned: z.number(),
  budgetCurrency: z.string(),
  heroImage: z.string(),
  coverEmoji: z.string(),
  itinerary: z.array(tripItineraryDaySchema),
  transport: z.array(tripTransportItemSchema),
  stays: z.array(tripStayItemSchema),
  food: z.array(tripFoodItemSchema),
  budget: z.array(tripBudgetCategorySchema),
  checklist: z.array(tripChecklistGroupSchema),
  notes: z.string(),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
}).strict()

const tripUpdateInputSchema = z.object({
  title: z.string().optional(),
  destination: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: tripStatusSchema.optional(),
  travelers: z.number().optional(),
  budgetPlanned: z.number().optional(),
  budgetCurrency: z.string().optional(),
  heroImage: z.string().optional(),
  coverEmoji: z.string().optional(),
  itinerary: z.array(tripItineraryDaySchema).optional(),
  transport: z.array(tripTransportItemSchema).optional(),
  stays: z.array(tripStayItemSchema).optional(),
  food: z.array(tripFoodItemSchema).optional(),
  budget: z.array(tripBudgetCategorySchema).optional(),
  checklist: z.array(tripChecklistGroupSchema).optional(),
  notes: z.string().optional(),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
}).strict()

const spendCategorySchema = baseEntitySchema.extend({
  name: z.string(),
  icon: z.string().optional(),
})

const spendCategoryCreateInputSchema = z
  .object({
    name: z.string(),
    icon: z.string().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const dashboardLayoutItemSchema = z
  .object({
    key: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  })
  .strict()

const dashboardLayoutSchema = baseEntitySchema.extend({
  items: z.array(dashboardLayoutItemSchema),
  hiddenCardIds: z.array(z.string()).optional(),
  themeOverride: z.enum(['light', 'dark']).nullable().optional(),
})

const dashboardLayoutUpsertInputSchema = z
  .object({
    items: z.array(dashboardLayoutItemSchema),
    hiddenCardIds: z.array(z.string()).optional(),
    themeOverride: z.enum(['light', 'dark']).nullable().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const lifeDashboardLayoutSchema = baseEntitySchema.extend({
  items: z.array(dashboardLayoutItemSchema),
  hiddenCardIds: z.array(z.string()).optional(),
})

const lifeDashboardLayoutUpsertInputSchema = z
  .object({
    items: z.array(dashboardLayoutItemSchema),
    hiddenCardIds: z.array(z.string()).optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const bookSourceSchema = z.enum(['manual', 'open-library', 'google-books', 'crossref', 'gutendex'])
const bookStatusSchema = z.enum(['reading', 'finished', 'want-to-read'])

const bookItemSchema = baseEntitySchema.extend({
  source: bookSourceSchema,
  sourceId: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  status: bookStatusSchema,
  progress: z.number(),
  coverUrl: z.string().optional(),
  description: z.string().optional(),
  publisher: z.string().optional(),
  publishedDate: z.string().optional(),
  subjects: z.array(z.string()),
  summary: z.string().optional(),
  outline: z.array(z.string()).optional(),
  reflection: z.string().optional(),
  isbn10: z.string().optional(),
  isbn13: z.string().optional(),
  openLibraryKey: z.string().optional(),
  googleBooksId: z.string().optional(),
  doi: z.string().optional(),
  lastSyncedAt: z.number().optional(),
})

const mediaTypeSchema = z.enum(['movie', 'tv'])
const mediaStatusSchema = z.enum(['watching', 'completed', 'want-to-watch'])

const mediaItemSchema = baseEntitySchema.extend({
  source: z.literal('tmdb'),
  sourceId: z.string().min(1),
  tmdbId: z.number(),
  mediaType: mediaTypeSchema,
  title: z.string(),
  originalTitle: z.string().optional(),
  status: mediaStatusSchema,
  progress: z.number(),
  posterUrl: z.string().optional(),
  backdropUrl: z.string().optional(),
  overview: z.string().optional(),
  releaseDate: z.string().optional(),
  director: z.string().optional(),
  creator: z.string().optional(),
  cast: z.array(z.string()),
  genres: z.array(z.string()),
  duration: z.string().optional(),
  seasons: z.number().optional(),
  episodes: z.number().optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  rating: z.string().optional(),
  watchedEpisodes: z.number().optional(),
  reflection: z.string().optional(),
  voteAverage: z.number().optional(),
  lastSyncedAt: z.number().optional(),
})

const mediaCreateInputSchema = z
  .object({
    source: z.literal('tmdb'),
    sourceId: z.string().min(1),
    tmdbId: z.number(),
    mediaType: mediaTypeSchema,
    title: z.string(),
    originalTitle: z.string().optional(),
    status: mediaStatusSchema,
    progress: z.number(),
    posterUrl: z.string().optional(),
    backdropUrl: z.string().optional(),
    overview: z.string().optional(),
    releaseDate: z.string().optional(),
    director: z.string().optional(),
    creator: z.string().optional(),
    cast: z.array(z.string()),
    genres: z.array(z.string()),
    duration: z.string().optional(),
    seasons: z.number().optional(),
    episodes: z.number().optional(),
    country: z.string().optional(),
    language: z.string().optional(),
    rating: z.string().optional(),
    watchedEpisodes: z.number().optional(),
    reflection: z.string().optional(),
    voteAverage: z.number().optional(),
    lastSyncedAt: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const mediaUpdateInputSchema = z
  .object({
    source: z.literal('tmdb').optional(),
    sourceId: z.string().min(1).optional(),
    tmdbId: z.number().optional(),
    mediaType: mediaTypeSchema.optional(),
    title: z.string().optional(),
    originalTitle: z.string().optional(),
    status: mediaStatusSchema.optional(),
    progress: z.number().optional(),
    posterUrl: z.string().optional(),
    backdropUrl: z.string().optional(),
    overview: z.string().optional(),
    releaseDate: z.string().optional(),
    director: z.string().optional(),
    creator: z.string().optional(),
    cast: z.array(z.string()).optional(),
    genres: z.array(z.string()).optional(),
    duration: z.string().optional(),
    seasons: z.number().optional(),
    episodes: z.number().optional(),
    country: z.string().optional(),
    language: z.string().optional(),
    rating: z.string().optional(),
    watchedEpisodes: z.number().optional(),
    reflection: z.string().optional(),
    voteAverage: z.number().optional(),
    lastSyncedAt: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const bookCreateInputSchema = z
  .object({
    source: bookSourceSchema,
    sourceId: z.string(),
    title: z.string(),
    authors: z.array(z.string()),
    status: bookStatusSchema,
    progress: z.number(),
    coverUrl: z.string().optional(),
    description: z.string().optional(),
    publisher: z.string().optional(),
    publishedDate: z.string().optional(),
    subjects: z.array(z.string()).optional(),
    summary: z.string().optional(),
    outline: z.array(z.string()).optional(),
    reflection: z.string().optional(),
    isbn10: z.string().optional(),
    isbn13: z.string().optional(),
    openLibraryKey: z.string().optional(),
    googleBooksId: z.string().optional(),
    doi: z.string().optional(),
    lastSyncedAt: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const bookUpdateInputSchema = z
  .object({
    source: bookSourceSchema.optional(),
    sourceId: z.string().optional(),
    title: z.string().optional(),
    authors: z.array(z.string()).optional(),
    status: bookStatusSchema.optional(),
    progress: z.number().optional(),
    coverUrl: z.string().optional(),
    description: z.string().optional(),
    publisher: z.string().optional(),
    publishedDate: z.string().optional(),
    subjects: z.array(z.string()).optional(),
    summary: z.string().optional(),
    outline: z.array(z.string()).optional(),
    reflection: z.string().optional(),
    isbn10: z.string().optional(),
    isbn13: z.string().optional(),
    openLibraryKey: z.string().optional(),
    googleBooksId: z.string().optional(),
    doi: z.string().optional(),
    lastSyncedAt: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const stockItemSchema = baseEntitySchema.extend({
  symbol: z.string(),
  name: z.string(),
  exchange: z.string().optional(),
  currency: z.string(),
  lastPrice: z.number().optional(),
  change: z.number().optional(),
  changePercent: z.number().optional(),
  chartPoints: z.array(z.number()).optional(),
  note: z.string().optional(),
  pinned: z.boolean(),
  lastSyncedAt: z.number().optional(),
})

const stockCreateInputSchema = z
  .object({
    symbol: z.string(),
    name: z.string(),
    exchange: z.string().optional(),
    currency: z.string(),
    lastPrice: z.number().optional(),
    change: z.number().optional(),
    changePercent: z.number().optional(),
    chartPoints: z.array(z.number()).optional(),
    note: z.string().optional(),
    pinned: z.boolean().optional(),
    lastSyncedAt: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const stockUpdateInputSchema = z
  .object({
    symbol: z.string().optional(),
    name: z.string().optional(),
    exchange: z.string().optional(),
    currency: z.string().optional(),
    lastPrice: z.number().optional(),
    change: z.number().optional(),
    changePercent: z.number().optional(),
    chartPoints: z.array(z.number()).optional(),
    note: z.string().optional(),
    pinned: z.boolean().optional(),
    lastSyncedAt: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

export const ipcRequestSchemas = {
  'db:tasks:list': emptySchema,
  'db:tasks:add': taskCreateInputSchema,
  'db:tasks:update': z.object({ task: taskItemSchema }).strict(),
  'db:tasks:remove': idSchema,
  'db:tasks:updateStatus': z.object({ id: z.string().min(1), status: taskStatusSchema }).strict(),
  'db:tasks:clearAllTags': emptySchema,
  'db:notes:list': emptySchema,
  'db:notes:listTrash': emptySchema,
  'db:notes:create': noteCreateInputSchema,
  'db:notes:update': z.object({ id: z.string().min(1), patch: noteUpdateInputSchema }).strict(),
  'db:notes:softDelete': idSchema,
  'db:notes:restore': idSchema,
  'db:notes:hardDelete': idSchema,
  'db:noteTags:list': emptySchema,
  'db:noteTags:create': noteTagCreateInputSchema,
  'db:noteTags:update': z.object({ id: z.string().min(1), patch: noteTagUpdateInputSchema }).strict(),
  'db:noteTags:remove': idSchema,
  'db:noteAppearance:get': emptySchema,
  'db:noteAppearance:upsert': noteAppearanceUpsertInputSchema,
  'db:widgetTodos:list': z.object({ scope: widgetTodoScopeSchema.optional() }).strict(),
  'db:widgetTodos:add': widgetTodoCreateInputSchema,
  'db:widgetTodos:update': z.object({ item: widgetTodoSchema }).strict(),
  'db:widgetTodos:resetDone': z.object({ scope: widgetTodoScopeSchema }).strict(),
  'db:widgetTodos:remove': idSchema,
  'db:focus:get': emptySchema,
  'db:focus:upsert': focusSettingsUpsertInputSchema,
  'db:focusSessions:list': z.object({ limit: z.number().int().positive().max(200).optional() }).strict(),
  'db:focusSessions:start': focusSessionStartInputSchema,
  'db:focusSessions:complete': focusSessionCompleteInputSchema,
  'db:diary:list': emptySchema,
  'db:diary:listActive': emptySchema,
  'db:diary:getByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:listByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:listByRange': z
    .object({
      dateFrom: z.string(),
      dateTo: z.string(),
      options: z.object({ includeDeleted: z.boolean().optional() }).strict().optional(),
    })
    .strict(),
  'db:diary:listTrash': emptySchema,
  'db:diary:softDeleteByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:softDeleteById': idSchema,
  'db:diary:restoreByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:restoreById': idSchema,
  'db:diary:markExpiredOlderThan': z.object({ days: z.number().optional() }).strict(),
  'db:diary:hardDeleteByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:hardDeleteById': idSchema,
  'db:diary:add': diaryEntryCreateInputSchema,
  'db:diary:update': z.object({ entry: diaryEntrySchema }).strict(),
  'db:spend:listEntries': emptySchema,
  'db:spend:addEntry': spendEntryCreateInputSchema,
  'db:spend:deleteEntry': idSchema,
  'db:spend:updateEntry': z.object({ entry: spendEntrySchema }).strict(),
  'db:spend:listCategories': emptySchema,
  'db:spend:addCategory': spendCategoryCreateInputSchema,
  'db:spend:updateCategory': z.object({ category: spendCategorySchema }).strict(),
  'db:dashboard:get': emptySchema,
  'db:dashboard:upsert': dashboardLayoutUpsertInputSchema,
  'db:lifeDashboard:get': emptySchema,
  'db:lifeDashboard:upsert': lifeDashboardLayoutUpsertInputSchema,
  'db:books:list': emptySchema,
  'db:books:create': bookCreateInputSchema,
  'db:books:update': z.object({ id: z.string().min(1), patch: bookUpdateInputSchema }).strict(),
  'db:books:remove': idSchema,
  'db:media:list': emptySchema,
  'db:media:create': mediaCreateInputSchema,
  'db:media:update': z.object({ id: z.string().min(1), patch: mediaUpdateInputSchema }).strict(),
  'db:media:remove': idSchema,
  'db:stocks:list': emptySchema,
  'db:stocks:create': stockCreateInputSchema,
  'db:stocks:update': z.object({ id: z.string().min(1), patch: stockUpdateInputSchema }).strict(),
  'db:stocks:remove': idSchema,
  'db:lifeSubscriptions:list': emptySchema,
  'db:lifeSubscriptions:create': lifeSubscriptionCreateInputSchema,
  'db:lifeSubscriptions:update': z.object({ id: z.string().min(1), patch: lifeSubscriptionUpdateInputSchema }).strict(),
  'db:lifeSubscriptions:remove': idSchema,
  'db:trips:list': emptySchema,
  'db:trips:create': tripCreateInputSchema,
  'db:trips:update': z.object({ id: z.string().min(1), patch: tripUpdateInputSchema }).strict(),
  'db:trips:remove': idSchema,
  'db:habits:list': z.object({ userId: z.string().min(1), options: habitListOptionsSchema.optional() }).strict(),
  'db:habits:create': habitCreateInputSchema,
  'db:habits:update': z.object({ id: z.string().min(1), patch: habitUpdateInputSchema }).strict(),
  'db:habits:archive': idSchema,
  'db:habits:restore': idSchema,
  'db:habits:reorder': z.object({ userId: z.string().min(1), ids: z.array(z.string().min(1)) }).strict(),
  'db:habits:recordCompletion': z.object({ habitId: z.string().min(1), dateKey: z.string(), value: z.number().optional() }).strict(),
  'db:habits:undoCompletion': z.object({ habitId: z.string().min(1), dateKey: z.string() }).strict(),
  'db:habits:listLogs': z.object({ habitId: z.string().min(1) }).strict(),
  'db:habits:computeStreak': z.object({ habitId: z.string().min(1), dateKey: z.string() }).strict(),
  'db:habits:getDailyProgress': z.object({ userId: z.string().min(1), dateKey: z.string() }).strict(),
  'db:habits:getHeatmap': z.object({ userId: z.string().min(1), days: z.number().int().positive() }).strict(),
} as const satisfies Record<IpcChannel, ZodTypeAny>

const ipcErrorSchema = z.object({ code: z.string(), message: z.string() }).strict()

const responseSchema = <T extends ZodTypeAny>(dataSchema: T) =>
  z.union([
    z.object({ ok: z.literal(true), data: dataSchema }).strict(),
    z.object({ ok: z.literal(false), error: ipcErrorSchema }).strict(),
  ])

export const ipcResponseSchemas = {
  'db:tasks:list': responseSchema(z.array(taskItemSchema)),
  'db:tasks:add': responseSchema(taskItemSchema),
  'db:tasks:update': responseSchema(taskItemSchema),
  'db:tasks:remove': responseSchema(z.null()),
  'db:tasks:updateStatus': responseSchema(taskItemSchema.nullable()),
  'db:tasks:clearAllTags': responseSchema(z.null()),
  'db:notes:list': responseSchema(z.array(noteItemSchema)),
  'db:notes:listTrash': responseSchema(z.array(noteItemSchema)),
  'db:notes:create': responseSchema(noteItemSchema),
  'db:notes:update': responseSchema(noteItemSchema.nullable()),
  'db:notes:softDelete': responseSchema(noteItemSchema.nullable()),
  'db:notes:restore': responseSchema(noteItemSchema.nullable()),
  'db:notes:hardDelete': responseSchema(z.null()),
  'db:noteTags:list': responseSchema(z.array(noteTagSchema)),
  'db:noteTags:create': responseSchema(noteTagSchema),
  'db:noteTags:update': responseSchema(noteTagSchema.nullable()),
  'db:noteTags:remove': responseSchema(z.null()),
  'db:noteAppearance:get': responseSchema(noteAppearanceSchema.nullable()),
  'db:noteAppearance:upsert': responseSchema(noteAppearanceSchema),
  'db:widgetTodos:list': responseSchema(z.array(widgetTodoSchema)),
  'db:widgetTodos:add': responseSchema(widgetTodoSchema),
  'db:widgetTodos:update': responseSchema(widgetTodoSchema),
  'db:widgetTodos:resetDone': responseSchema(z.array(widgetTodoSchema)),
  'db:widgetTodos:remove': responseSchema(z.null()),
  'db:focus:get': responseSchema(focusSettingsSchema.nullable()),
  'db:focus:upsert': responseSchema(focusSettingsSchema),
  'db:focusSessions:list': responseSchema(z.array(focusSessionSchema)),
  'db:focusSessions:start': responseSchema(focusSessionSchema),
  'db:focusSessions:complete': responseSchema(focusSessionSchema.nullable()),
  'db:diary:list': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:listActive': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:getByDate': responseSchema(diaryEntrySchema.nullable()),
  'db:diary:listByDate': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:listByRange': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:listTrash': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:softDeleteByDate': responseSchema(diaryEntrySchema.nullable()),
  'db:diary:softDeleteById': responseSchema(diaryEntrySchema.nullable()),
  'db:diary:restoreByDate': responseSchema(diaryEntrySchema.nullable()),
  'db:diary:restoreById': responseSchema(diaryEntrySchema.nullable()),
  'db:diary:markExpiredOlderThan': responseSchema(z.number()),
  'db:diary:hardDeleteByDate': responseSchema(z.number()),
  'db:diary:hardDeleteById': responseSchema(z.number()),
  'db:diary:add': responseSchema(diaryEntrySchema),
  'db:diary:update': responseSchema(diaryEntrySchema),
  'db:spend:listEntries': responseSchema(z.array(spendEntrySchema)),
  'db:spend:addEntry': responseSchema(spendEntrySchema),
  'db:spend:deleteEntry': responseSchema(z.null()),
  'db:spend:updateEntry': responseSchema(spendEntrySchema),
  'db:spend:listCategories': responseSchema(z.array(spendCategorySchema)),
  'db:spend:addCategory': responseSchema(spendCategorySchema),
  'db:spend:updateCategory': responseSchema(spendCategorySchema),
  'db:dashboard:get': responseSchema(dashboardLayoutSchema.nullable()),
  'db:dashboard:upsert': responseSchema(dashboardLayoutSchema),
  'db:lifeDashboard:get': responseSchema(lifeDashboardLayoutSchema.nullable()),
  'db:lifeDashboard:upsert': responseSchema(lifeDashboardLayoutSchema),
  'db:books:list': responseSchema(z.array(bookItemSchema)),
  'db:books:create': responseSchema(bookItemSchema),
  'db:books:update': responseSchema(bookItemSchema.nullable()),
  'db:books:remove': responseSchema(z.null()),
  'db:media:list': responseSchema(z.array(mediaItemSchema)),
  'db:media:create': responseSchema(mediaItemSchema),
  'db:media:update': responseSchema(mediaItemSchema.nullable()),
  'db:media:remove': responseSchema(z.null()),
  'db:stocks:list': responseSchema(z.array(stockItemSchema)),
  'db:stocks:create': responseSchema(stockItemSchema),
  'db:stocks:update': responseSchema(stockItemSchema.nullable()),
  'db:stocks:remove': responseSchema(z.null()),
  'db:lifeSubscriptions:list': responseSchema(z.array(lifeSubscriptionSchema)),
  'db:lifeSubscriptions:create': responseSchema(lifeSubscriptionSchema),
  'db:lifeSubscriptions:update': responseSchema(lifeSubscriptionSchema.nullable()),
  'db:lifeSubscriptions:remove': responseSchema(z.null()),
  'db:trips:list': responseSchema(z.array(tripRecordSchema)),
  'db:trips:create': responseSchema(tripRecordSchema),
  'db:trips:update': responseSchema(tripRecordSchema.nullable()),
  'db:trips:remove': responseSchema(z.null()),
  'db:habits:list': responseSchema(z.array(habitSchema)),
  'db:habits:create': responseSchema(habitSchema),
  'db:habits:update': responseSchema(habitSchema.nullable()),
  'db:habits:archive': responseSchema(habitSchema.nullable()),
  'db:habits:restore': responseSchema(habitSchema.nullable()),
  'db:habits:reorder': responseSchema(z.null()),
  'db:habits:recordCompletion': responseSchema(habitLogSchema),
  'db:habits:undoCompletion': responseSchema(z.null()),
  'db:habits:listLogs': responseSchema(z.array(habitLogSchema)),
  'db:habits:computeStreak': responseSchema(z.number()),
  'db:habits:getDailyProgress': responseSchema(habitDailyProgressSchema),
  'db:habits:getHeatmap': responseSchema(z.array(habitHeatmapCellSchema)),
} as const satisfies Record<IpcChannel, ZodTypeAny>

export type IpcRequestByChannel = {
  [K in IpcChannel]: z.infer<(typeof ipcRequestSchemas)[K]>
}

export type IpcResponseByChannel = {
  [K in IpcChannel]: z.infer<(typeof ipcResponseSchemas)[K]>
}
