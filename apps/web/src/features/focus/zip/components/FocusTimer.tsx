import { useState, useEffect, useRef, useCallback } from "react";
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
  Infinity,
  Target,
  Keyboard,
} from "lucide-react";

type TimerStatus = "idle" | "running" | "paused" | "completed";

interface FocusMode {
  id: string;
  name: string;
  duration: number;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const focusModes: FocusMode[] = [
  {
    id: "pomodoro",
    name: "Pomodoro",
    duration: 25,
    icon: <Timer size={14} />,
    description: "Classic 25-minute sprint",
    color: "#C4A882",
  },
  {
    id: "deep",
    name: "Deep Work",
    duration: 50,
    icon: <Brain size={14} />,
    description: "Extended deep focus",
    color: "#8BA4B8",
  },
  {
    id: "sprint",
    name: "Sprint",
    duration: 15,
    icon: <Rocket size={14} />,
    description: "Quick 15-minute burst",
    color: "#D4956A",
  },
  {
    id: "flow",
    name: "Flow",
    duration: 90,
    icon: <Infinity size={14} />,
    description: "Long flow state",
    color: "#8BA88A",
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

function RollingDigit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  return (
    <div className="relative overflow-hidden" style={{ width: "0.62em", height: "1em" }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: digit > prevDigit ? "100%" : "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: digit > prevDigit ? "-100%" : "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontVariantNumeric: "tabular-nums" }}
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
        className="focus-zip-timer__digits flex items-center tracking-[-0.04em]"
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: "clamp(3.8rem, 6.5vw, 6rem)",
          color: "#3a3733",
          lineHeight: 1,
        }}
      >
        {chars.map((char, i) =>
          char === ":" ? (
            <motion.span
              key="colon"
              className="mx-1 opacity-40"
              animate={{ opacity: [0.2, 0.45, 0.2] }}
              transition={{ repeat: 9999, duration: 2, ease: "easeInOut" }}
            >
              :
            </motion.span>
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
}: {
  value: number;
  onChange: (v: number) => void;
  onClose: () => void;
}) {
  const presets = [15, 25, 30, 45, 60, 90];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50"
    >
      <div
        className="rounded-2xl p-5 min-w-[260px]"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 8px 40px rgba(58, 55, 51, 0.06), 0 1px 3px rgba(58, 55, 51, 0.04)",
        }}
      >
        <p className="text-[0.68rem] text-[#918b80] uppercase tracking-[0.08em] mb-3">
          Custom Duration
        </p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(Math.max(5, value - 5))}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(58, 55, 51, 0.04)" }}
          >
            <ChevronDown size={15} className="text-[#7a7568]" />
          </motion.button>
          <span
            className="text-[1.8rem] tabular-nums"
            style={{ fontFamily: "'DM Serif Display', serif", color: "#3a3733" }}
          >
            {value}
          </span>
          <span className="text-[0.75rem] text-[#a09a90] -ml-1">min</span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(Math.min(120, value + 5))}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(58, 55, 51, 0.04)" }}
          >
            <ChevronUp size={15} className="text-[#7a7568]" />
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
              className="px-3 py-1.5 rounded-lg text-[0.72rem] transition-colors cursor-pointer"
              style={{
                background: p === value ? "rgba(138,132,120,0.12)" : "rgba(58, 55, 51, 0.03)",
                color: p === value ? "#4a4640" : "#918b80",
              }}
            >
              {p}m
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function BreathingGuide({ onComplete }: { onComplete: () => void }) {
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

  const phaseLabels = { inhale: "Breathe in...", hold: "Hold...", exhale: "Breathe out..." };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center"
      style={{
        background: "rgba(247,246,243,0.92)",
        backdropFilter: "blur(16px)",
      }}
    >
      <motion.div
        className="rounded-full mb-8"
        style={{
          width: 120,
          height: 120,
          background: "radial-gradient(circle, rgba(139,168,138,0.15) 0%, rgba(139,168,138,0.03) 70%)",
          border: "1px solid rgba(139,168,138,0.12)",
        }}
        animate={{
          scale: phase === "inhale" ? [1, 1.4] : phase === "hold" ? 1.4 : [1.4, 1],
        }}
        transition={{
          duration: phase === "hold" ? 0.3 : 4,
          ease: "easeInOut",
        }}
      />
      <motion.p
        key={phase}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[0.9rem] text-[#7A9A78] tracking-wide"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        {phaseLabels[phase]}
      </motion.p>
      <p className="text-[0.66rem] text-[#b0aa9e] mt-3">
        {count + 1} / {totalCycles}
      </p>
    </motion.div>
  );
}

function DailyGoalRing({
  completedMinutes,
  goalMinutes,
}: {
  completedMinutes: number;
  goalMinutes: number;
}) {
  const progress = Math.min(1, completedMinutes / goalMinutes);
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
      <svg width={68} height={68} className="absolute -rotate-90">
        <circle
          cx={34}
          cy={34}
          r={radius}
          fill="none"
          stroke="rgba(58, 55, 51, 0.04)"
          strokeWidth={3}
        />
        <motion.circle
          cx={34}
          cy={34}
          r={radius}
          fill="none"
          stroke="rgba(139,168,138,0.5)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="text-[0.85rem] text-[#3a3733] tabular-nums" style={{ fontFamily: "'DM Serif Display', serif" }}>
          {completedMinutes}
        </span>
        <span className="text-[0.5rem] text-[#b0aa9e] -mt-0.5">/ {goalMinutes}min</span>
      </div>
    </div>
  );
}

export function FocusTimer({
  onSessionComplete,
  todayMinutes = 70,
  dailyGoal = 120,
  todaySessions = 2,
}: {
  onSessionComplete?: (session: {
    startTime: Date;
    endTime: Date;
    status: "completed" | "abandoned";
    durationMinutes: number;
    mode: string;
  }) => void;
  todayMinutes?: number;
  dailyGoal?: number;
  todaySessions?: number;
}) {
  const [selectedMode, setSelectedMode] = useState<FocusMode>(focusModes[0]);
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [completionSound, setCompletionSound] = useState(true);
  const [showDuration, setShowDuration] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * quotes.length));
  const sessionStartRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalTime = duration * 60;
  const progress = status === "idle" ? 0 : 1 - timeLeft / totalTime;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (status === "running") {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearTimer();
            setStatus("completed");
            const endTime = new Date();
            if (sessionStartRef.current && onSessionComplete) {
              onSessionComplete({
                startTime: sessionStartRef.current,
                endTime,
                status: "completed",
                durationMinutes: duration,
                mode: selectedMode.id,
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [status, clearTimer, duration, onSessionComplete, selectedMode.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (status === "idle" || status === "completed") handleStart();
        else if (status === "running") handlePause();
        else if (status === "paused") handleResume();
      }
      if (e.code === "KeyR" && (status === "running" || status === "paused")) {
        handleReset();
      }
      if (e.code === "KeyB" && status === "idle") {
        setShowBreathing(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, duration]);

  // Rotate quotes
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 12000);
    return () => clearInterval(id);
  }, []);

  const handleStart = () => {
    if (status === "idle" || status === "completed") {
      setTimeLeft(duration * 60);
      sessionStartRef.current = new Date();
    }
    setStatus("running");
  };

  const handlePause = () => setStatus("paused");
  const handleResume = () => setStatus("running");

  const handleReset = () => {
    clearTimer();
    if (status === "running" || status === "paused") {
      if (sessionStartRef.current && onSessionComplete) {
        onSessionComplete({
          startTime: sessionStartRef.current,
          endTime: new Date(),
          status: "abandoned",
          durationMinutes: duration,
          mode: selectedMode.id,
        });
      }
    }
    setStatus("idle");
    setTimeLeft(duration * 60);
    sessionStartRef.current = null;
  };

  const handleDurationChange = (mins: number) => {
    setDuration(mins);
    if (status === "idle") setTimeLeft(mins * 60);
  };

  const handleModeSelect = (mode: FocusMode) => {
    setSelectedMode(mode);
    setDuration(mode.duration);
    if (status === "idle") setTimeLeft(mode.duration * 60);
  };

  const handleBreathingComplete = () => {
    setShowBreathing(false);
    handleStart();
  };

  const statusLabels: Record<TimerStatus, string> = {
    idle: "Ready to focus",
    running: "Focusing...",
    paused: "Paused",
    completed: "Session complete",
  };

  const quote = quotes[quoteIndex];

  return (
    <div className="focus-zip-timer h-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Breathing guide overlay */}
      <AnimatePresence>
        {showBreathing && <BreathingGuide onComplete={handleBreathingComplete} />}
      </AnimatePresence>

      {/* Breathing ambient ring */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 380,
          height: 380,
          background: "radial-gradient(circle, rgba(168,162,150,0.04) 0%, transparent 70%)",
        }}
        animate={{
          scale: status === "running" ? [1, 1.08, 1] : [1, 1.03, 1],
          opacity: status === "running" ? [0.5, 1, 0.5] : [0.2, 0.4, 0.2],
        }}
        transition={{
          repeat: 9999,
          duration: status === "running" ? 4 : 6,
          ease: "easeInOut",
        }}
      />

      {/* Daily goal ring - top left */}
      <div className="absolute top-5 left-6 z-10">
        <div className="flex items-center gap-3">
          <DailyGoalRing completedMinutes={todayMinutes} goalMinutes={dailyGoal} />
          <div>
            <p className="text-[0.66rem] text-[#918b80] uppercase tracking-[0.06em]">
              Daily Goal
            </p>
            <p className="text-[0.72rem] text-[#5a5650] mt-0.5">
              {todaySessions} sessions today
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
          style={{ background: "rgba(58, 55, 51, 0.025)" }}
        >
          <Keyboard size={14} className="text-[#b0aa9e]" />
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
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 6px 24px rgba(58, 55, 51, 0.06), 0 1px 3px rgba(58, 55, 51, 0.04)",
                }}
              >
                <p className="text-[0.62rem] text-[#918b80] uppercase tracking-[0.08em] mb-2.5">
                  Shortcuts
                </p>
                {[
                  { key: "Space", action: "Start / Pause" },
                  { key: "R", action: "Reset" },
                  { key: "B", action: "Breathe first" },
                ].map((s) => (
                  <div key={s.key} className="flex items-center justify-between py-1">
                    <span className="text-[0.68rem] text-[#5a5650]">{s.action}</span>
                    <span
                      className="text-[0.6rem] px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(58, 55, 51, 0.04)",
                        color: "#918b80",
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
              onClick={() => handleModeSelect(mode)}
              disabled={status === "running" || status === "paused"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
              style={{
                background:
                  selectedMode.id === mode.id
                    ? `${mode.color}14`
                    : "rgba(58, 55, 51, 0.02)",
                border:
                  selectedMode.id === mode.id
                    ? `1px solid ${mode.color}25`
                    : "1px solid transparent",
                color: selectedMode.id === mode.id ? mode.color : "#b0aa9e",
                opacity: status === "running" || status === "paused" ? 0.5 : 1,
              }}
            >
              {mode.icon}
              <span className="text-[0.68rem]">{mode.name}</span>
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
            <CheckCircle2 size={13} className="text-[#8BA88A]" />
          ) : status === "running" ? (
            <Zap size={13} className="text-[#C4A882]" />
          ) : (
            <Target size={13} className="text-[#a09a90]" />
          )}
          <span
            className="text-[0.74rem] tracking-[0.04em] uppercase"
            style={{
              color:
                status === "completed"
                  ? "#8BA88A"
                  : status === "running"
                  ? "#C4A882"
                  : "#a09a90",
            }}
          >
            {statusLabels[status]}
          </span>
        </motion.div>

        {/* Timer digits */}
        <TimerDisplay time={timeLeft} />

        {/* Progress line */}
        <div
          className="w-56 h-[2px] mt-7 mb-8 rounded-full overflow-hidden"
          style={{ background: "rgba(58, 55, 51, 0.04)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background:
                status === "completed"
                  ? "rgba(139,168,138,0.6)"
                  : `${selectedMode.color}60`,
            }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
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
                className="px-5 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer"
                style={{
                  background: "rgba(139,168,138,0.08)",
                  border: "1px solid rgba(139,168,138,0.12)",
                  color: "#7A9A78",
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: 9999, duration: 3, ease: "easeInOut" }}
                >
                  <span className="text-[0.82rem]">○</span>
                </motion.div>
                <span className="text-[0.78rem]">Breathe</span>
              </motion.button>

              {/* Start button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                className="px-7 py-2.5 rounded-2xl flex items-center gap-2.5 cursor-pointer"
                style={{ background: "#3a3733", color: "#f5f3ef" }}
              >
                <Play size={15} />
                <span className="text-[0.82rem] tracking-[0.02em]">Start Focus</span>
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={status === "running" ? handlePause : handleResume}
                className="px-6 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer"
                style={{ background: "#3a3733", color: "#f5f3ef" }}
              >
                {status === "running" ? (
                  <>
                    <Pause size={15} />
                    <span className="text-[0.82rem]">Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span className="text-[0.82rem]">Resume</span>
                  </>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
                style={{ background: "rgba(58, 55, 51, 0.04)" }}
              >
                <RotateCcw size={15} className="text-[#918b80]" />
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
                background: "rgba(58, 55, 51, 0.04)",
                opacity: status === "running" || status === "paused" ? 0.4 : 1,
              }}
            >
              <Clock size={15} className="text-[#918b80]" />
            </motion.button>
            <AnimatePresence>
              {showDuration && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDuration(false)} />
                  <DurationPicker
                    value={duration}
                    onChange={handleDurationChange}
                    onClose={() => setShowDuration(false)}
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
            className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(58, 55, 51, 0.04)" }}
          >
            {completionSound ? (
              <Bell size={15} className="text-[#918b80]" />
            ) : (
              <BellOff size={15} className="text-[#b0aa9e]" />
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
                    ? selectedMode.color
                    : status === "paused"
                    ? "#D4956A"
                    : "rgba(58, 55, 51, 0.08)",
              }}
            />
            <span className="text-[0.66rem] text-[#b0aa9e]">
              {selectedMode.name} · {duration}min
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {completionSound ? (
              <Bell size={10} className="text-[#b0aa9e]" />
            ) : (
              <BellOff size={10} className="text-[#c8c2b8]" />
            )}
            <span className="text-[0.66rem] text-[#b0aa9e]">
              {completionSound ? "Sound on" : "Sound off"}
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
                className="text-[0.76rem] text-[#b0aa9e] italic"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                "{quote.text}"
              </p>
              <p className="text-[0.62rem] text-[#c8c2b8] mt-1.5">— {quote.author}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
