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
import { readDiaryFont, writeDiaryFont } from '../../../shared/prefs/preferences'
import type { DiaryFontId } from '../../../shared/prefs/preferences'
import './diary-page.css'

// ── Font definitions ────────────────────────────────────────────────────────

type DiaryFont = { id: DiaryFontId; label: string; labelZh: string; css: string; sample: string }

const DIARY_FONTS: DiaryFont[] = [
  { id: 'fraunces',        label: 'Fraunces',  labelZh: '优雅衬线', css: "'Fraunces', serif",                               sample: 'The quiet world' },
  { id: 'lora',            label: 'Lora',      labelZh: '经典衬线', css: "'Lora', serif",                                   sample: 'The quiet world' },
  { id: 'playfair',        label: 'Playfair',  labelZh: '时尚衬线', css: "'Playfair Display', serif",                       sample: 'The quiet world' },
  { id: 'crimson',         label: 'Crimson',   labelZh: '文学体',   css: "'Crimson Pro', serif",                            sample: 'The quiet world' },
  { id: 'noto-serif-sc',   label: 'Noto Serif', labelZh: '宋体',    css: "'Noto Serif SC', serif",                          sample: '此刻宁静' },
  { id: 'zcool-xiaowei',   label: 'XiaoWei',   labelZh: '小薇体',   css: "'ZCOOL XiaoWei', 'Noto Serif SC', serif",         sample: '此刻宁静' },
  { id: 'ma-shan-zheng',   label: 'Ma Shan',   labelZh: '马善政',   css: "'Ma Shan Zheng', 'Noto Serif SC', serif",         sample: '此刻宁静' },
  { id: 'liu-jian-mao-cao', label: 'Liu Jian', labelZh: '流践体',   css: "'Liu Jian Mao Cao', 'Noto Serif SC', cursive",    sample: '此刻宁静' },
  { id: 'zcool-kuaile',    label: 'KuaiLe',    labelZh: '快乐体',   css: "'ZCOOL KuaiLe', 'Noto Serif SC', sans-serif",     sample: '此刻宁静' },
  { id: 'long-cang',       label: 'Long Cang', labelZh: '龙藏体',   css: "'Long Cang', 'Noto Serif SC', cursive",           sample: '此刻宁静' },
]

// ── FontPicker component ────────────────────────────────────────────────────

type FontPickerProps = { value: DiaryFontId; onChange: (id: DiaryFontId) => void }

const FontPicker = ({ value, onChange }: FontPickerProps) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const current = DIARY_FONTS.find((f) => f.id === value) ?? DIARY_FONTS[0]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="diary-font-picker" ref={containerRef}>
      <button
        type="button"
        className="diary-font-picker__btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="选择字体 / Choose font"
      >
        <span style={{ fontFamily: current.css }}>Aa</span>
        <span>{current.labelZh}</span>
      </button>
      {open && (
        <div className="diary-font-picker__panel" role="listbox">
          {DIARY_FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              role="option"
              aria-selected={font.id === value}
              className={cn('diary-font-picker__option', font.id === value && 'diary-font-picker__option--active')}
              onClick={() => { onChange(font.id); setOpen(false) }}
            >
              <span className="diary-font-picker__sample" style={{ fontFamily: font.css }}>{font.sample}</span>
              <span className="diary-font-picker__label">{font.labelZh} · {font.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type ViewMode = 'day' | 'week' | 'month'

// ── date range helpers ──────────────────────────────────────────────────────

function addDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

function startOfWeek(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`)
  const day = d.getDay()
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
  const text = contentMd.replace(/[#*`>\-_~\[\]()]/g, ' ').trim()
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
  const { t } = useI18n()
  const locale = t('diary.title') === '日记' ? 'zh' : 'en'
  const today = toDateKey()
  const [view, setView] = useState<ViewMode>('day')
  const [diaryFont, setDiaryFont] = useState<DiaryFontId>(() => readDiaryFont())

  const handleFontChange = useCallback((id: DiaryFontId) => {
    setDiaryFont(id)
    writeDiaryFont(id)
  }, [])
  const [selectedDateKey, setSelectedDateKey] = useState(today)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [allEntries, setAllEntries] = useState<DiaryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorValue, setEditorValue] = useState<DiaryEditorValue>({ contentMd: '', contentJson: null })
  const [, setSaving] = useState(false)
  const pendingSaveRef = useRef<DiaryEditorValue | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const selectedEntryRef = useRef<DiaryEntry | null>(null)

  // Keep refs in sync
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // Load range entries for timeline
  useEffect(() => {
    const [from, to] = getRangeForView(selectedDateKey, view)
    diaryRepo.listByRange(from, to).then((rows) => {
      setEntries(rows.filter((e) => !e.deletedAt).sort((a, b) => b.entryAt - a.entryAt))
    })
  }, [selectedDateKey, view])

  // Load all active entries once for stats
  useEffect(() => {
    diaryRepo.listActive().then(setAllEntries)
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

  const handleEditorChange = useCallback((next: DiaryEditorValue) => {
    pendingSaveRef.current = next
    setEditorValue(next)
    const entry = selectedEntryRef.current
    if (!entry) return
    setSaving(true)
    diaryRepo.update({ ...entry, contentMd: next.contentMd, contentJson: next.contentJson ?? null })
      .then((updated) => {
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
    selectedEntryRef.current = newEntry
    setSelectedId(newEntry.id)
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

  // Stats
  const stats = useMemo(() => {
    const active = allEntries.filter((e) => !e.deletedAt)
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
    { label: t('diary.streak'), value: `${stats.streak}d` },
    { label: t('diary.entriesLabel'), value: `${stats.total}` },
    { label: t('diary.thisWeek'), value: `${stats.thisWeek}` },
  ]

  return (
    <div className="diary-page flex h-full flex-col overflow-hidden bg-[color:var(--app-bg,#F5F3F0)]" data-coachmark-anchor="diary-page" data-diary-font={diaryFont}>
      <div className="diary-page__atmosphere" aria-hidden="true" />
      {/* Header */}
      <header className="diary-page__header z-10 shrink-0 bg-background/72 px-4 py-5 backdrop-blur md:px-6 md:py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <div className="space-y-2 pl-2 md:pl-4">
              <h2 className="diary-page__title text-xl font-semibold text-foreground">{t('diary.title')}</h2>
            </div>
            <div className="flex w-fit gap-1 rounded-2xl bg-muted/50 p-1">
                {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                className={cn(
                    'rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors',
                  view === v
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/70',
                )}
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
                <div key={item.label} className="rounded-xl bg-[color:rgba(245,243,240,0.7)] px-3 py-2">
                  <p className="diary-page__microcopy text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                  <p className="diary-page__numeric mt-1 text-sm font-semibold leading-none text-[color:#3A3733]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-full bg-[color:#3A3733] px-4 py-2.5 text-sm font-semibold text-[color:#F5F3F0] shadow-sm transition-all hover:opacity-95 active:scale-95"
                onClick={handleNewEntry}
              >
                <Plus size={16} />
                {t('diary.newEntry')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden xl:flex-row">
        {/* Left: Timeline */}
        <section className="diary-page__rail flex h-[22rem] shrink-0 flex-col overflow-hidden bg-background/52 xl:h-auto xl:w-[24rem]">
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
              <span className="diary-page__period-label flex-1 truncate text-center text-sm font-semibold text-[color:#3A3733]">
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
                  className="diary-page__period-empty-action flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
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
                  const preview = entry.contentMd
                    .replace(/^#{1,6}\s+/gm, '')
                    .replace(/[*_`~>\[\]()]/g, '')
                    .trim()
                    .slice(0, 100)
                  return (
                    <div key={entry.id} className="group flex gap-3">
                      {/* Timeline indicator */}
                      <div className="diary-page__timeline-node flex w-5 shrink-0 flex-col items-center pt-3">
                        <div className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          isSelected
                            ? 'border-[color:#3A3733] bg-background'
                            : 'border-border bg-background group-hover:border-[color:#3A3733]/45',
                        )}>
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-[color:#3A3733]" />}
                        </div>
                        {idx < entries.length - 1 && (
                          <div className="my-1 min-h-[1rem] w-px flex-1 bg-border/40" />
                        )}
                      </div>

                      {/* Card */}
                      <div className={cn(
                        'relative mb-3 flex-1 rounded-[1.25rem] border transition-all',
                        isSelected
                          ? 'diary-page__entry-card diary-page__entry-card--active border-[color:#3A3733]/10 bg-[color:rgba(237,232,225,0.96)] shadow-[0_14px_40px_rgba(58,55,51,0.10)]'
                          : 'diary-page__entry-card border-transparent bg-[color:rgba(241,237,231,0.72)] shadow-[0_10px_28px_rgba(58,55,51,0.08)] hover:bg-[color:rgba(238,233,226,0.92)] hover:shadow-[0_14px_34px_rgba(58,55,51,0.12)]',
                      )}>
                        <button
                          type="button"
                          className="w-full px-4 py-3.5 text-left"
                          onClick={() => void selectEntry(entry)}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span className={cn(
                              'diary-page__microcopy diary-page__numeric text-[11px] font-semibold uppercase tracking-[0.16em]',
                              isSelected ? 'text-[color:#3A3733]' : 'text-muted-foreground',
                            )}>
                              {formatTime(entry.entryAt)}
                            </span>
                            {view !== 'day' && (
                              <span className="diary-page__microcopy diary-page__numeric text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">{entry.dateKey}</span>
                            )}
                            {entry.weatherSnapshot && (
                              <span className="diary-page__timeline-weather max-w-[140px] truncate text-[10px] text-muted-foreground">
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
                            <p className="diary-page__timeline-preview text-sm italic text-muted-foreground/50">{t('diary.emptyEntry')}</p>
                          )}
                          <p className="diary-page__microcopy diary-page__numeric mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">{wordCount}{t('diary.wordsShort')}</p>
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
        <main className="diary-page__editor-pane flex-1 overflow-hidden bg-[color:rgba(245,243,240,0.4)]">
          {selectedEntry ? (
            <>
              {/* Metadata bar */}
              <div className="diary-page__meta-bar shrink-0 bg-background/50 py-4">
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
                    <div className="diary-page__word-count diary-page__microcopy diary-page__numeric text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {calcWordCount(editorValue.contentMd)} {t('diary.words')}
                    </div>
                    <FontPicker value={diaryFont} onChange={handleFontChange} />
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
              />
            </>
          ) : (
            <div className="diary-page__empty-state flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
              <div className="space-y-2">
                <p className="diary-page__microcopy text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('diary.workspace')}</p>
                <p className="diary-page__empty-copy text-sm">{t('diary.selectOrCreate')}</p>
                <p className="diary-page__empty-whisper text-sm text-muted-foreground/80">{t(diaryMoment.noteKey)}</p>
              </div>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={handleNewEntry}
              >
                <Plus size={14} />
                {t('diary.writeFirstEntry')}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default DiaryPage
