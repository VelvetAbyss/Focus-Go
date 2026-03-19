import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { diaryRepo } from '../../../data/repositories/diaryRepo'
import type { DiaryEntry } from '../../../data/models/types'
import { extractReviewBlocks, hasReviewBlock } from './reviewDiaryBridge'

type HistoryRow = {
  dateKey: string
  entryId: string
  blocks: ReturnType<typeof extractReviewBlocks>
}

const formatSubmittedAt = (value: number) => format(new Date(value), 'yyyy-MM-dd HH:mm')

type ReviewHistoryPanelProps = {
  className?: string
  maxHeightClassName?: string
  refreshKey?: number
}

const ReviewHistoryPanel = ({
  className,
  maxHeightClassName,
  refreshKey = 0,
}: ReviewHistoryPanelProps) => {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const list = await diaryRepo.listActive()
      if (cancelled) return
      setEntries(list)
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const rows = useMemo<HistoryRow[]>(
    () =>
      entries
        .filter((entry) => hasReviewBlock(entry.contentMd ?? ''))
        .map((entry) => ({
          dateKey: entry.dateKey,
          entryId: entry.id,
          blocks: extractReviewBlocks(entry.contentMd ?? ''),
        }))
        .filter((row) => row.blocks.length > 0)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [entries]
  )

  const header = (
    <div className="mb-5 flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f0f0]">
        <BookOpen size={14} className="text-[#999]" />
      </div>
      <h2
        className="text-[#555]"
        style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '1rem', fontWeight: 500 }}
      >
        Your reflections
      </h2>
    </div>
  )

  if (loading) {
    return (
      <div className={cn('review-history-panel h-full rounded-2xl border border-[#eee] bg-[#fafafa] p-5 lg:p-6', className)}>
        {header}
        <p
          className="text-[#bbb]"
          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 300 }}
        >
          Loading your review history...
        </p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={cn('review-history-panel h-full rounded-2xl border border-[#eee] bg-[#fafafa] p-5 lg:p-6', className)}>
        {header}
        <div className="py-10 text-center">
          <p
            className="text-[#bbb]"
            style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 300 }}
          >
            Your past reflections will appear here.
          </p>
          <p
            className="mt-1 text-[#ddd]"
            style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.75rem', fontWeight: 300 }}
          >
            One day at a time.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('review-history-panel h-full rounded-2xl border border-[#eee] bg-[#fafafa] p-5 lg:p-6', className)}>
      {header}

      <div className={cn('review-history-scrollbar space-y-1.5 overflow-y-auto pr-1', maxHeightClassName)}>
        {rows.map((row) => {
          const latest = row.blocks[0]
          const expanded = expandedDate === row.dateKey
          const date = new Date(`${row.dateKey}T00:00:00`)
          const dayLabel = format(date, 'EEEE')
          const dateLabel = format(date, 'MMM d')
          const summaryLine = latest.summary.summaryLine || latest.summary.reflectionPreview

          return (
            <motion.div
              key={row.entryId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <button
                type="button"
                onClick={() => setExpandedDate(expanded ? null : row.dateKey)}
                className="group w-full cursor-pointer text-left"
              >
                <div
                  className={`rounded-xl px-4 py-3 transition-all duration-300 ${
                    expanded ? 'bg-white shadow-[0_1px_4px_rgba(58, 55, 51, 0.04)]' : 'hover:bg-white/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span
                          className="shrink-0 text-[#999]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.7rem', fontWeight: 400 }}
                        >
                          {dayLabel}
                        </span>
                        <span className="text-[#ccc]" style={{ fontSize: '0.65rem' }}>
                          {dateLabel}
                        </span>
                      </div>
                      <p
                        className="truncate text-[#444]"
                        style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '0.88rem', fontWeight: 400 }}
                      >
                        {summaryLine || <span className="italic text-[#ccc]">No summary</span>}
                      </p>
                    </div>
                    <motion.div
                      animate={{ rotate: expanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-1 shrink-0"
                    >
                      <ChevronDown size={13} className="text-[#ccc] transition-colors group-hover:text-[#999]" />
                    </motion.div>
                  </div>

                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2.5 space-y-2 border-t border-[#f0f0f0] pt-2.5">
                          {row.blocks.map((block) => (
                            <div key={`${row.entryId}-${block.submittedAt}`} className="space-y-2">
                              <p
                                className="text-[#aaa]"
                                style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.7rem', fontWeight: 400 }}
                              >
                                Saved at {formatSubmittedAt(block.submittedAt)}
                              </p>
                              {block.summary.tomorrow ? (
                                <div>
                                  <span
                                    className="text-[#aaa]"
                                    style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.7rem', fontWeight: 400 }}
                                  >
                                    Tomorrow&apos;s focus
                                  </span>
                                  <p
                                    className="mt-0.5 text-[#555]"
                                    style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '0.85rem' }}
                                  >
                                    {block.summary.tomorrow}
                                  </p>
                                </div>
                              ) : null}
                              {block.summary.focusScore ? (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-[#aaa]"
                                    style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.7rem', fontWeight: 400 }}
                                  >
                                    Focus
                                  </span>
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                      <div
                                        key={value}
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          value <= Number(block.summary.focusScore) ? 'bg-[#3a3733]' : 'bg-[#e5e5e5]'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {block.summary.reflectionPreview ? (
                                <div>
                                  <span
                                    className="text-[#aaa]"
                                    style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.7rem', fontWeight: 400 }}
                                  >
                                    Reflection
                                  </span>
                                  <p
                                    className="mt-0.5 text-[#555]"
                                    style={{
                                      fontFamily: "'Lora', 'Georgia', serif",
                                      fontSize: '0.82rem',
                                      lineHeight: '1.6',
                                    }}
                                  >
                                    {block.summary.reflectionPreview}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default ReviewHistoryPanel
