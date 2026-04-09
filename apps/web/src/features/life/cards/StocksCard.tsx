import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import Card from '../../../shared/ui/Card'
import Dialog from '../../../shared/ui/Dialog'
import Button from '../../../shared/ui/Button'
import { AppNumber } from '../../../shared/ui/AppNumber'
import type { StockItem } from '../../../data/models/types'
import { stocksRepo } from '../../../data/repositories/stocksRepo'
import { hasTwelveDataKey, searchRemoteStocks, type RemoteStockCandidate } from '../stocksApi'

const StocksCard = () => {
  const [open, setOpen] = useState(false)
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RemoteStockCandidate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const searchAreaRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(() => stocks.find((item) => item.id === selectedId) ?? null, [stocks, selectedId])
  const gainers = stocks.filter((item) => (item.changePercent ?? 0) >= 0).length

  const loadStocks = async () => {
    const rows = await stocksRepo.list()
    setStocks(rows)
    setSelectedId((current) => current ?? rows[0]?.id ?? null)
  }

  useEffect(() => {
    void loadStocks()
  }, [])

  useEffect(() => {
    if (!open) {
      setResults([])
      return
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchAreaRef.current?.contains(event.target as Node)) setResults([])
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const handleSearch = async () => {
    if (!hasTwelveDataKey()) {
      setHint('Set VITE_TWELVEDATA_API_KEY to enable live stock search.')
      return
    }
    const nextQuery = query.trim()
    if (!nextQuery) return
    setSearching(true)
    setHint(null)
    try {
      setResults(await searchRemoteStocks(nextQuery))
    } catch {
      setHint('Stock search failed. Try another symbol.')
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (candidate: RemoteStockCandidate) => {
    const existing = stocks.find((item) => item.symbol === candidate.symbol)
    if (existing) {
      const updated = await stocksRepo.update(existing.id, { ...candidate, lastSyncedAt: Date.now() })
      if (updated) {
        setStocks((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
        setSelectedId(updated.id)
      }
      return
    }
    const created = await stocksRepo.create({ ...candidate, pinned: true })
    setStocks((current) => [created, ...current.filter((item) => item.id !== created.id)])
    setSelectedId(created.id)
  }

  const handlePatch = async (patch: Partial<StockItem>) => {
    if (!selected) return
    const updated = await stocksRepo.update(selected.id, patch)
    if (!updated) return
    setStocks((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
    setSelectedId(updated.id)
  }

  const handleRemove = async (id: string) => {
    await stocksRepo.remove(id)
    const next = stocks.filter((item) => item.id !== id)
    setStocks(next)
    setSelectedId(next[0]?.id ?? null)
  }

  return (
    <>
      <Card eyebrow="Markets" title="Stocks" className="life-card life-card--stocks" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
        <div className="life-card__body">
          {stocks.length > 0 ? (
            <div className="life-stocks__ticker-list">
              {stocks.slice(0, 4).map((item) => (
                <div key={item.id} className="life-stocks__ticker-row">
                  <span className="life-stocks__ticker-sym">{item.symbol}</span>
                  <span className="life-stocks__ticker-line" />
                  {typeof item.lastPrice === 'number' ? (
                    <span className={`life-stocks__ticker-price ${(item.changePercent ?? 0) >= 0 ? 'is-up' : 'is-down'}`}>
                      ${item.lastPrice.toFixed(2)}
                    </span>
                  ) : (
                    <span className="life-stocks__ticker-price">—</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="life-stocks__empty">
              <div className="life-stocks__empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              </div>
              <p className="life-stocks__empty-text">Track symbols you care about</p>
            </div>
          )}

          <div className="life-card__stats">
            <div className="life-stat">
              <span className="life-stat__value"><AppNumber value={stocks.length} animated /></span>
              <span className="life-stat__label">watching</span>
            </div>
            <div className="life-stat life-stat--muted">
              <span className="life-stat__value"><AppNumber value={gainers} animated /></span>
              <span className="life-stat__label">positive</span>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} panelClassName="life-modal__panel" contentClassName="life-modal__content">
        <div className="life-modal__header">
          <div>
            <p className="life-modal__eyebrow">MARKETS</p>
            <h2 className="life-modal__title">Stocks</h2>
          </div>
          <button type="button" className="life-modal__close" onClick={() => setOpen(false)} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div ref={searchAreaRef}>
          <div className="life-modal__search-bar">
            <input
              className="life-search__input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void handleSearch() }}
              placeholder="Search symbol or company…"
            />
            <Button type="button" onClick={() => void handleSearch()} disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>

          {hint ? <p className="life-search__hint" style={{ padding: '0 24px' }}>{hint}</p> : null}

          {results.length > 0 ? (
            <div className="life-modal__results">
              {results.map((item) => (
                <button key={item.symbol} type="button" className="life-results__item" onClick={() => void handleAdd(item)}>
                  <div>
                    <strong>{item.symbol}</strong>
                    <p>{item.name}</p>
                  </div>
                  <span className="life-results__add">+</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="life-modal__body">
          <aside className="life-modal__sidebar">
            {stocks.length === 0 ? <p className="life-search__hint">No symbols yet. Search to add one.</p> : null}
            {stocks.map((item) => (
              <button key={item.id} type="button" className={`life-modal__list-item${selectedId === item.id ? ' is-active' : ''}`} onClick={() => setSelectedId(item.id)}>
                <div className="life-modal__stock-badge">
                  <span className="life-modal__stock-symbol">{item.symbol}</span>
                </div>
                <div className="life-modal__list-meta">
                  <strong>{item.symbol}</strong>
                  <p>{item.name}</p>
                </div>
                <span className={`life-modal__stock-price ${(item.changePercent ?? 0) >= 0 ? 'is-up' : 'is-down'}`}>
                  {typeof item.lastPrice === 'number' ? `$${item.lastPrice.toFixed(2)}` : '—'}
                </span>
              </button>
            ))}
          </aside>

          <div className="life-modal__detail">
            {selected ? (
              <>
                <div className="life-modal__detail-hero">
                  <div className="life-modal__stocks-hero-text">
                    <h3 className="life-modal__detail-title">{selected.symbol}</h3>
                    <p className="life-modal__detail-author">{selected.name}</p>
                    <p className="life-modal__detail-meta">{selected.exchange ?? 'Unknown exchange'} · {selected.currency}</p>
                  </div>
                  {typeof selected.lastPrice === 'number' ? (
                    <div className="life-modal__stocks-price">
                      <strong>${selected.lastPrice.toFixed(2)}</strong>
                      <span className={(selected.changePercent ?? 0) >= 0 ? 'is-up' : 'is-down'}>
                        {(selected.change ?? 0) >= 0 ? '+' : ''}{(selected.change ?? 0).toFixed(2)}
                        {' / '}
                        {(selected.changePercent ?? 0) >= 0 ? '+' : ''}{(selected.changePercent ?? 0).toFixed(2)}%
                      </span>
                    </div>
                  ) : null}
                </div>

                {selected.chartPoints?.length ? (
                  <div className="life-stock-chart" aria-hidden="true">
                    {selected.chartPoints.map((point, index) => (
                      <motion.span
                        key={`${selected.id}-${index}`}
                        className="life-stock-chart__bar"
                        style={{ height: `${Math.max(18, Math.round(point % 80) + 18)}px` }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.24, delay: index * 0.04 }}
                      />
                    ))}
                  </div>
                ) : null}

                <label className="life-field">
                  <span>Note</span>
                  <textarea
                    className="life-field__textarea"
                    value={selected.note ?? ''}
                    onChange={(event) => void handlePatch({ note: event.target.value })}
                    placeholder="Why are you tracking this symbol?"
                  />
                </label>

                <label className="life-field life-field--inline">
                  <span>Pinned</span>
                  <input type="checkbox" checked={selected.pinned} onChange={(event) => void handlePatch({ pinned: event.target.checked })} />
                </label>

                <div className="life-modal__detail-actions">
                  <Button type="button" className="button button--ghost" onClick={() => void handleRemove(selected.id)}>
                    Remove
                  </Button>
                </div>
              </>
            ) : (
              <div className="life-modal__empty">
                <p>Select a symbol to view quote details and notes.</p>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </>
  )
}

export default StocksCard
