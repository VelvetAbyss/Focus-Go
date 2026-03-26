import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Card from '../../../shared/ui/Card'
import { diaryRepo } from '../../../data/repositories/diaryRepo'
import type { DiaryEntry } from '../../../data/models/types'
import { toDateKey } from '../../../shared/utils/time'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ROUTES } from '../../../app/routes/routes'

const DiaryLauncherCard = () => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null)

  useEffect(() => {
    const todayKey = toDateKey()
    diaryRepo.getByDate(todayKey).then((entry) => setTodayEntry(entry ?? null))
  }, [])

  const hasContent = useMemo(() => Boolean(todayEntry?.contentMd && !todayEntry.deletedAt), [todayEntry])

  const handleClick = () => navigate(ROUTES.DIARY)

  return (
    <Card
      title={t('diaryLauncher.cardTitle')}
      eyebrow={t('diaryLauncher.eyebrow')}
      className="card--clickable diary-launcher-card"
      data-coachmark-anchor="dashboard-diary"
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
          {hasContent ? t('diaryLauncher.continue') : t('diaryLauncher.open')}
        </Button>
      }
    >
      <div className="diary-launcher-card__meta">
        <p className="diary-launcher-card__date">{toDateKey()}</p>
        <span className="diary-launcher-card__chip">{hasContent ? t('diaryLauncher.updated') : t('diaryLauncher.new')}</span>
      </div>
    </Card>
  )
}

export default DiaryLauncherCard
