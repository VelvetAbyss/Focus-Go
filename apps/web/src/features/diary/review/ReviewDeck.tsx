import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Feather } from 'lucide-react'

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
  'w-full rounded-xl border border-[#eee] bg-[#fafafa] px-5 py-3.5 text-[#3a3733] placeholder:text-[#ccc] transition-all duration-300 focus:border-[#ccc] focus:bg-white focus:outline-none focus:shadow-[0_0_0_3px_rgba(58, 55, 51, 0.03)] disabled:opacity-40'

const subtleInputClassName =
  'w-full rounded-lg border border-[#f0f0f0] bg-[#fafafa] px-4 py-2.5 text-[#333] placeholder:text-[#d0d0d0] transition-all duration-300 focus:border-[#ccc] focus:bg-white focus:outline-none'

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
  const [isOpen, setIsOpen] = useState(false)
  const currentHour = new Date().getHours()
  const greeting =
    currentHour >= 17 ? 'Good evening' : currentHour >= 12 ? 'Good afternoon' : 'Good morning'
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const disabled = isComplete || isSubmittingDiary

  return (
    <section className="review-deck min-h-0 rounded-[24px] border border-[#eee] bg-white p-6 text-[#3a3733] shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-8 lg:p-10">
      <div className="flex h-full flex-col">
        <div className="mb-8 lg:mb-10">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3a3733]">
              <Feather size={13} className="text-white" />
            </div>
            <span
              className="text-[#aaa]"
              style={{
                fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                fontSize: '0.75rem',
                fontWeight: 400,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Daily Review
            </span>
          </div>
          <h1
            className="mb-1 text-[#3a3733]"
            style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '1.6rem', fontWeight: 500 }}
          >
            {greeting}
          </h1>
          <p
            className="text-[#999]"
            style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.88rem', fontWeight: 300 }}
          >
            {today} - take a quiet moment to look back.
          </p>
        </div>

        <div className="flex-1">
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="review-summary" className="block pl-0.5 text-[#444]" style={fieldLabelStyle}>
                One-line summary of today
              </label>
              <input
                id="review-summary"
                type="text"
                value={summary}
                onChange={(event) => onSummaryChange(event.target.value)}
                placeholder="How would you describe today in a few words?"
                disabled={disabled}
                className={inputClassName}
                style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '1rem', fontWeight: 400 }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="review-tomorrow" className="block pl-0.5 text-[#444]" style={fieldLabelStyle}>
                Most important thing for tomorrow
              </label>
              <input
                id="review-tomorrow"
                type="text"
                value={tomorrow}
                onChange={(event) => onTomorrowChange(event.target.value)}
                placeholder="Just one thing - no pressure"
                disabled={disabled}
                className={inputClassName}
                style={{ fontFamily: "'Lora', 'Georgia', serif", fontSize: '1rem', fontWeight: 400 }}
              />
            </div>

            <p className="pt-1 text-center text-[#ccc]" style={{ ...helperTextStyle, fontStyle: 'italic' }}>
              Even writing one sentence is enough.
            </p>
          </div>

          {!isComplete ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="group mx-auto flex cursor-pointer items-center gap-2 rounded-full bg-[#f7f7f7] px-5 py-2.5 transition-all duration-300 hover:bg-[#f0f0f0]"
              >
                <span
                  className="text-[#999] transition-colors duration-300 group-hover:text-[#666]"
                  style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 400 }}
                >
                  {isOpen ? "That's enough for now" : 'Go a little deeper'}
                </span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <ChevronDown size={14} className="text-[#bbb]" />
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
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#e5e5e5] to-transparent" />
                        <span
                          className="shrink-0 text-[#bbb]"
                          style={{
                            fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                            fontSize: '0.7rem',
                            fontWeight: 400,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                          }}
                        >
                          optional reflections
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#e5e5e5] to-transparent" />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="review-inbox-snapshot"
                          className="block pl-1 text-[#999]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.8rem', fontWeight: 400 }}
                        >
                          Inbox snapshot
                        </label>
                        <input
                          id="review-inbox-snapshot"
                          type="text"
                          value={inboxSnapshot}
                          onChange={(event) => onInboxSnapshotChange(event.target.value)}
                          placeholder="e.g. 12 unread, mostly newsletters"
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
                          <div className="flex h-5 w-5 items-center justify-center rounded-md border border-[#ddd] bg-[#fafafa] transition-all duration-300 peer-checked:border-[#3a3733] peer-checked:bg-[#3a3733]">
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
                          className="text-[#999] transition-colors group-hover:text-[#666]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 400 }}
                        >
                          Inbox cleared today
                        </span>
                      </label>

                      <div className="space-y-2">
                        <label
                          className="block pl-1 text-[#999]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.8rem', fontWeight: 400 }}
                        >
                          How focused did you feel?
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
                                  ? 'bg-[#3a3733] text-white'
                                  : 'bg-[#f7f7f7] text-[#ccc] hover:bg-[#f0f0f0] hover:text-[#999]'
                              }`}
                              style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.75rem', fontWeight: 400 }}
                            >
                              <div>{score}</div>
                              {score === 1 || score === 3 || score === 5 ? (
                                <div className="mt-0.5 text-[0.6rem] opacity-70">
                                  {score === 1 ? 'Low' : score === 3 ? 'Okay' : 'Deep'}
                                </div>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          className="block pl-1 text-[#999]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.8rem', fontWeight: 400 }}
                        >
                          Must-do tomorrow
                          <span className="ml-1.5 text-[#ccc]" style={{ fontSize: '0.7rem' }}>
                            (up to 3)
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
                                className="w-4 shrink-0 text-center text-[#ddd]"
                                style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.75rem' }}
                              >
                                {item.num}
                              </span>
                              <input
                                type="text"
                                value={item.value}
                                onChange={(event) => item.onChange(event.target.value)}
                                placeholder={item.num === 1 ? 'The one thing that matters most' : ''}
                                disabled={disabled}
                                className="flex-1 rounded-lg border border-[#f0f0f0] bg-[#fafafa] px-3.5 py-2 text-[#333] placeholder:text-[#d0d0d0] transition-all duration-300 focus:border-[#ccc] focus:bg-white focus:outline-none"
                                style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 300 }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="review-longer-reflection"
                          className="block pl-1 text-[#999]"
                          style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.8rem', fontWeight: 400 }}
                        >
                          Anything else on your mind?
                        </label>
                        <textarea
                          id="review-longer-reflection"
                          value={longerReflection}
                          onChange={(event) => onLongerReflectionChange(event.target.value)}
                          placeholder="This is just for you. Write whatever feels right..."
                          rows={3}
                          disabled={disabled}
                          className="w-full resize-none rounded-lg border border-[#f0f0f0] bg-[#fafafa] px-4 py-3 text-[#333] placeholder:text-[#d0d0d0] transition-all duration-300 focus:border-[#ccc] focus:bg-white focus:outline-none"
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
                  <div className="flex items-center gap-2 rounded-full border border-[#eee] bg-[#f5f5f5] px-5 py-2.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3a3733]">
                      <Check size={10} className="text-white" />
                    </div>
                    <span
                      className="text-[#555]"
                      style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 400 }}
                    >
                      Saved for today
                    </span>
                  </div>
                  <p
                    className="text-[#bbb]"
                    style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.76rem', fontWeight: 300 }}
                  >
                    Rest well tonight.
                  </p>
                  <button
                    type="button"
                    onClick={onRestart}
                    className="text-[#999] underline-offset-4 transition-colors hover:text-[#555] hover:underline"
                    style={{ fontFamily: "'Inter', 'IBM Plex Sans', sans-serif", fontSize: '0.82rem', fontWeight: 400 }}
                  >
                    Start a new reflection
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
                  className="cursor-pointer rounded-xl bg-[#3a3733] px-8 py-3 text-white/90 transition-all duration-300 hover:bg-[#333] disabled:cursor-default disabled:opacity-60"
                  style={{
                    fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                    fontSize: '0.9rem',
                    fontWeight: 400,
                    letterSpacing: '0.02em',
                  }}
                >
                  {isSubmittingDiary ? "Saving today's review..." : "Save today's review"}
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
