import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Bell,
  BellOff,
  CheckCircle2,
  Timer,
  ChevronUp,
  ChevronDown,
  Zap,
  Brain,
  Rocket,
  Infinity as InfinityIcon,
  Target,
  Keyboard,
  X,
} from "lucide-react";
import { useI18n } from "../../../../shared/i18n/useI18n";
import { useSharedFocusTimer } from "../../useSharedFocusTimer";
import { useVisibleInterval } from "../../../../shared/hooks/usePageActivity";
import { useAuthGate } from "../../../auth/AuthGateContext";
import { usePreferences } from "../../../../shared/prefs/usePreferences";
import { setFocusTaskId, useFocusTask } from "../../focusTask";
import { DURATION, EASE } from '../../../../shared/motion/tokens'

type TimerStatus = "idle" | "running" | "paused" | "completed";

interface FocusMode {
  id: string;
  name: string;
  nameKey: import('../../../../shared/i18n/types').TranslationKey;
  description: string;
  descriptionKey: string;
  duration: number;
  icon: React.ReactNode;
}

const focusModes: FocusMode[] = [
  {
    id: "pomodoro",
    name: "Pomodoro",
    nameKey: "focus.pomodoro",
    duration: 25,
    icon: <Timer size={14} />,
    description: "Classic 25-minute sprint",
    descriptionKey: "focus.pomodoroDesc",
  },
  {
    id: "deep",
    name: "Deep Work",
    nameKey: "focus.deepWork",
    duration: 50,
    icon: <Brain size={14} />,
    description: "Extended deep focus",
    descriptionKey: "focus.deepWorkDesc",
  },
  {
    id: "sprint",
    name: "Sprint",
    nameKey: "focus.sprint",
    duration: 15,
    icon: <Rocket size={14} />,
    description: "Quick 15-minute burst",
    descriptionKey: "focus.sprintDesc",
  },
  {
    id: "flow",
    name: "Flow",
    nameKey: "focus.flow",
    duration: 90,
    icon: <InfinityIcon size={14} />,
    description: "Long flow state",
    descriptionKey: "focus.flowDesc",
  },
];

const quotes = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Where focus goes, energy flows.", author: "Tony Robbins" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
];

// Same count as `quotes` so the rotating index works for either language.
const quotesZh = [
  { text: "不积跬步，无以至千里。", author: "《荀子》" },
  { text: "锲而不舍，金石可镂。", author: "《荀子》" },
  { text: "业精于勤，荒于嬉。", author: "韩愈" },
  { text: "非宁静无以致远。", author: "诸葛亮" },
  { text: "博观而约取，厚积而薄发。", author: "苏轼" },
  { text: "知之者不如好之者，好之者不如乐之者。", author: "《论语》" },
];

function RollingDigit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  return (
    // Source Serif 4 tabular figures are 0.5em wide; the slot adds a hair of air.
    <div className="relative overflow-hidden" style={{ width: "0.54em", height: "1em" }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: digit > prevDigit ? "100%" : "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: digit > prevDigit ? "-100%" : "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontVariantNumeric: 'var(--num-features)' }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function TimerDisplay({ time }: { time: number }) {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const prevRef = useRef(timeStr);

  useEffect(() => {
    prevRef.current = timeStr;
  });

  const prev = prevRef.current;
  const chars = timeStr.split("");
  const prevChars = prev.split("");

  return (
    <div className="flex items-center justify-center select-none">
      <div
        className="focus-zip-timer__digits flex items-center tracking-[-0.01em]"
        style={{
          fontFamily: 'var(--font-numeral)',
          fontVariantNumeric: 'var(--num-features)',
          fontWeight: 300,
          fontSize: "clamp(3.8rem, 6.5vw, 6rem)",
          color: "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        {chars.map((char, i) =>
          char === ":" ? (
            <span key="colon" className="focus-zip-timer__colon mx-1">
              :
            </span>
          ) : (
            <RollingDigit key={`d${i}`} digit={char} prevDigit={prevChars[i] || char} />
          )
        )}
      </div>
    </div>
  );
}

function DurationPicker({
  value,
  onChange,
  onClose,
  customDurationLabel,
  minLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  onClose: () => void;
  customDurationLabel: string;
  minLabel: string;
}) {
  const presets = [15, 25, 30, 45, 60, 90];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: DURATION.base }}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50"
    >
      <div
        className="rounded-2xl p-5 min-w-[260px]"
        style={{
          background: "var(--paper-raised)",
          boxShadow: "0 8px 40px color-mix(in srgb, var(--text-primary) 6%, transparent), 0 1px 3px color-mix(in srgb, var(--text-primary) 4%, transparent)",
        }}
      >
        <p className="text-meta text-[var(--text-secondary)] uppercase tracking-[var(--tracking-caps)] mb-3">
          {customDurationLabel}
        </p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(Math.max(5, value - 5))}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "color-mix(in srgb, var(--text-primary) 4%, transparent)" }}
          >
            <ChevronDown size={15} className="text-[var(--text-secondary)]" />
          </motion.button>
          <span
            className="text-[1.8rem]"
            style={{ fontFamily: 'var(--font-numeral)', fontVariantNumeric: 'var(--num-features)', color: "var(--text-primary)" }}
          >
            {value}
          </span>
          <span className="text-label text-[var(--text-secondary)] -ml-1">{minLabel}</span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(Math.min(120, value + 5))}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "color-mix(in srgb, var(--text-primary) 4%, transparent)" }}
          >
            <ChevronUp size={15} className="text-[var(--text-secondary)]" />
          </motion.button>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {presets.map((p) => (
            <motion.button
              key={p}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onChange(p);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg text-label transition-colors cursor-pointer"
              style={{
                background: p === value ? "var(--accent-wash)" : "color-mix(in srgb, var(--text-primary) 3%, transparent)",
                color: p === value ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {p}{minLabel}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function BreathingGuide({ onComplete, phaseLabels }: { onComplete: () => void; phaseLabels: Record<string, string> }) {
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [count, setCount] = useState(0);
  const totalCycles = 3;

  useEffect(() => {
    const sequence = [
      { phase: "inhale" as const, duration: 4000 },
      { phase: "hold" as const, duration: 2000 },
      { phase: "exhale" as const, duration: 4000 },
    ];
    let cycleCount = 0;
    let stepIndex = 0;

    const runStep = () => {
      if (cycleCount >= totalCycles) {
        onComplete();
        return;
      }
      const step = sequence[stepIndex];
      setPhase(step.phase);

      setTimeout(() => {
        stepIndex++;
        if (stepIndex >= sequence.length) {
          stepIndex = 0;
          cycleCount++;
          setCount(cycleCount);
        }
        runStep();
      }, step.duration);
    };

    runStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center"
      style={{
        background: "color-mix(in srgb, var(--paper-sheet) 92%, transparent)",
        backdropFilter: "blur(16px)",
      }}
    >
      <motion.div
        className="rounded-full mb-8"
        style={{
          width: 120,
          height: 120,
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent) 0%, color-mix(in srgb, var(--accent) 3%, transparent) 70%)",
          border: "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
        }}
        animate={{
          scale: phase === "inhale" ? [1, 1.4] : phase === "hold" ? 1.4 : [1.4, 1],
        }}
        transition={{
          duration: phase === "hold" ? 0.3 : 4,
          ease: EASE.inOut,
        }}
      />
      <motion.p
        key={phase}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-body text-tone-done"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {phaseLabels[phase]}
      </motion.p>
      <p className="text-meta text-[var(--text-secondary)] mt-3">
        {count + 1} / {totalCycles}
      </p>
    </motion.div>
  );
}

function DailyGoalRing({
  completedMinutes,
  goalMinutes,
  minLabel,
}: {
  completedMinutes: number;
  goalMinutes: number;
  minLabel: string;
}) {
  const progress = Math.min(1, completedMinutes / goalMinutes);
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
      <svg width={68} height={68} className="absolute -rotate-90">
        {/* The goal is a dashed pencil track; today's minutes are the pen. */}
        <circle
          cx={34}
          cy={34}
          r={radius}
          fill="none"
          stroke="var(--pencil-line)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
        <motion.circle
          cx={34}
          cy={34}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: EASE.emphasized }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="text-ui text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-numeral)', fontVariantNumeric: 'var(--num-features)' }}>
          {completedMinutes}
        </span>
        <span className="text-meta text-[var(--text-secondary)] -mt-0.5">/ {goalMinutes}{minLabel}</span>
      </div>
    </div>
  );
}

export function FocusTimer({
  todayMinutes = 70,
  dailyGoal = 120,
  todaySessions = 2,
}: {
  todayMinutes?: number;
  dailyGoal?: number;
  todaySessions?: number;
}) {
  const { t, language } = useI18n()
  const { requireAuth } = useAuthGate()
  const { state: timerState, start, pause, resume, reset, setDuration } = useSharedFocusTimer({ defaultDurationMinutes: 25 })
  const [selectedMode, setSelectedMode] = useState<FocusMode>(focusModes[0]);
  // One setting with Settings › 体验 › 专注完成提示音.
  const { focusCompletionSoundEnabled: completionSound, setFocusCompletionSoundEnabled: setCompletionSound } = usePreferences();
  const focusTask = useFocusTask();
  const [showDuration, setShowDuration] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * quotes.length));
  const duration = timerState.durationMinutes;
  const timeLeft = timerState.remainingSeconds;
  const status = timerState.status;

  const totalTime = duration * 60;
  const progress = status === "idle" ? 0 : 1 - timeLeft / totalTime;

  useEffect(() => {
    setSelectedMode(focusModes.reduce((best, current) => {
      const currentDistance = Math.abs(current.duration - duration);
      const bestDistance = Math.abs(best.duration - duration);
      return currentDistance < bestDistance ? current : best;
    }, focusModes[0]));
  }, [duration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (status === "idle" || status === "completed") void handleStart();
        else if (status === "running") requireAuth(() => { void handlePause(); });
        else if (status === "paused") requireAuth(() => { void handleResume(); });
      }
      if (e.code === "KeyR" && (status === "running" || status === "paused")) {
        requireAuth(() => { void handleReset(); });
      }
      if (e.code === "KeyB" && status === "idle") {
        requireAuth(() => setShowBreathing(true));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, duration]);

  useVisibleInterval(() => {
    setQuoteIndex((prev) => (prev + 1) % quotes.length);
  }, 12000);

  const handleStart = async () => {
    if (status === "idle" || status === "completed") {
      requireAuth(() => { void start(duration) });
      return;
    }
    if (status === "running") {
      await pause();
      return;
    }
    await resume();
  };

  const handlePause = async () => pause();
  const handleResume = async () => resume();

  const handleReset = async () => {
    await reset();
  };

  const handleDurationChange = async (mins: number) => {
    await setDuration(mins);
  };

  const handleModeSelect = async (mode: FocusMode) => {
    setSelectedMode(mode);
    await setDuration(mode.duration);
  };

  const handleBreathingComplete = () => {
    setShowBreathing(false);
    handleStart();
  };

  const statusLabels: Record<TimerStatus, string> = {
    idle: t("focus.readyToFocus"),
    running: t("focus.focusing"),
    paused: t("focus.paused"),
    completed: t("focus.sessionComplete"),
  };

  const quote = (language === "zh" ? quotesZh : quotes)[quoteIndex];

  return (
    <div className="focus-zip-timer h-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Breathing guide overlay */}
      <AnimatePresence>
        {showBreathing && <BreathingGuide onComplete={handleBreathingComplete} phaseLabels={{ inhale: t("focus.breatheIn"), hold: t("focus.hold"), exhale: t("focus.breatheOut") }} />}
      </AnimatePresence>

      {/* Breathing ambient ring */}
      <div
        className={`focus-zip-timer__breathe-ring absolute rounded-full pointer-events-none${status === "running" ? " is-running" : ""}`}
        style={{
          width: 380,
          height: 380,
          background: "radial-gradient(circle, rgba(168,162,150,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Daily goal ring - top left */}
      <div className="absolute top-5 left-6 z-10">
        <div className="flex items-center gap-3">
          <DailyGoalRing completedMinutes={todayMinutes} goalMinutes={dailyGoal} minLabel={t("focus.minUnit")} />
          <div>
            <p className="text-meta text-[var(--text-secondary)] uppercase tracking-[var(--tracking-caps)]">
              {t("focus.dailyGoal")}
            </p>
            <p className="text-label text-[var(--text-secondary)] mt-0.5">
              {t("focus.sessionsToday", { count: todaySessions })}
            </p>
          </div>
        </div>
      </div>

      {/* Shortcut hint - top right */}
      <div className="absolute top-6 right-6 z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ background: "color-mix(in srgb, var(--text-primary) 2.5%, transparent)" }}
        >
          <Keyboard size={14} className="text-[var(--text-secondary)]" />
        </motion.button>
        <AnimatePresence>
          {showShortcuts && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowShortcuts(false)} />
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                className="absolute top-full right-0 mt-2 z-50 rounded-xl p-4 min-w-[180px]"
                style={{
                  background: "var(--paper-raised)",
                  boxShadow: "0 6px 24px color-mix(in srgb, var(--text-primary) 6%, transparent), 0 1px 3px color-mix(in srgb, var(--text-primary) 4%, transparent)",
                }}
              >
                <p className="text-meta text-[var(--text-secondary)] uppercase tracking-[var(--tracking-caps)] mb-2.5">
                  {t("focus.shortcuts")}
                </p>
                {[
                  { key: "Space", action: t("focus.shortcutStartPause") },
                  { key: "R", action: t("focus.shortcutReset") },
                  { key: "B", action: t("focus.shortcutBreathe") },
                ].map((s) => (
                  <div key={s.key} className="flex items-center justify-between py-1">
                    <span className="text-meta text-[var(--text-secondary)]">{s.action}</span>
                    <span
                      className="text-meta px-1.5 py-0.5 rounded"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {s.key}
                    </span>
                  </div>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Timer Area */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Focus Mode Selector */}
        <div className="flex items-center gap-1.5 mb-6">
          {focusModes.map((mode) => (
            <motion.button
              key={mode.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => void handleModeSelect(mode)}
              disabled={status === "running" || status === "paused"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
              style={{
                // One selection style app-wide (DESIGN.md › Selection): a raised thumb, ink label.
                background: selectedMode.id === mode.id ? "var(--segmented-thumb)" : "transparent",
                boxShadow: selectedMode.id === mode.id ? "var(--segmented-thumb-shadow)" : "none",
                border: "1px solid transparent",
                color: selectedMode.id === mode.id ? "var(--segmented-fg-active)" : "var(--segmented-fg)",
                opacity: status === "running" || status === "paused" ? 0.5 : 1,
              }}
            >
              {mode.icon}
              <span className="text-meta">{t(mode.nameKey)}</span>
            </motion.button>
          ))}
        </div>

        {/* Status label */}
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mb-6"
        >
          {status === "completed" ? (
            <CheckCircle2 size={13} className="text-tone-done" />
          ) : status === "running" ? (
            <Zap size={13} className="text-[color:var(--accent)]" />
          ) : (
            <Target size={13} className="text-[var(--text-secondary)]" />
          )}
          <span
            className="text-label tracking-[var(--tracking-caps)] uppercase"
            style={{
              color:
                status === "completed"
                  ? "var(--tone-done)"
                  : status === "running"
                  ? "var(--accent)"
                  : "var(--text-secondary)",
            }}
          >
            {statusLabels[status]}
          </span>
        </motion.div>

        {focusTask ? (
          <div className="mb-1 mt-2 flex max-w-[360px] items-center gap-1.5 rounded-full bg-[var(--paper-sunken)] py-1 pl-3 pr-1 text-label text-ink-2">
            <span className="shrink-0 text-ink-3">{t("focus.task.label")}</span>
            <span className="truncate font-medium text-ink-1">{focusTask.title}</span>
            <button
              type="button"
              className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-[var(--surface-hover)] hover:text-ink-1"
              aria-label={t("focus.task.clear")}
              title={t("focus.task.clear")}
              onClick={() => setFocusTaskId(null)}
            >
              <X size={12} />
            </button>
          </div>
        ) : null}

        {/* Timer digits */}
        <TimerDisplay time={timeLeft} />

        {/* Progress line */}
        <div
          className="w-56 h-[2px] mt-7 mb-8 rounded-full overflow-hidden"
          style={{ background: "color-mix(in srgb, var(--text-primary) 4%, transparent)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background:
                status === "completed" ? "var(--tone-done)" : "var(--accent)",
            }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: EASE.emphasized }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {status === "idle" || status === "completed" ? (
            <>
              {/* Breathe first button */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowBreathing(true)}
                className="px-5 py-2.5 rounded-full flex items-center gap-2 cursor-pointer"
                style={{
                  background: "var(--cta2-bg)",
                  border: "1px solid var(--cta2-border)",
                  color: "var(--cta2-fg)",
                }}
              >
                <span className="focus-zip-timer__breathe-icon">
                  <span className="text-ui">○</span>
                </span>
                <span className="text-label">{t("focus.breathe")}</span>
              </motion.button>

              {/* Start button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => void handleStart()}
                className="px-7 py-2.5 rounded-full flex items-center gap-2.5 cursor-pointer"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                <Play size={15} />
                <span className="text-ui tracking-[0.02em]">{t("focus.startFocus")}</span>
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => void (status === "running" ? handlePause() : handleResume())}
                className="px-6 py-2.5 rounded-full flex items-center gap-2 cursor-pointer"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {status === "running" ? (
                  <>
                    <Pause size={15} />
                    <span className="text-ui">{t("focus.pause")}</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span className="text-ui">{t("focus.resume")}</span>
                  </>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => void handleReset()}
                className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
                style={{ background: "color-mix(in srgb, var(--text-primary) 4%, transparent)" }}
              >
                <RotateCcw size={15} className="text-[var(--text-secondary)]" />
              </motion.button>
            </>
          )}

          {/* Duration picker */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDuration(!showDuration)}
              disabled={status === "running" || status === "paused"}
              className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
              style={{
                background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                opacity: status === "running" || status === "paused" ? 0.4 : 1,
              }}
            >
              <Clock size={15} className="text-[var(--text-secondary)]" />
            </motion.button>
            <AnimatePresence>
              {showDuration && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDuration(false)} />
                  <DurationPicker
                    value={duration}
                    onChange={(value) => void handleDurationChange(value)}
                    onClose={() => setShowDuration(false)}
                    customDurationLabel={t("focus.customDuration")}
                    minLabel={t("focus.minUnit")}
                  />
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Sound toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCompletionSound(!completionSound)}
            aria-label={completionSound ? t("focus.soundOn") : t("focus.soundOff")}
            aria-pressed={completionSound}
            className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
            style={{ background: "color-mix(in srgb, var(--text-primary) 4%, transparent)" }}
          >
            {completionSound ? (
              <Bell size={15} className="text-[var(--text-secondary)]" />
            ) : (
              <BellOff size={15} className="text-[var(--text-secondary)]" />
            )}
          </motion.button>
        </div>

        {/* Session meta */}
        <div className="flex items-center gap-5 mt-6">
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  status === "running"
                    ? "var(--accent)"
                    : status === "paused"
                    ? "var(--tone-warn)"
                    : "color-mix(in srgb, var(--text-primary) 8%, transparent)",
              }}
            />
            <span className="text-meta text-[var(--text-secondary)]">
              {t(selectedMode.nameKey)} · {duration}{t("focus.minUnit")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {completionSound ? (
              <Bell size={10} className="text-[var(--text-secondary)]" />
            ) : (
              <BellOff size={10} className="text-[var(--text-secondary)]" />
            )}
            <span className="text-meta text-[var(--text-secondary)]">
              {completionSound ? t("focus.soundOn") : t("focus.soundOff")}
            </span>
          </div>
        </div>

        {/* Motivational quote */}
        <div className="mt-8 max-w-[340px] text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={quoteIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5 }}
            >
              <p
                className="text-label text-[var(--text-secondary)]"
                style={{ fontFamily: 'var(--font-reading)' }}
              >
                {language === "zh" ? `“${quote.text}”` : `"${quote.text}"`}
              </p>
              <p className="text-meta text-[var(--text-secondary)] mt-1.5">— {quote.author}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
