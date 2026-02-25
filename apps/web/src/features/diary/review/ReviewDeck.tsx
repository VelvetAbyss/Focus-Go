import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

export type ReviewStepDefinition = {
  id: string
  title: string
  description: string
  content: ReactNode
}

type ReviewDeckProps = {
  steps: ReviewStepDefinition[]
  currentStep: number
  isComplete: boolean
  canProceed: boolean
  isSubmittingDiary?: boolean
  navigationDirection: 1 | -1
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
  onRestart: () => void
}

const cardTransition = {
  duration: 0.3,
  ease: [0.23, 1, 0.32, 1] as const,
}

const ReviewDeck = ({
  steps,
  currentStep,
  isComplete,
  canProceed,
  isSubmittingDiary = false,
  navigationDirection,
  onBack,
  onNext,
  onSubmit,
  onRestart,
}: ReviewDeckProps) => {
  const safeStep = steps.length > 0 ? Math.min(Math.max(currentStep, 0), steps.length - 1) : 0
  const activeStep = steps[safeStep]
  const progressValue = steps.length === 0 ? 0 : isComplete ? 100 : Math.round(((safeStep + 1) / steps.length) * 100)
  const atFirstStep = safeStep === 0
  const atLastStep = safeStep === steps.length - 1

  return (
    <section className="min-h-0 bg-background text-foreground">
      <div className="flex w-full flex-col gap-4 px-3 py-4 sm:px-4 sm:py-5 md:gap-6 md:px-6 md:py-8">
        <header className="space-y-4">
          <Badge variant="secondary" className="w-fit">
            Daily Ritual
          </Badge>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Review</h1>
            <p className="text-sm text-muted-foreground">
              Capture, process, reflect, and close the day with one focused sequence.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isComplete ? 'Completed' : `Step ${safeStep + 1} of ${steps.length}`}</span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} aria-label="Review progress" />
          </div>
        </header>

        <Separator />

        <div className="min-h-[52vh] md:min-h-[420px]">
          <AnimatePresence mode="wait" initial={false}>
            {isComplete ? (
              <motion.div
                key="review-complete"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={cardTransition}
              >
                <Card>
                  <CardHeader className="space-y-3">
                    <Badge className="w-fit">System Shutdown</Badge>
                    <CardTitle className="text-2xl">Review complete</CardTitle>
                    <CardDescription>
                      Session closed for today. Start a new run whenever you want to reset.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Completion state is persisted for this date and can be restarted at any time.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={onRestart}>Start New Review</Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key={activeStep.id}
                initial={{ opacity: 0, x: navigationDirection > 0 ? 48 : -48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: navigationDirection > 0 ? -48 : 48 }}
                transition={cardTransition}
              >
                <Card>
                  <CardHeader className="space-y-3">
                    <Badge variant="outline" className="w-fit">
                      {activeStep.id}
                    </Badge>
                    <CardTitle className="text-2xl">{activeStep.title}</CardTitle>
                    <CardDescription>{activeStep.description}</CardDescription>
                  </CardHeader>
                  <CardContent>{activeStep.content}</CardContent>
                  <CardFooter className="justify-between gap-2">
                    <Button variant="outline" onClick={onBack} disabled={atFirstStep}>
                      Back
                    </Button>
                    {atLastStep ? (
                      <Button onClick={onSubmit} disabled={!canProceed || isSubmittingDiary}>
                        {isSubmittingDiary ? 'Saving...' : 'Submit Review'}
                      </Button>
                    ) : (
                      <Button onClick={onNext} disabled={!canProceed}>
                        Next
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

export default ReviewDeck
