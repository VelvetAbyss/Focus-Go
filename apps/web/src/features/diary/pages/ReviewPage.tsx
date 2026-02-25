import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { diaryRepo } from '../../../data/repositories/diaryRepo'
import { toDateKey } from '../../../shared/utils/time'
import ReviewDeck from '../review/ReviewDeck'
import ReviewHistoryPanel from '../review/ReviewHistoryPanel'
import type { ReviewStepDefinition } from '../review/ReviewDeck'
import {
  appendReviewBlock,
  buildSubmitPayload,
  type ReviewSubmitPayload,
} from '../review/reviewDiaryBridge'
import { type ReviewStepRule, useReviewSessionStore } from '../review/reviewSessionStore'
import '../review/review.css'

type LifecycleStep = {
  id: string
  onEnter?: () => void
  onLeave?: () => void
}

const toText = (value: string | number | boolean | null | undefined) =>
  typeof value === 'string' ? value : ''

const toBool = (value: string | number | boolean | null | undefined) => value === true

const ReviewPage = () => {
  const [navigationDirection, setNavigationDirection] = useState<1 | -1>(1)
  const [isSubmittingDiary, setIsSubmittingDiary] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const lifecycleSteps = useMemo<LifecycleStep[]>(
    () => [{ id: 'inbox' }, { id: 'reflect' }, { id: 'plan' }, { id: 'close' }],
    []
  )

  const stepRules = useMemo<ReviewStepRule[]>(
    () =>
      lifecycleSteps.map((step) => ({
        id: step.id,
        canProceed: () => true,
      })),
    [lifecycleSteps]
  )

  const { state, canProceed, goNext, goBack, updateAnswer, submitReview, restartReview } =
    useReviewSessionStore(stepRules)

  const steps = useMemo<ReviewStepDefinition[]>(
    () => [
      {
        id: 'Clear Inbox',
        title: 'Clear Inbox',
        description: 'Quick triage before reflection. Keep zero friction and keep moving.',
        content: (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="review-inbox-count">Inbox count (snapshot)</Label>
              <Input
                id="review-inbox-count"
                inputMode="numeric"
                value={toText(state.answers.inboxCount)}
                onChange={(event) => updateAnswer('inboxCount', event.target.value)}
                placeholder="0"
                aria-describedby="review-inbox-help"
              />
              <p id="review-inbox-help" className="text-xs text-muted-foreground">
                Temporary scaffold field. `InboxZeroStep` integration will replace this input.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="review-inbox-cleared"
                checked={toBool(state.answers.inboxCleared)}
                onCheckedChange={(checked) => updateAnswer('inboxCleared', checked === true)}
              />
              <Label htmlFor="review-inbox-cleared" className="text-sm font-normal">
                Mark inbox as reviewed for this session
              </Label>
            </div>
          </div>
        ),
      },
      {
        id: 'Reflect',
        title: 'Reflect',
        description: 'Capture what worked and what to adjust while memory is still fresh.',
        content: (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="review-focus-score">Focus score</Label>
              <Input
                id="review-focus-score"
                value={toText(state.answers.focusScore)}
                onChange={(event) => updateAnswer('focusScore', event.target.value)}
                placeholder="e.g. 78"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="review-reflection-note">Daily reflection</Label>
              <Textarea
                id="review-reflection-note"
                value={toText(state.answers.reflectionNote)}
                onChange={(event) => updateAnswer('reflectionNote', event.target.value)}
                placeholder="Write one useful observation from today."
                className="min-h-32"
              />
            </div>
          </div>
        ),
      },
      {
        id: 'Plan Tomorrow',
        title: 'Plan Tomorrow',
        description: 'Lock tomorrow’s top priorities. Drag-and-drop will land in the next wave.',
        content: (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="review-must-do-1">Must-do #1</Label>
              <Input
                id="review-must-do-1"
                value={toText(state.answers.mustDo1)}
                onChange={(event) => updateAnswer('mustDo1', event.target.value)}
                placeholder="Primary task"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="review-must-do-2">Must-do #2</Label>
              <Input
                id="review-must-do-2"
                value={toText(state.answers.mustDo2)}
                onChange={(event) => updateAnswer('mustDo2', event.target.value)}
                placeholder="Secondary task"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="review-must-do-3">Must-do #3</Label>
              <Input
                id="review-must-do-3"
                value={toText(state.answers.mustDo3)}
                onChange={(event) => updateAnswer('mustDo3', event.target.value)}
                placeholder="Tertiary task"
              />
            </div>
          </div>
        ),
      },
      {
        id: 'Close',
        title: 'Close',
        description: 'Finalize and commit the day closure ritual.',
        content: (
          <div className="grid gap-3">
            <Badge variant="secondary" className="w-fit gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready for submit
            </Badge>
            <p className="text-sm text-muted-foreground">
              Completion seal animation remains intentionally deferred to the next wave.
            </p>
          </div>
        ),
      },
    ],
    [state.answers, updateAnswer]
  )

  useEffect(() => {
    if (state.isComplete) return
    const activeStep = lifecycleSteps[state.currentStep]
    activeStep?.onEnter?.()
    return () => activeStep?.onLeave?.()
  }, [lifecycleSteps, state.currentStep, state.isComplete])

  const handleNext = () => {
    setNavigationDirection(1)
    goNext()
  }

  const handleBack = () => {
    setNavigationDirection(-1)
    goBack()
  }

  const handleRestart = () => {
    setNavigationDirection(1)
    setSubmitError(null)
    restartReview()
  }

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
    } catch {
      setSubmitError('Failed to save review snapshot to diary. Please try again.')
    } finally {
      setIsSubmittingDiary(false)
    }
  }

  return (
    <section className="review-shadcn-scope min-h-0 bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 sm:py-5 md:grid-cols-3 md:gap-6 md:px-6 md:py-8">
        <div className="md:col-span-2" aria-label="Review workflow">
          {submitError ? <p className="mb-3 text-sm text-destructive">{submitError}</p> : null}
          <ReviewDeck
            steps={steps}
            currentStep={state.currentStep}
            isComplete={state.isComplete}
            canProceed={canProceed && !isSubmittingDiary}
            navigationDirection={navigationDirection}
            onBack={handleBack}
            onNext={handleNext}
            onSubmit={handleSubmit}
            onRestart={handleRestart}
            isSubmittingDiary={isSubmittingDiary}
          />
        </div>

        <aside className="md:col-span-1 md:overflow-hidden" aria-label="Review history">
          <ReviewHistoryPanel className="h-full" maxHeightClassName="md:max-h-[calc(100vh-220px)]" />
        </aside>
      </div>
    </section>
  )
}

export default ReviewPage
