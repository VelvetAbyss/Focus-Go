import { useEffect, useMemo, useState } from 'react'
import { diaryRepo } from '../../../data/repositories/diaryRepo'
import { focusRepo } from '../../../data/repositories/focusRepo'
import { notesRepo } from '../../../data/repositories/notesRepo'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { toDateKey } from '../../../shared/utils/time'
import { DailyReviewCardSurface } from '../components/DailyReviewCardSurface'
import { buildDailyReviewAnalytics, type DailyReviewAnalytics } from './dailyReviewAnalytics'
import { buildDailyReviewPresentationModel } from './lifeDesignAdapters'
import { subscribeTasksChanged } from '../../tasks/taskSync'

type RangeKey = 'week' | 'month'

const emptyAnalytics: DailyReviewAnalytics = {
  summary: {
    completedTasks: 0,
    completedSubtasks: 0,
    focusMinutes: 0,
    diaryWritten: false,
    noteChars: 0,
    focusPresenceMinutes: 0,
  },
  completedTasks: [],
}

const DailyReviewCard = () => {
  const [open, setOpen] = useState(false)
  const [activeRange, setActiveRange] = useState<RangeKey>('week')
  const [todayAnalytics, setTodayAnalytics] = useState<DailyReviewAnalytics>(emptyAnalytics)
  const [weekAnalytics, setWeekAnalytics] = useState<DailyReviewAnalytics>(emptyAnalytics)
  const [monthAnalytics, setMonthAnalytics] = useState<DailyReviewAnalytics>(emptyAnalytics)

  useEffect(() => {
    const load = async () => {
      const now = Date.now()
      const oldestDate = new Date(now - 29 * 24 * 60 * 60 * 1000)
      const [tasks, sessions, diaries, notes] = await Promise.all([
        tasksRepo.list(),
        focusRepo.listSessions(),
        diaryRepo.listByRange(toDateKey(oldestDate), toDateKey(new Date(now))),
        notesRepo.list(),
      ])
      const input = { tasks, sessions, diaries, notes, now }
      setTodayAnalytics(buildDailyReviewAnalytics({ ...input, granularity: 'today' }))
      setWeekAnalytics(buildDailyReviewAnalytics({ ...input, granularity: 'week' }))
      setMonthAnalytics(buildDailyReviewAnalytics({ ...input, granularity: 'month' }))
    }
    void load()
    return subscribeTasksChanged(() => {
      void load()
    })
  }, [])

  const designModel = useMemo(
    () => buildDailyReviewPresentationModel(todayAnalytics, weekAnalytics, monthAnalytics),
    [monthAnalytics, todayAnalytics, weekAnalytics],
  )

  return (
    <DailyReviewCardSurface
      model={designModel}
      open={open}
      activeRange={activeRange}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onRangeChange={setActiveRange}
    />
  )
}

export default DailyReviewCard
