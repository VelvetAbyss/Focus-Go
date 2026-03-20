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

const DiaryLauncherCard = ({ onOpen }: DiaryLauncherCardProps) => {
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null)

  useEffect(() => {
    const todayKey = toDateKey()
    diaryRepo.getByDate(todayKey).then((entry) => setTodayEntry(entry ?? null))
  }, [])

  const hasContent = useMemo(() => Boolean(todayEntry?.contentMd && !todayEntry.deletedAt), [todayEntry])

  const hasReviewSnapshot = useMemo(() => {
    if (!hasContent) return false
    return hasReviewBlock(todayEntry.contentMd)
  }, [hasContent, todayEntry])

  const handleClick = () => onOpen('openToday')

  return (
    <Card
      title="Diary"
      eyebrow="Today"
      className="card--clickable diary-launcher-card"
      onClick={handleClick}
      actions={
        <Button
          variant="outline"
          size="sm"
          className="diary-launcher-card__open"
          onClick={(e) => {
            e.stopPropagation()
            handleClick()
          }}
        >
          {hasContent ? 'Continue' : 'Open'}
        </Button>
      }
    >
      <div className="diary-launcher-card__meta">
        <p className="diary-launcher-card__date">{toDateKey()}</p>
        <span className="diary-launcher-card__chip">{hasContent ? 'Updated' : 'New'}</span>
      </div>
      {hasReviewSnapshot ? <p className="diary-launcher-card__snapshot">Review snapshot included</p> : null}
    </Card>
  )
}

export default DiaryLauncherCard
