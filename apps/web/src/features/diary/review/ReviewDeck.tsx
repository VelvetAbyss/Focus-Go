import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Feather } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'

type ReviewDeckProps = {
  summary: string
  tomorrow: string
  inboxSnapshot: string
  inboxCleared: boolean
  focusScore: number | null
  longerReflection: string
  mustDo1: string
  mustDo2: string
  mustDo3: string
  isComplete: boolean
  isSubmittingDiary?: boolean
  onSummaryChange: (value: string) => void
  onTomorrowChange: (value: string) => void
  onInboxSnapshotChange: (value: string) => void
  onInboxClearedChange: (value: boolean) => void
  onFocusScoreChange: (value: number | null) => void
  onLongerReflectionChange: (value: string) => void
  onMustDo1Change: (value: string) => void
  onMustDo2Change: (value: string) => void
  onMustDo3Change: (value: string) => void
  onSubmit: () => void
  onRestart: () => void
}

const fieldLabelStyle = {
  fontFamily: "'Lora', 'Georgia', serif",
  fontSize: '0.95rem',
  fontWeight: 400,
}

const helperTextStyle = {
  fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
  fontSize: '0.76rem',
  fontWeight: 300,
}

const inputClassName =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-5 py-3.5 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-all duration-300 focus:border-[var(--border)] focus:bg-[var(--bg-elevated)] focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in srgb, var(--text-primary) 3%, transparent)] disabled:opacity-40'

const subtleInputClassName =
  'w-full rounded-lg border border-[var(--bg-muted)] bg-[var(--bg-muted)] px-4 py-2.5 text-[var(--text-secondary)] placeholder:text-[var(--text-secondary)] transition-all duration-300 focus:border-[var(--border)] focus:bg-[var(--bg-elevated)] focus:outline-none'

const ReviewDeck = ({
  summary,
  tomorrow,
  inboxSnapshot,
  inboxCleared,
  focusScore,
  longerReflection,
  mustDo1,
  mustDo2,
  mustDo3,
  isComplete,
  isSubmittingDiary = false,
  onSummaryChange,
  onTomorrowChange,
  onInboxSnapshotChange,
  onInboxClearedChange,
  onFocusScoreChange,
  onLongerReflectionChange,
  onMustDo1Change,
  onMustDo2Change,
  onMustDo3Change,
  onSubmit,
  onRestart,
}: ReviewDeckProps) => {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const currentHour = new Date().getHours()
  const greeting =
    currentHour >= 17 ? t('review.goodEvening') : currentHour >= 12 ? t('review.goodAfternoon') : t('review.goodMorning')
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const disabled = isComplete || isSubmittingDiary

  return (
    <section className="review-deck min-h-0 rounded-[24px] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-[var(--text-primary)] shadow-[var(--shadow-card)] sm:p-8 lg:p-10">
      <div className="flex h-full flex-col">
        <div className="mb-8 lg:mb-10">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--text-primary)]">
              <Feather size={13} className="text-white" />
            </div>
            <span
              className="text-[var(--text-secondary)]"
              style={{
                fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                fontSize: '0.75rem',
                fontWeight: 400,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {t('review.dailyReview')}
            </span>
          </div>
          <h1
            className="mb-1 text-[var(--text-primary)]"
            style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '1.6rem', fontWeight: 500 }}
          >
            {greeting}
          </h1>
          <p
            className="text-[var(--text-secondary)]"
            style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.88rem', fontWeight: 300 }}
          >
            {today} {t('review.subtitle')}
          </p>
        </div>

        <div className="flex-1">
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="review-summary" className="block pl-0.5 text-[var(--text-secondary)]" style={fieldLabelStyle}>
                {t('review.oneLineSummary')}
              </label>
              <input
                id="review-summary"
                type="text"
                value={summary}
                onChange={(event) => onSummaryChange(event.target.value)}
                placeholder={t('review.summaryPlaceholder')}
                disabled={disabled}
                className={inputClassName}
                style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '1rem', fontWeight: 400 }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="review-tomorrow" className="block pl-0.5 text-[var(--text-secondary)]" style={fieldLabelStyle}>
                {t('review.tomorrowImportant')}
              </label>
              <input
                id="review-tomorrow"
                type="text"
                value={tomorrow}
                onChange={(event) => onTomorrowChange(event.target.value)}
                placeholder={t('review.tomorrowPlaceholder')}
                disabled={disabled}
                className={inputClassName}
                style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '1rem', fontWeight: 400 }}
              />
            </div>

            <p className="pt-1 text-center text-[var(--text-secondary)]" style={{ ...helperTextStyle, fontStyle: 'italic' }}>
              {t('review.helperText')}
            </p>
          </div>

          {!isComplete ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="group mx-auto flex cursor-pointer items-center gap-2 rounded-full bg-[#f7f7f7] px-5 py-2.5 transition-all duration-300 hover:bg-[var(--bg-muted)]"
              >
                <span
                  className="text-[var(--text-secondary)] transition-colors duration-300 group-hover:text-[var(--text-secondary)]"
                  style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 400 }}
                >
                  {isOpen ? t('review.enough') : t('review.deeper')}
                </span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <ChevronDown size={14} className="text-[var(--text-secondary)]" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    key="deeper-reflection"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-5 pt-6">
                      <div className="flex items-center gap-4 px-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--bg-muted)] to-transparent" />
                        <span
                          className="shrink-0 text-[var(--text-secondary)]"
                          style={{
                            fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                            fontSize: '0.7rem',
                            fontWeight: 400,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {t('review.optionalReflections')}
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--bg-muted)] to-transparent" />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="review-inbox-snapshot"
                          className="block pl-1 text-[var(--text-secondary)]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.8rem', fontWeight: 400 }}
                        >
                          {t('review.inboxSnapshot')}
                        </label>
                        <input
                          id="review-inbox-snapshot"
                          type="text"
                          value={inboxSnapshot}
                          onChange={(event) => onInboxSnapshotChange(event.target.value)}
                          placeholder={t('review.inboxPlaceholder')}
                          disabled={disabled}
                          className={subtleInputClassName}
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.9rem', fontWeight: 300 }}
                        />
                      </div>

                      <label className="group flex cursor-pointer items-center gap-3 pl-1">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={inboxCleared}
                            onChange={(event) => onInboxClearedChange(event.target.checked)}
                            disabled={disabled}
                            className="peer sr-only"
                          />
                          <div className="flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-muted)] transition-all duration-300 peer-checked:border-[var(--text-primary)] peer-checked:bg-[var(--text-primary)]">
                            {inboxCleared ? (
                              <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="12" height="12" viewBox="0 0 12 12">
                                <path
                                  d="M2.5 6L5 8.5L9.5 3.5"
                                  stroke="white"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="none"
                                />
                              </motion.svg>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className="text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-secondary)]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 400 }}
                        >
                          {t('review.inboxCleared')}
                        </span>
                      </label>

                      <div className="space-y-2">
                        <label
                          className="block pl-1 text-[var(--text-secondary)]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.8rem', fontWeight: 400 }}
                        >
                          {t('review.focusedLabel')}
                        </label>
                        <div className="flex items-center gap-2 px-1">
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => onFocusScoreChange(focusScore === score ? null : score)}
                              disabled={disabled}
                              className={`flex-1 cursor-pointer rounded-lg py-2 transition-all duration-300 ${
                                focusScore === score
                                  ? 'bg-[var(--text-primary)] text-white'
                                  : 'bg-[#f7f7f7] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]'
                              }`}
                              style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.75rem', fontWeight: 400 }}
                            >
                              <div>{score}</div>
                              {score === 1 || score === 3 || score === 5 ? (
                                <div className="mt-0.5 text-[0.6rem] opacity-70">
                                  {score === 1 ? t('review.low') : score === 3 ? t('review.okay') : t('review.deep')}
                                </div>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          className="block pl-1 text-[var(--text-secondary)]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.8rem', fontWeight: 400 }}
                        >
                          {t('review.mustDoTomorrow')}
                          <span className="ml-1.5 text-[var(--text-secondary)]" style={{ fontSize: '0.7rem' }}>
                            {t('review.upTo3')}
                          </span>
                        </label>
                        <div className="space-y-2">
                          {[
                            { value: mustDo1, onChange: onMustDo1Change, num: 1 },
                            { value: mustDo2, onChange: onMustDo2Change, num: 2 },
                            { value: mustDo3, onChange: onMustDo3Change, num: 3 },
                          ].map((item) => (
                            <div key={item.num} className="flex items-center gap-2">
                              <span
                                className="w-4 shrink-0 text-center text-[var(--text-secondary)]"
                                style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.75rem' }}
                              >
                                {item.num}
                              </span>
                              <input
                                type="text"
                                value={item.value}
                                onChange={(event) => item.onChange(event.target.value)}
                                 placeholder={item.num === 1 ? t('review.mostImportant') : ''}
                                disabled={disabled}
                                className="flex-1 rounded-lg border border-[var(--bg-muted)] bg-[var(--bg-muted)] px-3.5 py-2 text-[var(--text-secondary)] placeholder:text-[var(--text-secondary)] transition-all duration-300 focus:border-[var(--border)] focus:bg-[var(--bg-elevated)] focus:outline-none"
                                style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 300 }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="review-longer-reflection"
                          className="block pl-1 text-[var(--text-secondary)]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.8rem', fontWeight: 400 }}
                        >
                          {t('review.anythingElse')}
                        </label>
                        <textarea
                          id="review-longer-reflection"
                          value={longerReflection}
                          onChange={(event) => onLongerReflectionChange(event.target.value)}
                          placeholder={t('review.justForYou')}
                          rows={3}
                          disabled={disabled}
                          className="w-full resize-none rounded-lg border border-[var(--bg-muted)] bg-[var(--bg-muted)] px-4 py-3 text-[var(--text-secondary)] placeholder:text-[var(--text-secondary)] transition-all duration-300 focus:border-[var(--border)] focus:bg-[var(--bg-elevated)] focus:outline-none"
                          style={{
                            fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                            fontSize: '0.9rem',
                            fontWeight: 300,
                            lineHeight: '1.7',
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col items-center">
            <AnimatePresence mode="wait" initial={false}>
              {isComplete ? (
                <motion.div
                  key="saved"
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-5 py-2.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--text-primary)]">
                      <Check size={10} className="text-white" />
                    </div>
                    <span
                      className="text-[var(--text-secondary)]"
                      style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 400 }}
                    >
                      {t('review.savedToday')}
                    </span>
                  </div>
                  <p
                    className="text-[var(--text-secondary)]"
                    style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.76rem', fontWeight: 300 }}
                  >
                    {t('review.restWell')}
                  </p>
                  <button
                    type="button"
                    onClick={onRestart}
                    className="text-[var(--text-secondary)] underline-offset-4 transition-colors hover:text-[var(--text-secondary)] hover:underline"
                    style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.82rem', fontWeight: 400 }}
                  >
                    {t('review.newReflection')}
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="submit"
                  type="button"
                  onClick={onSubmit}
                  whileHover={{ scale: isSubmittingDiary ? 1 : 1.02 }}
                  whileTap={{ scale: isSubmittingDiary ? 1 : 0.98 }}
                  disabled={isSubmittingDiary}
                  className="cursor-pointer rounded-xl bg-[var(--text-primary)] px-8 py-3 text-white/90 transition-all duration-300 hover:bg-[var(--bg-muted)] disabled:cursor-default disabled:opacity-60"
                  style={{
                    fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                    fontSize: '0.9rem',
                    fontWeight: 400,
                    letterSpacing: '0.02em',
                  }}
                >
                  {isSubmittingDiary ? t('review.saving') : t('review.saveToday')}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ReviewDeck
