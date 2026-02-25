import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
}

const ReviewHistoryPanel = ({ className, maxHeightClassName }: ReviewHistoryPanelProps) => {
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
  }, [])

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

  if (loading) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
          <CardDescription>Loading review snapshots...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
          <CardDescription>No review snapshots found in diary records yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={cn('h-full overflow-hidden', className)}>
      <CardHeader>
        <CardTitle>Review History</CardTitle>
        <CardDescription>Recent diary snapshots captured via Review submit.</CardDescription>
      </CardHeader>
      <CardContent className={cn('space-y-3 overflow-y-auto pr-1', maxHeightClassName)}>
        {rows.map((row) => {
          const latest = row.blocks[0]
          const expanded = expandedDate === row.dateKey
          return (
            <div key={row.entryId} className="rounded-md border p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{row.dateKey}</h3>
                  <Badge variant="secondary">{row.blocks.length} snapshot(s)</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Latest submit: {formatSubmittedAt(latest.submittedAt)}
                </p>
                {latest.summary.reflectionPreview ? (
                  <p className="text-sm text-muted-foreground">{latest.summary.reflectionPreview}</p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedDate(expanded ? null : row.dateKey)}
                >
                  {expanded ? 'Hide snapshots' : 'Show snapshots'}
                </Button>
              </div>

              {expanded ? (
                <div className="mt-3 space-y-2">
                  {row.blocks.map((block) => (
                    <div key={`${row.entryId}-${block.submittedAt}`} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">
                        Submitted at {formatSubmittedAt(block.submittedAt)}
                      </p>
                      {block.summary.focusScore ? (
                        <p className="mt-1 text-sm">Focus score: {block.summary.focusScore}</p>
                      ) : null}
                      {block.summary.reflectionPreview ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {block.summary.reflectionPreview}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">No reflection text.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default ReviewHistoryPanel
