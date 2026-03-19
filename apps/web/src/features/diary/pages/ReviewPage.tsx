import { useState } from 'react'
import { diaryRepo } from '../../../data/repositories/diaryRepo'
import { toDateKey } from '../../../shared/utils/time'
import ReviewDeck from '../review/ReviewDeck'
import ReviewHistoryPanel from '../review/ReviewHistoryPanel'
import {
  appendReviewBlock,
  buildSubmitPayload,
  type ReviewSubmitPayload,
} from '../review/reviewDiaryBridge'
import { useReviewSessionStore } from '../review/reviewSessionStore'
import '../review/review.css'

const ReviewPage = () => {
  const [isSubmittingDiary, setIsSubmittingDiary] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const { state, updateAnswer, submitReview, restartReview } = useReviewSessionStore([])

  const handleSubmit = async () => {
    if (isSubmittingDiary) return
    setSubmitError(null)
    setIsSubmittingDiary(true)
    const todayKey = toDateKey()
    const payload: ReviewSubmitPayload = buildSubmitPayload(state.answers, Date.now())

    try {
      const existing = await diaryRepo.getByDate(todayKey)
      const nextContent = appendReviewBlock(existing?.contentMd ?? '', payload)

      if (existing) {
        await diaryRepo.update({
          ...existing,
          contentMd: nextContent,
          deletedAt: null,
          expiredAt: null,
        })
      } else {
        await diaryRepo.add({
          dateKey: todayKey,
          contentMd: nextContent,
          tags: [],
          deletedAt: null,
          expiredAt: null,
        })
      }

      submitReview()
      setHistoryRefreshKey((current) => current + 1)
    } catch {
      setSubmitError('Failed to save review snapshot to diary. Please try again.')
    } finally {
      setIsSubmittingDiary(false)
    }
  }

  return (
    <section className="review-page-shell review-page-shell--themed review-shadcn-scope flex flex-col">
      <div className="review-page-shell__content mx-auto grid min-h-full w-full max-w-6xl flex-1 grid-cols-1 gap-4 px-3 py-4 sm:px-4 sm:py-5 md:grid-cols-3 md:gap-6 md:px-6 md:py-8">
        <div className="md:col-span-2" aria-label="Review workflow">
          {submitError ? <p className="mb-3 text-sm text-destructive">{submitError}</p> : null}
          <ReviewDeck
            summary={typeof state.answers.summary === 'string' ? state.answers.summary : ''}
            tomorrow={typeof state.answers.tomorrow === 'string' ? state.answers.tomorrow : ''}
            inboxSnapshot={
              typeof state.answers.inboxSnapshot === 'string'
                ? state.answers.inboxSnapshot
                : typeof state.answers.inboxCount === 'string'
                  ? state.answers.inboxCount
                  : ''
            }
            inboxCleared={state.answers.inboxCleared === true}
            focusScore={typeof state.answers.focusScore === 'number' ? state.answers.focusScore : null}
            longerReflection={typeof state.answers.reflectionNote === 'string' ? state.answers.reflectionNote : ''}
            mustDo1={typeof state.answers.mustDo1 === 'string' ? state.answers.mustDo1 : ''}
            mustDo2={typeof state.answers.mustDo2 === 'string' ? state.answers.mustDo2 : ''}
            mustDo3={typeof state.answers.mustDo3 === 'string' ? state.answers.mustDo3 : ''}
            isComplete={state.isComplete}
            isSubmittingDiary={isSubmittingDiary}
            onSubmit={handleSubmit}
            onRestart={() => {
              setSubmitError(null)
              restartReview()
            }}
            onSummaryChange={(value) => updateAnswer('summary', value)}
            onTomorrowChange={(value) => updateAnswer('tomorrow', value)}
            onInboxSnapshotChange={(value) => {
              updateAnswer('inboxSnapshot', value)
              updateAnswer('inboxCount', value)
            }}
            onInboxClearedChange={(value) => updateAnswer('inboxCleared', value)}
            onFocusScoreChange={(value) => updateAnswer('focusScore', value)}
            onLongerReflectionChange={(value) => updateAnswer('reflectionNote', value)}
            onMustDo1Change={(value) => updateAnswer('mustDo1', value)}
            onMustDo2Change={(value) => updateAnswer('mustDo2', value)}
            onMustDo3Change={(value) => updateAnswer('mustDo3', value)}
          />
        </div>

        <aside className="md:col-span-1 md:overflow-hidden" aria-label="Review history">
          <ReviewHistoryPanel
            className="h-full"
            maxHeightClassName="md:max-h-[calc(100vh-220px)]"
            refreshKey={historyRefreshKey}
          />
        </aside>
      </div>
    </section>
  )
}

export default ReviewPage
