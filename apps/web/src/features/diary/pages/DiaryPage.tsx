import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { diaryRepo } from '../../../data/repositories/diaryRepo'
import type { DiaryEntry, WeatherSnapshot as DiaryWeatherSnapshot } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { toDateKey } from '../../../shared/utils/time'
import { getWeatherSnapshot } from '../../weather/weatherRuntime'
import { getWeatherCodeMeta } from '../../weather/weatherCodeMeta'
import { getWeatherIconMeta } from '../../weather/weatherIcons'
import DiaryEditor from '../components/DiaryEditor'
import type { DiaryEditorValue } from '../components/DiaryEditor'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readDiaryFont } from '../../../shared/prefs/preferences'
import ActiveIndicator from '../../../shared/motion/ActiveIndicator'
import { SELECTED_TAB } from '../../../shared/motion/indicatorSelectors'
import { markdownToPreview } from '../../../shared/utils/markdownPreview'
import { createUnsavedEditStore } from '../../../shared/utils/unsavedEdit'
import { useOpenRequest } from '../../../shared/navigation/openRequest'
import './diary-page.css'

const unsavedDiaryEdit = createUnsavedEditStore<DiaryEditorValue>('focusgo.diary.unsavedEdit')

type ViewMode = 'day' | 'week' | 'month'

// ── date range helpers ──────────────────────────────────────────────────────

function addDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

// Monday-first, like the calendar, the date picker and the weekly recap.
function startOfWeek(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return toDateKey(d)
}

function endOfWeek(dateKey: string): string {
  return addDays(startOfWeek(dateKey), 6)
}

function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`
}

function endOfMonth(dateKey: string): string {
  const [year, month] = dateKey.split('-').map(Number)
  const d = new Date(year, month, 0)
  return toDateKey(d)
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatHeadlineDate(dateKey: string, locale: 'en' | 'zh'): string {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatDateLabel(dateKey: string, view: ViewMode, today: string): string {
  if (view === 'day') {
    if (dateKey === today) return '__TODAY__'
    if (dateKey === addDays(today, -1)) return '__YESTERDAY__'
    return dateKey
  }
  if (view === 'week') {
    const s = startOfWeek(dateKey)
    const e = endOfWeek(dateKey)
    return `${s} – ${e}`
  }
  return dateKey.slice(0, 7)
}

function navigatePeriod(dateKey: string, view: ViewMode, dir: -1 | 1): string {
  if (view === 'day') return addDays(dateKey, dir)
  if (view === 'week') return addDays(dateKey, dir * 7)
  const [year, month] = dateKey.split('-').map(Number)
  const d = new Date(year, month - 1 + dir, 1)
  return toDateKey(d)
}

function getRangeForView(dateKey: string, view: ViewMode): [string, string] {
  if (view === 'day') return [dateKey, dateKey]
  if (view === 'week') return [startOfWeek(dateKey), endOfWeek(dateKey)]
  return [startOfMonth(dateKey), endOfMonth(dateKey)]
}

// ── streak calculation ──────────────────────────────────────────────────────

function calcStreak(entries: DiaryEntry[], today: string): number {
  const days = new Set(entries.filter((e) => !e.deletedAt).map((e) => e.dateKey))
  let streak = 0
  let cursor = today
  while (days.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

function calcWordCount(contentMd: string): number {
  const text = contentMd.replace(/[#*`>_~[\]() -]/g, ' ').trim()
  if (!text) return 0
  const isCjk = /[\u3400-\u9fff]/.test(text)
  if (isCjk) return text.replace(/\s+/g, '').length
  return text.split(/\s+/).filter(Boolean).length
}

function getDiaryMoment(date = new Date()) {
  const hour = date.getHours()
  if (hour < 6) return { eyebrowKey: 'diary.moment.quietHours', noteKey: 'diary.moment.quietHoursNote' } as const
  if (hour < 11) return { eyebrowKey: 'diary.moment.softMorning', noteKey: 'diary.moment.softMorningNote' } as const
  if (hour < 17) return { eyebrowKey: 'diary.moment.middayPause', noteKey: 'diary.moment.middayPauseNote' } as const
  if (hour < 21) return { eyebrowKey: 'diary.moment.eveningUnwind', noteKey: 'diary.moment.eveningUnwindNote' } as const
  return { eyebrowKey: 'diary.moment.nightReflection', noteKey: 'diary.moment.nightReflectionNote' } as const
}

function getLocalizedWeatherLabel(code: number, fallback: string, locale: 'en' | 'zh') {
  const key = getWeatherCodeMeta(code).label

  const zhMap: Record<string, string> = {
    Clear: '晴',
    'Mainly clear': '基本晴朗',
    'Partly cloudy': '局部多云',
    Overcast: '阴天',
    Fog: '雾',
    'Rime fog': '雾凇雾',
    'Light drizzle': '小毛雨',
    Drizzle: '毛雨',
    'Dense drizzle': '浓毛雨',
    'Freezing drizzle': '冻毛雨',
    'Dense freezing drizzle': '强冻毛雨',
    'Light rain': '小雨',
    Rain: '雨',
    'Heavy rain': '大雨',
    'Freezing rain': '冻雨',
    'Heavy freezing rain': '强冻雨',
    'Light snow': '小雪',
    Snow: '雪',
    'Heavy snow': '大雪',
    'Snow grains': '米雪',
    'Heavy showers': '强阵雨',
    'Violent showers': '暴阵雨',
    'Snow showers': '阵雪',
    'Heavy snow showers': '强阵雪',
    Thunderstorm: '雷暴',
    'Thunder + hail': '雷暴伴冰雹',
    'Severe thunder + hail': '强雷暴伴冰雹',
    Unknown: '未知',
  }

  if (locale === 'zh') return zhMap[key] ?? fallback
  return key || fallback
}

// ── component ──────────────────────────────────────────────────────────────

const DiaryPage = () => {
  const { t, language } = useI18n()
  const locale = language
  const today = toDateKey()
  const [view, setView] = useState<ViewMode>('day')
  const diaryFont = readDiaryFont()

const [selectedDateKey, setSelectedDateKey] = useState(today)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [allEntries, setAllEntries] = useState<DiaryEntry[]>([])
  const allEntriesRef = useRef<DiaryEntry[]>([])
  allEntriesRef.current = allEntries
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorValue, setEditorValue] = useState<DiaryEditorValue>({ contentMd: '', contentJson: null })
  const [, setSaving] = useState(false)
  const pendingSaveRef = useRef<DiaryEditorValue | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const selectedEntryRef = useRef<DiaryEntry | null>(null)
  // A freshly created entry takes the caret so writing starts without an extra click.
  const [focusEntryId, setFocusEntryId] = useState<string | null>(null)
  const [entriesReady, setEntriesReady] = useState(false)

  // Saves are async; a reload or quit can land before the write does. While the page is
  // hiding, the in-flight edit is also stashed synchronously (replayed on next load). The
  // editor flushes on the same events, so both listener orders are covered.
  const pageHidingRef = useRef(false)
  const inflightWriteRef = useRef<{ id: string; patch: DiaryEditorValue; at: number } | null>(null)
  useEffect(() => {
    const onHide = () => {
      pageHidingRef.current = true
      if (inflightWriteRef.current) unsavedDiaryEdit.stash(inflightWriteRef.current)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
      else pageHidingRef.current = false
    }
    const onShow = () => {
      pageHidingRef.current = false
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
    }
  }, [])

  // Keep refs in sync
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // "New entry" persists a row immediately so the editor has something to
  // save into. If the user leaves it without writing anything, drop it —
  // otherwise blank rows pile up in the list and inflate the stats.
  const blankDraftIdsRef = useRef<Set<string>>(new Set())
  const previousSelectedIdRef = useRef<string | null>(null)
  useEffect(() => {
    const previousId = previousSelectedIdRef.current
    previousSelectedIdRef.current = selectedId
    if (!previousId || previousId === selectedId || !blankDraftIdsRef.current.has(previousId)) return
    blankDraftIdsRef.current.delete(previousId)
    const latest = allEntriesRef.current.find((entry) => entry.id === previousId)
    if (!latest || latest.contentMd.trim()) return
    void diaryRepo.softDeleteById(previousId).then(() => {
      setEntries((prev) => prev.filter((entry) => entry.id !== previousId))
      setAllEntries((prev) => prev.filter((entry) => entry.id !== previousId))
    })
  }, [selectedId])

  // Load range entries for timeline
  useEffect(() => {
    const [from, to] = getRangeForView(selectedDateKey, view)
    diaryRepo.listByRange(from, to).then((rows) => {
      setEntries(rows.filter((e) => !e.deletedAt).sort((a, b) => b.entryAt - a.entryAt))
    })
  }, [selectedDateKey, view])

  // Load all active entries once for stats
  useEffect(() => {
    void (async () => {
      const unsaved = unsavedDiaryEdit.take()
      if (unsaved) {
        const target = (await diaryRepo.listActive()).find((entry) => entry.id === unsaved.id)
        if (target && target.updatedAt <= unsaved.at) {
          await diaryRepo.update({ ...target, contentMd: unsaved.patch.contentMd, contentJson: unsaved.patch.contentJson ?? null })
        }
      }
      setAllEntries(await diaryRepo.listActive())
      setEntriesReady(true)
    })()
  }, [])

  // Flush pending save when selected entry or view changes
  const flushSave = useCallback(async () => {
    const pending = pendingSaveRef.current
    const entry = selectedEntryRef.current
    if (!pending || !entry) return
    pendingSaveRef.current = null
    if (!pending.contentMd.trim()) return
    setSaving(true)
    try {
      await diaryRepo.update({ ...entry, contentMd: pending.contentMd, contentJson: pending.contentJson ?? null })
      setAllEntries((prev) => prev.map((e) => e.id === entry.id ? { ...entry, contentMd: pending.contentMd, contentJson: pending.contentJson ?? null } : e))
    } finally {
      setSaving(false)
    }
  }, [])

  const selectEntry = useCallback(async (entry: DiaryEntry) => {
    await flushSave()
    selectedEntryRef.current = entry
    setSelectedId(entry.id)
    setEditorValue({ contentMd: entry.contentMd, contentJson: entry.contentJson ?? null })
  }, [flushSave])

  // ⌘K search → "open this entry": jump to its day and select it.
  useOpenRequest('diary', entriesReady, (id) => {
    const entry = allEntries.find((item) => item.id === id)
    if (!entry) return
    setView('day')
    setSelectedDateKey(entry.dateKey)
    void selectEntry(entry)
  })

  const handleEditorChange = useCallback((next: DiaryEditorValue) => {
    pendingSaveRef.current = next
    setEditorValue(next)
    const entry = selectedEntryRef.current
    if (!entry) return
    setSaving(true)
    const write = { id: entry.id, patch: next, at: Date.now() }
    inflightWriteRef.current = write
    if (pageHidingRef.current) unsavedDiaryEdit.stash(write)
    diaryRepo.update({ ...entry, contentMd: next.contentMd, contentJson: next.contentJson ?? null })
      .then((updated) => {
        if (inflightWriteRef.current === write) inflightWriteRef.current = null
        unsavedDiaryEdit.clear(write.at)
        selectedEntryRef.current = updated
        pendingSaveRef.current = null
        setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e))
        setAllEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e))
      })
      .finally(() => setSaving(false))
  }, [])

  const captureWeatherSnapshot = (): DiaryWeatherSnapshot | null => {
    const ws = getWeatherSnapshot()
    if (ws.status !== 'ready' || !ws.data?.days?.length) return null
    const today_weather = ws.data.days[0]
    if (!today_weather) return null
    return {
      weatherCode: String(today_weather.weatherCode),
      condition: today_weather.condition,
      temperatureMin: today_weather.tempMin,
      temperatureMax: today_weather.tempMax,
      locationName: ws.data.location?.name ?? undefined,
      capturedAt: Date.now(),
    }
  }

  const handleNewEntry = useCallback(async () => {
    await flushSave()
    const now = Date.now()
    const weatherSnapshot = captureWeatherSnapshot()
    const newEntry = await diaryRepo.add({
      dateKey: selectedDateKey,
      entryAt: now,
      contentMd: '',
      contentJson: null,
      tags: [],
      weatherSnapshot,
      deletedAt: null,
      expiredAt: null,
    })
    setEntries((prev) => [newEntry, ...prev])
    setAllEntries((prev) => [newEntry, ...prev])
    blankDraftIdsRef.current.add(newEntry.id)
    selectedEntryRef.current = newEntry
    setSelectedId(newEntry.id)
    setFocusEntryId(newEntry.id)
    setEditorValue({ contentMd: '', contentJson: null })
  }, [selectedDateKey, flushSave])

  const handleDeleteEntry = useCallback(async (id: string) => {
    if (id === selectedIdRef.current) {
      await flushSave()
      selectedEntryRef.current = null
      setSelectedId(null)
      setEditorValue({ contentMd: '', contentJson: null })
    }
    await diaryRepo.softDeleteById(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setAllEntries((prev) => prev.filter((e) => e.id !== id))
  }, [flushSave])

  // Flush on unmount
  useEffect(() => () => { void flushSave() }, [flushSave])

  // Leaving the page with a blank "new entry" still open: drop it like switching away does.
  // Checked a moment later against storage, after the editor's own unmount flush has landed.
  useEffect(() => () => {
    const id = selectedIdRef.current
    if (!id || !blankDraftIdsRef.current.has(id)) return
    window.setTimeout(() => {
      void diaryRepo.listActive().then((rows) => {
        const entry = rows.find((row) => row.id === id)
        if (entry && !entry.contentMd.trim()) void diaryRepo.softDeleteById(id)
      })
    }, 1000)
  }, [])

  // Stats
  const stats = useMemo(() => {
    // A blank entry (just created, nothing written yet) is not a diary day.
    const active = allEntries.filter((e) => !e.deletedAt && e.contentMd.trim())
    const weekStart = startOfWeek(today)
    const monthStart = startOfMonth(today)
    return {
      total: active.length,
      streak: calcStreak(active, today),
      thisWeek: active.filter((e) => e.dateKey >= weekStart).length,
      thisMonth: active.filter((e) => e.dateKey >= monthStart).length,
    }
  }, [allEntries, today])

  const selectedEntry = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId])

  const handlePrev = () => {
    void flushSave()
    selectedEntryRef.current = null
    setSelectedId(null)
    setSelectedDateKey((d) => navigatePeriod(d, view, -1))
  }

  const handleNext = () => {
    void flushSave()
    selectedEntryRef.current = null
    setSelectedId(null)
    setSelectedDateKey((d) => navigatePeriod(d, view, 1))
  }

  const isAtToday = selectedDateKey >= today && view === 'day'

  const diaryMoment = useMemo(() => getDiaryMoment(), [])

  const topStats = [
    { label: t('diary.streak'), value: language === 'zh' ? `${stats.streak} 天` : `${stats.streak}d` },
    { label: t('diary.entriesLabel'), value: `${stats.total}` },
    { label: t('diary.thisWeek'), value: `${stats.thisWeek}` },
  ]

  return (
    <div className="diary-page flex h-full flex-col overflow-hidden" data-diary-font={diaryFont}>
      <div className="diary-page__atmosphere" aria-hidden="true" />
      {/* Header */}
      <header className="diary-page__header z-10 shrink-0 bg-transparent px-4 py-5 md:px-6 md:py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <div className="space-y-2 pl-2 md:pl-4">
              <h2 className="diary-page__title text-foreground">{t('diary.title')}</h2>
            </div>
            <div className="diary-page__view-switch" role="tablist" aria-label={t('diary.title')}>
                <ActiveIndicator selector={SELECTED_TAB} />
                {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className="diary-page__view-tab"
                onClick={() => {
                  void flushSave()
                  selectedEntryRef.current = null
                  setSelectedId(null)
                  setView(v)
                }}
              >
                {t(`diary.view.${v}` as const)}
              </button>
            ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-background/75 p-2 sm:min-w-[18rem]">
              {topStats.map((item) => (
                <div key={item.label} className="rounded-xl bg-paper-sunken px-3 py-2">
                  <p className="diary-page__microcopy text-meta font-semibold uppercase tracking-[var(--tracking-caps)] text-muted-foreground">{item.label}</p>
                  <p className="diary-page__numeric mt-1 text-sm font-semibold leading-none text-[color:var(--text-primary)]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                className="diary-page__new"
                onClick={handleNewEntry}
              >
                <Plus size={15} />
                {t('diary.newEntry')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden xl:flex-row">
        {/* Left: Timeline */}
        <section className="diary-page__rail flex h-[22rem] shrink-0 flex-col overflow-hidden bg-transparent xl:h-auto xl:w-[24rem]">
          {/* Date nav */}
          <div className="shrink-0 px-4 py-4 md:px-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('diary.prevPeriod')}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="diary-page__period-label flex-1 truncate text-center text-sm font-semibold text-[color:var(--text-primary)]">
                {formatDateLabel(selectedDateKey, view, today)
                  .replace('__TODAY__', t('diary.today'))
                  .replace('__YESTERDAY__', t('diary.yesterday'))}
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={isAtToday}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={t('diary.nextPeriod')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-3 py-4 md:px-4">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <p className="text-sm">{t('diary.noEntriesPeriod')}</p>
                <button
                  type="button"
                  className="diary-page__period-empty-action diary-page__secondary-cta"
                  onClick={handleNewEntry}
                >
                  <Plus size={14} />
                  {t('diary.writeFirstEntry')}
                </button>
              </div>
            ) : (
              <div className="relative">
                {entries.map((entry, idx) => {
                  const isSelected = entry.id === selectedId
                  const wordCount = calcWordCount(entry.contentMd)
                  const weatherIconMeta = entry.weatherSnapshot
                    ? getWeatherIconMeta(Number(entry.weatherSnapshot.weatherCode || 0))
                    : null
                  const weatherLabel = entry.weatherSnapshot
                    ? getLocalizedWeatherLabel(
                      Number(entry.weatherSnapshot.weatherCode || 0),
                      entry.weatherSnapshot.condition,
                      locale,
                    )
                    : ''
                  const preview = markdownToPreview(entry.contentMd).slice(0, 100)
                  return (
                    <div key={entry.id} className="group flex gap-3">
                      {/* Timeline indicator */}
                      <div className="diary-page__timeline-node flex w-5 shrink-0 flex-col items-center pt-3">
                        <div className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          isSelected
                            ? 'border-[color:var(--text-primary)] bg-background'
                            : 'border-border bg-background group-hover:border-[color:var(--text-primary)]/45',
                        )}>
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-primary)]" />}
                        </div>
                        {idx < entries.length - 1 && (
                          <div className="my-1 min-h-[1rem] w-px flex-1 bg-border/40" />
                        )}
                      </div>

                      {/* Card */}
                      <div className={cn(
                        'relative mb-3 flex-1 rounded-[var(--radius-lg)] border transition-all',
                        isSelected
                          ? 'diary-page__entry-card diary-page__entry-card--active border-rule-strong bg-paper-raised shadow-[var(--elev-1)]'
                          : 'diary-page__entry-card border-transparent bg-paper-sunken shadow-none hover:bg-paper-raised hover:shadow-[var(--elev-1)]',
                      )}>
                        <button
                          type="button"
                          className="w-full px-4 py-3.5 text-left"
                          onClick={() => void selectEntry(entry)}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span className={cn(
                              'diary-page__microcopy diary-page__numeric text-meta font-semibold uppercase tracking-[var(--tracking-caps)]',
                              isSelected ? 'text-[color:var(--text-primary)]' : 'text-muted-foreground',
                            )}>
                              {formatTime(entry.entryAt)}
                            </span>
                            {view !== 'day' && (
                              <span className="diary-page__microcopy diary-page__numeric text-meta font-semibold uppercase tracking-[var(--tracking-caps)] text-muted-foreground/70">{entry.dateKey}</span>
                            )}
                            {entry.weatherSnapshot && (
                              <span className="diary-page__timeline-weather max-w-[140px] truncate text-meta text-muted-foreground">
                                {weatherIconMeta && (
                                  <span className={`weather-icon ${weatherIconMeta.className}`} aria-hidden="true">
                                    <weatherIconMeta.Icon size={12} strokeWidth={2} />
                                  </span>
                                )}
                                <span className="truncate">
                                  {weatherLabel}
                                </span>
                                {entry.weatherSnapshot.temperatureMax != null
                                  ? ` ${Math.round(entry.weatherSnapshot.temperatureMax)}°`
                                  : ''}
                              </span>
                            )}
                          </div>
                          {preview ? (
                            <p className={cn(
                              'diary-page__timeline-preview line-clamp-2 text-sm leading-6',
                              isSelected ? 'text-foreground' : 'text-muted-foreground',
                            )}>
                              {preview}
                            </p>
                          ) : (
                            <p className="diary-page__timeline-preview text-sm italic text-muted-foreground/75">{t('diary.emptyEntry')}</p>
                          )}
                          <p className="diary-page__microcopy diary-page__numeric mt-2 text-meta uppercase tracking-[var(--tracking-caps)] text-muted-foreground/80">{wordCount}{t('diary.wordsShort')}</p>
                        </button>
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); void handleDeleteEntry(entry.id) }}
                          aria-label={t('diary.deleteEntry')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </section>

        {/* Right: Editor */}
        <main className="diary-page__editor-pane flex-1 overflow-hidden">
          {selectedEntry ? (
            <>
              {/* Metadata bar */}
              <div className="diary-page__meta-bar shrink-0 bg-transparent py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-start gap-3 md:gap-4">
                    <div className="diary-page__meta-hero rounded-2xl bg-background/72 px-4 py-3">
                      <p className="diary-page__meta-date text-foreground">{formatHeadlineDate(selectedEntry.dateKey, locale)}</p>
                      <div className="diary-page__meta-subline">
                        {selectedEntry.weatherSnapshot?.locationName ? (
                          <span className="diary-page__meta-location">
                            <span className="diary-page__meta-location-dot" aria-hidden="true" />
                            <span>{selectedEntry.weatherSnapshot.locationName}</span>
                          </span>
                        ) : null}
                        {selectedEntry.weatherSnapshot ? (
                          <span className="diary-page__meta-weather">
                            {(() => {
                              const weatherCode = Number(selectedEntry.weatherSnapshot.weatherCode || 0)
                              const metaIcon = getWeatherIconMeta(weatherCode)
                              return (
                                <>
                                  <span className={`weather-icon ${metaIcon.className}`} aria-hidden="true">
                                    <metaIcon.Icon size={13} strokeWidth={2} />
                                  </span>
                                  <span>
                                    {getLocalizedWeatherLabel(
                                      weatherCode,
                                      selectedEntry.weatherSnapshot.condition,
                                      locale,
                                    )}
                                    {selectedEntry.weatherSnapshot.temperatureMax != null
                                      ? `, ${Math.round(selectedEntry.weatherSnapshot.temperatureMax)}°`
                                      : ''}
                                  </span>
                                </>
                              )
                            })()}
                          </span>
                        ) : (
                          <span className="diary-page__meta-time diary-page__numeric">{formatTime(selectedEntry.entryAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <div className="diary-page__word-count diary-page__microcopy diary-page__numeric text-xs uppercase tracking-[var(--tracking-caps)] text-muted-foreground">
                      {calcWordCount(editorValue.contentMd)} {t('diary.words')}
                    </div>
                    <button
                      type="button"
                      className="rounded-full p-2 text-muted-foreground transition-all hover:bg-destructive/5 hover:text-destructive"
                      onClick={() => void handleDeleteEntry(selectedEntry.id)}
                      aria-label={t('diary.deleteEntry')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Editor */}
              <DiaryEditor
                value={editorValue}
                placeholder={t('diary.pagePlaceholder')}
                onChange={handleEditorChange}
                autoFocusKey={selectedId === focusEntryId ? focusEntryId : null}
              />
            </>
          ) : (
            <div className="diary-page__empty-state flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
              <div className="space-y-2">
                <p className="diary-page__microcopy text-meta font-semibold uppercase tracking-[var(--tracking-caps)] text-muted-foreground">{t('diary.workspace')}</p>
                <p className="diary-page__empty-copy text-sm">{t('diary.selectOrCreate')}</p>
                <p className="diary-page__empty-whisper text-sm text-muted-foreground/80">{t(diaryMoment.noteKey)}</p>
              </div>
              <button
                type="button"
                className="diary-page__secondary-cta"
                onClick={handleNewEntry}
              >
                <Plus size={14} />
                {entries.length === 0 ? t('diary.writeFirstEntry') : t('diary.newEntry')}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default DiaryPage
