import { WidgetExpandedContext, useWidgetSummary } from '../dashboard/widgetPresentation'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { matchSpendCategory, parseSpendInput } from './parseSpend'
import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import Card from '../../shared/ui/Card'
import Select from '../../shared/ui/Select'
import { spendRepo } from '../../data/repositories/spendRepo'
import type { SpendCategory, SpendEntry } from '../../data/models/types'
import { toDateKey } from '../../shared/utils/time'
import { AppNumber } from '../../shared/ui/AppNumber'
import { useI18n } from '../../shared/i18n/useI18n'
import { convertToBase, currencyToSymbol } from '../../lib/currency'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { renderSpendIcon } from './spendIcons'
import { Trash2 } from 'lucide-react'
import AnimatedScrollList from '../../shared/ui/AnimatedScrollList'
import { triggerTabGroupSwitchAnimation, triggerTabPressAnimation } from '../../shared/ui/tabPressAnimation'
import { DiscoveryEmptyState } from '../../shared/ui/EmptyState'
import SpendDetail from './SpendDetail'
import { getSpendCategoryOptions } from './spendCategories'

type SpendView = 'today' | 'trend'
type SpendChartComponentType = typeof import('./SpendChart')['default']

const SpendCard = () => {
  const { t, language } = useI18n()
  const expanded = useContext(WidgetExpandedContext)
  const tabs = useMemo(
    () =>
      [
        { key: 'today' as const, label: t('spend.today') },
        { key: 'trend' as const, label: t('spend.trend') },
      ] as const,
    [t],
  )
  const [now, setNow] = useState(() => new Date())
  const [entries, setEntries] = useState<SpendEntry[]>([])
  const [categories, setCategories] = useState<SpendCategory[]>([])
  // What was typed: "午饭 28", "28 打车", "$12". Parsed into amount, currency, category and note.
  const [draft, setDraft] = useState('')
  const [currencyChoice, setCurrency] = useState('')
  const [categoryChoice, setCategoryId] = useState('')
  const [lastSelection, setLastSelection] = useState({ categoryId: '', currency: '' })
  const [detailDate, setDetailDate] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<'amount' | 'save' | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const writePending = useRef(false)
  const resolvedPresets = useRef(new Map<string, Promise<string>>())
  const [view, setView] = useState<SpendView>('today')
  const [SpendChartComponent, setSpendChartComponent] = useState<SpendChartComponentType | null>(null)
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const { defaultCurrency } = usePreferences()
  const amountRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([spendRepo.listEntries(), spendRepo.listCategories()]).then(([data, cats]) => {
      if (!active) return
      setEntries(data)
      setCategories(cats)
      setLoadState('ready')
    }, () => {
      if (active) setLoadState('error')
    })
    return () => { active = false }
  }, [])

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

  useEffect(() => {
    if (view !== 'trend' || SpendChartComponent) return
    void import('./SpendChart').then((mod) => {
      setSpendChartComponent(() => mod.default)
    })
  }, [SpendChartComponent, view])

  const todayKey = useMemo(() => toDateKey(now), [now])
  const totalTodayBase = useMemo(() => {
    const todayEntries = entries.filter((entry) => entry.dateKey === todayKey)
    const total = todayEntries.reduce(
      (sum, entry) => sum + convertToBase(entry.amount, entry.currency, defaultCurrency),
      0
    )
    return { total, count: todayEntries.length }
  }, [defaultCurrency, entries, todayKey])

  const categoriesById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]))
  }, [categories])

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.createdAt - a.createdAt)
  }, [entries])
  const todayEntries = useMemo(
    () => sortedEntries.filter((entry) => entry.dateKey === todayKey),
    [sortedEntries, todayKey]
  )

  const activeIndex = useMemo(() => {
    const next = tabs.findIndex((tab) => tab.key === view)
    return next < 0 ? 0 : next
  }, [tabs, view])
  const tabMotionStyle = useMemo(
    () =>
      ({
        '--tab-count': `${tabs.length}`,
        '--tab-active-index': `${activeIndex}`,
      }) as CSSProperties,
    [activeIndex, tabs.length]
  )
  const resolvedActiveEntryId = useMemo(() => {
    if (!activeEntryId) return null
    return entries.some((entry) => entry.id === activeEntryId) ? activeEntryId : null
  }, [activeEntryId, entries])

  const deleteEntry = async (id: string) => {
    await spendRepo.deleteEntry(id)
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  const { options, fallbackId } = useMemo(() => getSpendCategoryOptions(categories, language), [categories, language])
  const parsedDraft = parseSpendInput(draft)
  const suggestedCategory = parsedDraft ? matchSpendCategory(parsedDraft.note, options) : null
  const categoryId = categoryChoice || suggestedCategory?.id || lastSelection.categoryId || fallbackId
  const currency = currencyChoice || parsedDraft?.currency || lastSelection.currency || (defaultCurrency === 'USD' ? 'USD' : 'CNY')

  const changeDraft = (value: string) => {
    setDraft(value)
    setError(null)
    setAnnouncement(null)
  }

  const resolveCategoryId = async (pickedId: string) => {
    const option = options.find(category => category.id === pickedId)
    const existing = resolvedPresets.current.get(pickedId)
    if (existing) return existing
    if (!option?.preset) return pickedId
    const pending = spendRepo.addCategory({ name: option.name, icon: option.icon }).then(created => {
      setCategories(prev => [...prev, created])
      return created.id
    }, (failure: unknown) => {
      resolvedPresets.current.delete(pickedId)
      throw failure
    })
    resolvedPresets.current.set(pickedId, pending)
    return pending
  }

  const addEntry = async (dateKey = todayKey) => {
    if (writePending.current || loadState !== 'ready') return
    const parsed = parsedDraft
    if (!parsed) {
      setError('amount')
      amountRef.current?.focus()
      return
    }
    writePending.current = true
    setSaving(true)
    setError(null)
    try {
      const nextCategoryId = await resolveCategoryId(categoryId)
      const created = await spendRepo.addEntry({
        amount: parsed.amount,
        currency,
        categoryId: nextCategoryId,
        ...(parsed.note ? { note: parsed.note.slice(0, 60) } : {}),
        dateKey,
      })
      setEntries(prev => [...prev, created])
      setLastSelection({ categoryId: nextCategoryId, currency })
      setCategoryId('')
      setCurrency('')
      setDraft('')
      setAnnouncement(language === 'zh' ? '已记下这一笔' : 'Expense recorded')
      listRef.current?.scrollTo({ top: 0, behavior: 'auto' })
      if (document.activeElement === amountRef.current || window.matchMedia('(pointer: fine)').matches) {
        amountRef.current?.focus()
      }
    } catch {
      setError('save')
    } finally {
      writePending.current = false
      setSaving(false)
    }
  }

  const updateEntry = async (entry: SpendEntry) => {
    const categoryId = await resolveCategoryId(entry.categoryId)
    const saved = await spendRepo.updateEntry({ ...entry, categoryId })
    setEntries(prev => prev.map(item => item.id === saved.id ? saved : item))
  }

  useWidgetSummary({ value: `${currencyToSymbol(defaultCurrency)}${totalTodayBase.total.toFixed(2)}`, detail: t('spend.today'), items: todayEntries.slice(0, 3).map(entry => `${currencyToSymbol(entry.currency)}${entry.amount}`) })

  if (expanded) {
    return (
      <SpendDetail
        today={todayKey} date={detailDate ?? todayKey}
        onDate={date => setDetailDate(date === todayKey ? null : date)}
        entries={sortedEntries} categories={options} baseCurrency={defaultCurrency}
        draft={draft} onDraft={changeDraft} inputRef={amountRef}
        currency={currency} onCurrency={setCurrency} categoryId={categoryId} onCategory={setCategoryId}
        loadState={loadState} saving={saving} error={error} announcement={announcement}
        onAdd={addEntry} onUpdate={updateEntry} onDelete={deleteEntry}
      />
    )
  }

  return (
    <Card title={t('spend.title')} eyebrow={t('spend.today')}>
      <div className="spend-fg">
        <div className="spend-fg__tabs tab-motion-group" role="tablist" aria-label={t('spend.title')} style={tabMotionStyle}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              className={`spend-fg__tab tab-motion-tab ${view === tab.key ? 'is-active' : ''}`}
              onClick={(event) => {
                triggerTabPressAnimation(event.currentTarget)
                triggerTabGroupSwitchAnimation(event.currentTarget)
                setView(tab.key)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="spend-fg__viewport" aria-label="Spend panels">
          <div className="spend-fg__track" style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}>
            <section className="spend-fg__panel" role="tabpanel" aria-label={t('spend.today')}>
              <div className="spend">
                <div className="spend__total">
                  <span className="muted">{t('spend.totalToday')}</span>
                  <div className="spend__amount">
                    {totalTodayBase.count === 0 ? (
                      <span className="muted">{t('spend.noEntries')}</span>
                    ) : (
                      <div className="spend__amount-row spend__amount-row--main">
                        <AppNumber
                          prefix={`${currencyToSymbol(defaultCurrency)} `}
                          value={totalTodayBase.total}
                          format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="spend__form" aria-busy={saving}>
                  <input
                    ref={amountRef}
                    type="text"
                    readOnly={saving}
                    value={draft}
                    onChange={(event) => changeDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                      event.preventDefault()
                      void addEntry()
                    }}
                    placeholder={t('spend.quickPlaceholder')}
                    aria-label={t('spend.amount')}
                    autoComplete="off"
                  />
                  <Select
                    value={currency}
                    options={[
                      { value: 'CNY', label: currencyToSymbol('CNY') },
                      { value: 'USD', label: currencyToSymbol('USD') },
                    ]}
                    onChange={(v) => setCurrency(v)}
                  />
                  <Select
                    value={categoryId}
                    options={options.map((category) => ({
                      value: category.id,
                      label: (
                        <span className="spend__category-option">
                          <span className="spend__category-icon">{renderSpendIcon(category.icon, { size: 16 })}</span>
                          <span>{category.name}</span>
                        </span>
                      ),
                    }))}
                    onChange={(v) => setCategoryId(v)}
                  />
                  <Button size="sm" className="spend__add-btn" onClick={() => void addEntry()} disabled={saving || loadState !== 'ready'}>
                    {t('spend.add')}
                  </Button>
                </div>

                <AnimatedScrollList
                  items={todayEntries}
                  className="spend__list-wrap"
                  getKey={(entry) => entry.id}
                  listClassName="spend__list spend__list--scroll"
                  showGradients
                  itemDelay={0.1}
                  setListRef={(node) => {
                    listRef.current = node
                  }}
                  emptyState={
                    <DiscoveryEmptyState
                      variant="first-time"
                      illustration="ice-cream"
                      illustrationHeight={72}
                      title={t('empty.spend.title')}
                      body={t('empty.spend.description')}
                    />
                  }
                  renderItem={(entry) => {
                    const category = categoriesById.get(entry.categoryId)
                    return (
                      <div
                        className={`spend__item ${resolvedActiveEntryId === entry.id ? 'is-active' : ''}`}
                        tabIndex={0}
                        onClick={() => setActiveEntryId(entry.id)}
                        onFocus={() => setActiveEntryId(entry.id)}
                        aria-label={category?.name ?? t('spend.category')}
                      >
                        <span className="spend__item-left">
                          <span className="spend__item-icon">{renderSpendIcon(category?.icon, { size: 16 })}</span>
                          {entry.note ? <span className="spend__item-note">{entry.note}</span> : null}
                        </span>
                        <span className="spend__item-right">
                          <AppNumber
                            prefix={`${currencyToSymbol(entry.currency)} `}
                            value={entry.amount}
                            format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                          />
                          <button
                            type="button"
                            className="spend__delete"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              void deleteEntry(entry.id)
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                             aria-label={t('spend.deleteEntry')}
                             title={t('spend.deleteEntry')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </span>
                      </div>
                    )
                  }}
                />
              </div>
            </section>

            <section className="spend-fg__panel" role="tabpanel" aria-label={t('spend.trend')}>
              <div className="spend__trend">
                {view === 'trend' ? (
                  SpendChartComponent ? <SpendChartComponent entries={entries} now={now} /> : <div className="min-h-[160px] sm:min-h-[200px]" aria-hidden="true" />
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default SpendCard
