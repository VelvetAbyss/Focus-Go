import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import Card from '../../../shared/ui/Card'
import { diaryRepo } from '../../../data/repositories/diaryRepo'
import type { DiaryEntry } from '../../../data/models/types'
import { toDateKey } from '../../../shared/utils/time'
import { hasReviewBlock } from '../../diary/review/reviewDiaryBridge'

type DiaryLauncherCardProps = {
  onOpen: (intent?: 'openToday') => void
}

const formatLastEdited = (timestamp: number) => {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Last edited · Just now'
  if (mins < 60) return `Last edited · ${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Last edited · ${hours}h ago`
  return 'Last edited · >1 day ago'
}

const DiaryLauncherCard = ({ onOpen }: DiaryLauncherCardProps) => {
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null)

  useEffect(() => {
    const todayKey = toDateKey()
    diaryRepo.getByDate(todayKey).then((entry) => setTodayEntry(entry ?? null))
  }, [])

  const status = useMemo(() => {
    if (!todayEntry?.contentMd || todayEntry.deletedAt) return 'Start a short note for today.'
    return formatLastEdited(todayEntry.updatedAt)
  }, [todayEntry])

  const preview = useMemo(() => {
    if (!todayEntry?.contentMd || todayEntry.deletedAt) return ''
    const cleaned = todayEntry.contentMd.replace(/\s+/g, ' ').trim()
    return cleaned.slice(0, 60)
  }, [todayEntry])

  const hasReviewSnapshot = useMemo(() => {
    if (!todayEntry?.contentMd || todayEntry.deletedAt) return false
    return hasReviewBlock(todayEntry.contentMd)
  }, [todayEntry])

  const handleClick = () => onOpen('openToday')

  return (
    <Card
      title="Diary"
      eyebrow="Today"
      className="card--clickable"
      onClick={handleClick}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleClick()
          }}
        >
          Open
        </Button>
      }
    >
      <p className="diary__date">{toDateKey()}</p>
      <p className="diary__status">{status}</p>
      {hasReviewSnapshot ? <p className="diary__status">Includes review snapshot</p> : null}
      {preview && <p className="diary__preview">{preview}</p>}
    </Card>
  )
}

export default DiaryLauncherCard
