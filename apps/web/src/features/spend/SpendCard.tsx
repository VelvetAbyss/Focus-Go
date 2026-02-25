import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import Card from '../../shared/ui/Card'
import Select from '../../shared/ui/Select'
import { spendRepo } from '../../data/repositories/spendRepo'
import type { SpendCategory, SpendEntry } from '../../data/models/types'
import { toDateKey } from '../../shared/utils/time'
import { AppNumber } from '../../shared/ui/AppNumber'
import SpendChart from './SpendChart'
import { convertToBase, currencyToSymbol } from '../../lib/currency'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { EMOJI_TO_ICON_KEY, renderSpendIcon } from './spendIcons'
import { Trash2 } from 'lucide-react'
import AnimatedScrollList from '../../shared/ui/AnimatedScrollList'
import { triggerTabGroupSwitchAnimation, triggerTabPressAnimation } from '../../shared/ui/tabPressAnimation'
const tabs = [
  { key: 'today', label: 'Today' },
  { key: 'trend', label: 'Trend' },
] as const

type SpendView = (typeof tabs)[number]['key']

const SpendCard = () => {
  const [now, setNow] = useState(() => new Date())
  const [entries, setEntries] = useState<SpendEntry[]>([])
  const [categories, setCategories] = useState<SpendCategory[]>([])
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState('CNY')
  const [categoryId, setCategoryId] = useState('')
  const [view, setView] = useState<SpendView>('today')
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const { defaultCurrency } = usePreferences()
  const amountRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    Promise.all([spendRepo.listEntries(), spendRepo.listCategories()]).then(([data, cats]) => {
      setEntries(data)
      setCategories(cats)
      setCategoryId(cats[0]?.id ?? '')

      const needsMigration = cats.some((c) => c.icon && c.icon in EMOJI_TO_ICON_KEY)
      if (needsMigration) {
        void Promise.all(
          cats.map(async (category) => {
            if (!category.icon) return
            const mapped = EMOJI_TO_ICON_KEY[category.icon]
            if (!mapped) return
            await spendRepo.updateCategory({ ...category, icon: mapped })
          })
        ).then(() => {
          void spendRepo.listCategories().then((next) => setCategories(next))
        })
      }
    })
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
  }, [view])
  const tabMotionStyle = useMemo(
    () =>
      ({
        '--tab-count': `${tabs.length}`,
        '--tab-active-index': `${activeIndex}`,
      }) as CSSProperties,
    [activeIndex]
  )
  const resolvedActiveEntryId = useMemo(() => {
    if (!activeEntryId) return null
    return entries.some((entry) => entry.id === activeEntryId) ? activeEntryId : null
  }, [activeEntryId, entries])

  const deleteEntry = async (id: string) => {
    await spendRepo.deleteEntry(id)
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  const addEntry = async () => {
    if (!categoryId || !amount) return
    const created = await spendRepo.addEntry({
      amount,
      currency,
      categoryId,
      dateKey: todayKey,
    })
    setEntries((prev) => [...prev, created])
    setAmount(0)
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTo({ top: 0, behavior: 'auto' })
    })
    amountRef.current?.focus()
  }

  return (
    <Card title="Spend" eyebrow="Today">
      <div className="spend-fg">
        <div className="spend-fg__tabs tab-motion-group" role="tablist" aria-label="Spend views" style={tabMotionStyle}>
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
            <section className="spend-fg__panel" role="tabpanel" aria-label="Spend today">
              <div className="spend">
                <div className="spend__total">
                  <span className="muted">Total today</span>
                  <div className="spend__amount">
                    {totalTodayBase.count === 0 ? (
                      <span className="muted">No entries yet</span>
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

                <div className="spend__form">
                  <input
                    ref={amountRef}
                    type="number"
                    value={amount || ''}
                    min={0}
                    step={0.01}
                    onChange={(event) => setAmount(Number(event.target.value))}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      void addEntry()
                    }}
                    placeholder="Amount"
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
                    options={categories.map((category) => ({
                      value: category.id,
                      label: (
                        <span className="spend__category-option">
                          <span className="spend__category-icon">{renderSpendIcon(category.icon, { size: 16 })}</span>
                        </span>
                      ),
                    }))}
                    onChange={(v) => setCategoryId(v)}
                  />
                  <Button size="sm" className="spend__add-btn" onClick={addEntry}>
                    Add
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
                  emptyState={<div className="spend__empty muted">No entries</div>}
                  renderItem={(entry) => {
                    const category = categoriesById.get(entry.categoryId)
                    return (
                      <div
                        className={`spend__item ${resolvedActiveEntryId === entry.id ? 'is-active' : ''}`}
                        tabIndex={0}
                        onClick={() => setActiveEntryId(entry.id)}
                        onFocus={() => setActiveEntryId(entry.id)}
                        aria-label={category?.name ?? 'Category'}
                      >
                        <span className="spend__item-left">
                          <span className="spend__item-icon">{renderSpendIcon(category?.icon, { size: 16 })}</span>
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
                            aria-label="Delete entry"
                            title="Delete entry"
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

            <section className="spend-fg__panel" role="tabpanel" aria-label="Spend trend">
              <div className="spend__trend">
                <SpendChart />
              </div>
            </section>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default SpendCard
