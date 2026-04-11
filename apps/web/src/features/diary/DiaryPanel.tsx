import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSyncDataRefresh } from '../../data/sync/service'
import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { BookText, Calendar, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import Drawer from '../../shared/ui/Drawer'
import Dialog from '../../shared/ui/Dialog'
import { AppNumber } from '../../shared/ui/AppNumber'
import { diaryRepo } from '../../data/repositories/diaryRepo'
import type { DiaryEntry } from '../../data/models/types'
import { toDateKey } from '../../shared/utils/time'
import AnimatedScrollList from '../../shared/ui/AnimatedScrollList'
import { triggerTabGroupSwitchAnimation, triggerTabPressAnimation } from '../../shared/ui/tabPressAnimation'
import { useI18n } from '../../shared/i18n/useI18n'
import EmptyState from '../../shared/ui/EmptyState'
import './diary.css'

type DiaryPanelProps = {
  open: boolean
  intent?: 'openToday'
  onClose: () => void
}

type ViewMode = 'today' | 'history' | 'trash'

type ConfirmIntent =
  | { type: 'closePanel' }
  | { type: 'setView'; view: ViewMode }
  | { type: 'openDetail'; dateKey: string; entry: DiaryEntry | undefined }
  | { type: 'closeDetail' }

const canSaveText = (text: string) => text.trim().length > 0

const isValidDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

const buildPastDateKeys = (days: number, baseDate: Date = new Date()) => {
  const base = new Date(baseDate)
  const dates: string[] = []
  for (let i = 1; i <= days; i += 1) {
    const next = new Date(base)
    next.setDate(base.getDate() - i)
    dates.push(toDateKey(next))
  }
  return dates
}

const DiaryPanel = ({ open, intent, onClose }: DiaryPanelProps) => {
  const { t } = useI18n()
  const tabs = useMemo(
    () => [
      { key: 'today' as const, label: t('diary.today') },
      { key: 'history' as const, label: t('diary.history') },
      { key: 'trash' as const, label: t('diary.trash') },
    ],
    [t],
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const [now, setNow] = useState(() => new Date())
  const todayKey = useMemo(() => toDateKey(now), [now])
  const todayDateLabel = useMemo(() => format(now, 'EEEE, MMMM d').toUpperCase(), [now])
  const historyPresetDates = useMemo(() => buildPastDateKeys(7, now), [now])

  const [view, setView] = useState<ViewMode>('today')
  const [activeDate, setActiveDate] = useState(todayKey)
  const [todayContent, setTodayContent] = useState('')
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [trashEntries, setTrashEntries] = useState<DiaryEntry[]>([])
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [detailContent, setDetailContent] = useState('')
  const [detailEntry, setDetailEntry] = useState<DiaryEntry | null>(null)
  const [historyActiveDateKey, setHistoryActiveDateKey] = useState<string | null>(null)

  const [detailIsSaving, setDetailIsSaving] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmIntentRef = useRef<ConfirmIntent | null>(null)
  const todayAutoSaveTimerRef = useRef<number | null>(null)

  const editorRef = useRef<HTMLTextAreaElement>(null)
  const detailEditorRef = useRef<HTMLTextAreaElement>(null)
  const historyListRef = useRef<HTMLDivElement>(null)
  const historyScrollTopRef = useRef(0)

  useEffect(() => {
    let timeoutId: number | null = null

    const scheduleMidnightRefresh = () => {
      const current = new Date()
      const nextMidnight = new Date(current)
      nextMidnight.setHours(24, 0, 0, 0)
      const msUntilMidnight = nextMidnight.getTime() - current.getTime()

      timeoutId = window.setTimeout(() => {
        setNow(new Date())
        scheduleMidnightRefresh()
      }, msUntilMidnight + 1000)
    }

    scheduleMidnightRefresh()

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    const list = await diaryRepo.listActive()
    setEntries(list)
  }, [])

  const loadTrash = useCallback(async () => {
    const list = await diaryRepo.listTrash()
    setTrashEntries(list)
  }, [])

  useSyncDataRefresh(loadHistory)

  useEffect(() => {
    if (!open) return
    setActiveDate(todayKey)
    diaryRepo.markExpiredOlderThan(30).then(() => loadHistory())
  }, [open, todayKey, loadHistory])

  useEffect(() => {
    if (!open) return
    const urlTab = searchParams.get('diaryTab')
    const urlDate = searchParams.get('date')

    const nextView: ViewMode = urlTab === 'today' || urlTab === 'history' || urlTab === 'trash' ? urlTab : 'today'
    const nextSelectedDateKey =
      nextView === 'history' && urlDate && isValidDateKey(urlDate) ? urlDate : null

    setView(nextView)
    setSelectedDateKey(nextSelectedDateKey)
    setHistoryActiveDateKey(nextSelectedDateKey)
  }, [open, searchParams])

  useEffect(() => {
    if (!open) return
    if (intent === 'openToday') {
      setView('today')
      setActiveDate(todayKey)
      setSelectedDateKey(null)
      setHistoryActiveDateKey(null)
    }
  }, [open, intent, todayKey])

  useEffect(() => {
    if (!open) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('diary', '1')
        next.set('diaryTab', view)
        if (view === 'history' && selectedDateKey) next.set('date', selectedDateKey)
        else next.delete('date')
        return next
      },
      { replace: true }
    )
  }, [open, setSearchParams, view, selectedDateKey])

  useEffect(() => {
    if (!open) return
    if (view === 'history') {
      loadHistory()
    }
    if (view === 'trash') {
      loadTrash()
    }
  }, [open, view, loadHistory, loadTrash])

  useEffect(() => {
    if (!open || view !== 'today') return
    if (selectedDateKey) return
    let cancelled = false
    diaryRepo.getByDate(activeDate).then((entry) => {
      if (cancelled) return
      if (entry?.deletedAt) {
        setTodayEntry(null)
        setTodayContent('')
        return
      }
      setTodayEntry(entry ?? null)
      setTodayContent(entry?.contentMd ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [activeDate, open, view, selectedDateKey])

  useEffect(() => {
    if (open && view === 'today' && editorRef.current && !selectedDateKey) {
      setTimeout(() => editorRef.current?.focus(), 100)
    }
  }, [open, view, activeDate, selectedDateKey])

  useEffect(() => {
    if (open && view === 'history' && selectedDateKey && detailEditorRef.current) {
      setTimeout(() => detailEditorRef.current?.focus(), 100)
    }
  }, [open, view, selectedDateKey])

  useEffect(() => {
    if (!open || !selectedDateKey) return
    let cancelled = false
    diaryRepo.getByDate(selectedDateKey).then((entry) => {
      if (cancelled) return
      if (!entry || entry.deletedAt) {
        setDetailEntry(null)
        setDetailContent('')
        return
      }
      setDetailEntry(entry)
      setDetailContent(entry.contentMd ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [selectedDateKey, open])

  const updateEntryInHistory = useCallback((entry: DiaryEntry) => {
    setEntries((prev) => {
      const index = prev.findIndex((existing) => existing.dateKey === entry.dateKey)
      if (index === -1) return [entry, ...prev].sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      const next = [...prev]
      next[index] = entry
      return next.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    })
  }, [])

  const saveToday = useCallback(async () => {
    if (!canSaveText(todayContent)) return false
    try {
      const existing = await diaryRepo.getByDate(activeDate)
      if (existing) {
        const updated = await diaryRepo.update({
          ...existing,
          contentMd: todayContent,
          deletedAt: null,
          expiredAt: null,
        })
        setTodayEntry(updated)
        updateEntryInHistory(updated)
      } else {
        const created = await diaryRepo.add({
          dateKey: activeDate,
          entryAt: Date.now(),
          contentMd: todayContent,
          contentJson: null,
          tags: [],
          deletedAt: null,
          expiredAt: null,
        })
        setTodayEntry(created)
        updateEntryInHistory(created)
      }
      return true
    } catch (err) {
      console.error('Failed to save diary entry', err)
      return false
    }
  }, [activeDate, todayContent, updateEntryInHistory])

  const saveDetail = async () => {
    if (!selectedDateKey) return false
    if (!canSaveText(detailContent)) return false
    setDetailIsSaving(true)
    try {
      const existing = await diaryRepo.getByDate(selectedDateKey)
      if (existing) {
        const updated = await diaryRepo.update({
          ...existing,
          contentMd: detailContent,
          deletedAt: null,
          expiredAt: null,
        })
        setDetailEntry(updated)
        updateEntryInHistory(updated)
      } else {
        const created = await diaryRepo.add({
          dateKey: selectedDateKey,
          entryAt: Date.now(),
          contentMd: detailContent,
          contentJson: null,
          tags: [],
          deletedAt: null,
          expiredAt: null,
        })
        setDetailEntry(created)
        updateEntryInHistory(created)
      }
      return true
    } catch (err) {
      console.error('Failed to save diary entry', err)
      return false
    } finally {
      setDetailIsSaving(false)
    }
  }

  const openDetail = (dateKey: string, entry: DiaryEntry | undefined) => {
    historyScrollTopRef.current = historyListRef.current?.scrollTop ?? 0
    setHistoryActiveDateKey(dateKey)
    setSelectedDateKey(dateKey)
    if (entry) {
      setDetailEntry(entry)
      setDetailContent(entry.contentMd ?? '')
    } else {
      setDetailEntry(null)
      setDetailContent('')
    }
  }

  const closeDetail = () => {
    setSelectedDateKey(null)
    requestAnimationFrame(() => {
      if (historyListRef.current) {
        historyListRef.current.scrollTop = historyScrollTopRef.current
      }
    })
  }

  const discardDetail = () => {
    setDetailContent(detailEntry?.contentMd ?? '')
  }

  const todaySavedContent = todayEntry?.contentMd ?? ''
  const detailSavedContent = detailEntry?.contentMd ?? ''
  const todayDirty = todayContent !== todaySavedContent
  const detailDirty = selectedDateKey ? detailContent !== detailSavedContent : false

  const runIntent = async (nextIntent: ConfirmIntent) => {
    if (nextIntent.type === 'closePanel') {
      onClose()
      return
    }

    if (nextIntent.type === 'setView') {
      if (selectedDateKey) closeDetail()
      setView(nextIntent.view)
      return
    }

    if (nextIntent.type === 'openDetail') {
      openDetail(nextIntent.dateKey, nextIntent.entry)
      return
    }

    if (nextIntent.type === 'closeDetail') {
      closeDetail()
    }
  }

  const requestIntent = async (nextIntent: ConfirmIntent) => {
    if (detailDirty) {
      confirmIntentRef.current = nextIntent
      setConfirmOpen(true)
      return
    }

    if (todayAutoSaveTimerRef.current) {
      window.clearTimeout(todayAutoSaveTimerRef.current)
      todayAutoSaveTimerRef.current = null
    }

    if (todayDirty && canSaveText(todayContent)) {
      await saveToday()
    }

    await runIntent(nextIntent)
  }

  const confirmSave = async () => {
    if (detailDirty) {
      if (!canSaveText(detailContent)) return
      const ok = await saveDetail()
      if (!ok) return
    }

    setConfirmOpen(false)
    const next = confirmIntentRef.current
    confirmIntentRef.current = null
    if (next) await runIntent(next)
  }

  const confirmDiscard = async () => {
    if (detailDirty) discardDetail()

    setConfirmOpen(false)
    const next = confirmIntentRef.current
    confirmIntentRef.current = null
    if (next) await runIntent(next)
  }

  const handleSoftDelete = async (dateKey: string) => {
    const deleted = await diaryRepo.softDeleteByDate(dateKey)
    if (!deleted) return
    setEntries((prev) => prev.filter((entry) => entry.dateKey !== dateKey))
    if (activeDate === dateKey) {
      setTodayEntry(null)
      setTodayContent('')
    }
    if (selectedDateKey === dateKey) {
      closeDetail()
    }
    await loadTrash()
    setView('trash')
  }

  const handleRestore = async (dateKey: string) => {
    await diaryRepo.restoreByDate(dateKey)
    await loadTrash()
    await loadHistory()
  }

  const handleHardDelete = async (dateKey: string) => {
    await diaryRepo.hardDeleteByDate(dateKey)
    await loadTrash()
    await loadHistory()
  }

  useEffect(() => {
    if (!open || view !== 'today' || selectedDateKey) return
    if (!todayDirty || !canSaveText(todayContent)) return

    if (todayAutoSaveTimerRef.current) {
      window.clearTimeout(todayAutoSaveTimerRef.current)
    }

    todayAutoSaveTimerRef.current = window.setTimeout(() => {
      void saveToday()
      todayAutoSaveTimerRef.current = null
    }, 500)

    return () => {
      if (todayAutoSaveTimerRef.current) {
        window.clearTimeout(todayAutoSaveTimerRef.current)
        todayAutoSaveTimerRef.current = null
      }
    }
  }, [open, view, selectedDateKey, todayDirty, todayContent, saveToday])

  const activeViewIndex = useMemo(() => {
    const next = tabs.findIndex((tab) => tab.key === view)
    return next < 0 ? 0 : next
  }, [tabs, view])
  const tabMotionStyle = useMemo(
    () =>
      ({
        '--tab-count': `${tabs.length}`,
        '--tab-active-index': `${activeViewIndex}`,
      }) as CSSProperties,
    [activeViewIndex, tabs.length]
  )
  const historyEntryMap = useMemo(() => {
    const map = new Map<string, DiaryEntry>()
    entries.forEach((entry) => map.set(entry.dateKey, entry))
    return map
  }, [entries])
  const visibleTrashEntries = useMemo(() => trashEntries.filter((entry) => Boolean(entry.deletedAt)), [trashEntries])

  const tabTitle = selectedDateKey ? selectedDateKey : view === 'today' ? t('diary.today') : view === 'history' ? t('diary.history') : t('diary.trash')

  return (
    <Drawer open={open} title="" onClose={() => void requestIntent({ type: 'closePanel' })} hideHeader>
      <div className="diary-fg">
        <div className="diary-fg__header">
          <h1 className="diary-fg__title">
            {t('diary.title')} · <span className="diary-fg__title-accent">{tabTitle}</span>
          </h1>
          <div className="diary-fg__tabs-row">
            <div className="diary-fg__tabs tab-motion-group" role="tablist" aria-label={t('diary.views')} style={tabMotionStyle}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={view === tab.key}
                  className={`diary-fg__tab tab-motion-tab ${view === tab.key ? 'is-active' : ''}`}
                  onClick={(event) => {
                    triggerTabPressAnimation(event.currentTarget)
                    triggerTabGroupSwitchAnimation(event.currentTarget)
                    void requestIntent({ type: 'setView', view: tab.key })
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="diary-fg__icon-btn"
              onClick={() => void requestIntent({ type: 'closePanel' })}
              aria-label={t('diary.close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="diary-fg__content">
          <div className="diary-fg__viewport" aria-label={t('diary.panels')}>
            <div className="diary-fg__track" style={{ transform: `translate3d(-${activeViewIndex * 100}%, 0, 0)` }}>
              <section className="diary-fg__panel" role="tabpanel" aria-label={t('diary.todayPanel')}>
                <section className="diary-fg__view diary-fg__view--today">
                  {!selectedDateKey && (
                    <>
                      <div className="diary-fg__today-row">
                        <div className="diary-fg__date">
                          <Calendar size={16} />
                          <span>{todayDateLabel}</span>
                        </div>
                      </div>

                      <div className="diary-fg__editor-card">
                        <textarea
                          ref={editorRef}
                          className="diary-fg__editor"
                          value={todayContent}
                          onChange={(event) => setTodayContent(event.target.value)}
                          placeholder={t('diary.placeholder')}
                        />
                        <div className="diary-fg__char-count">
                          <AppNumber value={todayContent.length} /> {t('diary.characters')}
                        </div>
                      </div>
                    </>
                  )}
                </section>
              </section>

              <section className="diary-fg__panel" role="tabpanel" aria-label={t('diary.historyPanel')}>
                <section className="diary-fg__view diary-fg__view--history">
                  {selectedDateKey ? (
                    <div className="diary-fg__detail">
                      <div className="diary-fg__detail-header">
                        <Button
                          variant="outline"
                          className="button button--ghost"
                          onClick={() => void requestIntent({ type: 'closeDetail' })}
                        >
                          {t('diary.back')}
                        </Button>
                        <div className="diary-fg__detail-actions">
                          <Button
                            className="button diary-fg__save-btn"
                            onClick={() => void saveDetail()}
                            disabled={detailIsSaving || !canSaveText(detailContent)}
                          >
                            {detailIsSaving ? t('diary.saving') : t('diary.save')}
                          </Button>
                          <Button
                            variant="destructive"
                            className="button button--danger"
                            onClick={() => void handleSoftDelete(selectedDateKey)}
                          >
                            {t('diary.delete')}
                          </Button>
                        </div>
                      </div>
                      <div className="diary-fg__editor-card diary-fg__editor-card--detail">
                        <textarea
                          ref={detailEditorRef}
                          className="diary-fg__editor"
                          value={detailContent}
                          onChange={(event) => setDetailContent(event.target.value)}
                          placeholder={t('diary.historyPlaceholder')}
                        />
                        <div className="diary-fg__char-count">
                          <AppNumber value={detailContent.length} /> {t('diary.characters')}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="diary-fg__section-title">{t('diary.entries')}</h2>
                      {entries.length === 0 ? (
                        <EmptyState
                          icon={<BookText size={22} />}
                          title={t('empty.diary.historyTitle')}
                          description={t('empty.diary.historyDescription')}
                          className="mb-4 border-0 bg-transparent px-0 py-8 shadow-none"
                        />
                      ) : null}
                      <AnimatedScrollList
                        items={historyPresetDates}
                        getKey={(dateKey) => dateKey}
                        className="diary-fg__list-wrap"
                        listClassName="diary-fg__list"
                        showGradients
                        itemDelay={0.1}
                        setListRef={(node) => {
                          historyListRef.current = node
                        }}
                        renderItem={(dateKey) => {
                          const entry = historyEntryMap.get(dateKey)
                          return (
                            <div className={`diary-fg__row is-empty ${historyActiveDateKey === dateKey ? 'is-active' : ''}`}>
                              <button
                                className="diary-fg__row-main"
                                onClick={() => void requestIntent({ type: 'openDetail', dateKey, entry })}
                                type="button"
                              >
                                <span className="diary-fg__row-date">{dateKey}</span>
                              </button>
                            </div>
                          )
                        }}
                      />
                    </>
                  )}
                </section>
              </section>

              <section className="diary-fg__panel" role="tabpanel" aria-label={t('diary.trashPanel')}>
                <section className="diary-fg__view diary-fg__view--trash">
                  {visibleTrashEntries.length === 0 ? (
                    <EmptyState
                      icon={<Trash2 size={22} />}
                      title={t('empty.diary.trashTitle')}
                      description={t('empty.diary.trashDescription')}
                      className="border-0 bg-transparent px-0 py-12 shadow-none"
                    />
                  ) : (
                    <div className="diary-fg__list-wrap">
                      <div className="diary-fg__list diary-fg__trash-list">
                        {visibleTrashEntries.map((entry) => {
                          const isExpired = Boolean(entry.expiredAt)
                          const preview = entry.contentMd?.replace(/\s+/g, ' ').trim() ?? ''
                          return (
                            <div key={entry.id} className={`diary-fg__trash-row ${isExpired ? 'is-expired' : ''}`}>
                              <div className="diary-fg__trash-row-main">
                                <span className="diary-fg__row-date">{entry.dateKey}</span>
                                <span className="diary-fg__row-preview">{preview || t('diary.noContent')}</span>
                                <span className="diary-fg__trash-status">{isExpired ? t('diary.expired') : t('diary.recoverable')}</span>
                              </div>
                              <div className="diary-fg__trash-actions">
                                {!isExpired ? (
                                  <Button className="button button--ghost" onClick={() => void handleRestore(entry.dateKey)}>
                                    {t('diary.restore')}
                                  </Button>
                                ) : null}
                                <Button className="button button--ghost" onClick={() => void handleHardDelete(entry.dateKey)}>
                                  {t('diary.permanentlyDelete')}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </section>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} title={t('diary.unsavedTitle')} onClose={() => setConfirmOpen(false)}>
        <div className="diary-fg__confirm">
          <p className="diary-fg__confirm-text">{t('diary.unsavedDesc')}</p>
          <div className="diary-fg__confirm-actions">
            <Button
              className="button"
              onClick={() => void confirmSave()}
              disabled={!detailDirty || !canSaveText(detailContent)}
            >
              {t('diary.save')}
            </Button>
            <Button className="button button--ghost" onClick={() => void confirmDiscard()}>
              {t('diary.discard')}
            </Button>
            <Button className="button button--ghost" onClick={() => setConfirmOpen(false)}>
              {t('diary.cancel')}
            </Button>
          </div>
        </div>
      </Dialog>
    </Drawer>
  )
}

export default DiaryPanel
