import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ChevronDown,
  Flame,
  TrendingUp,
  Award,
} from "lucide-react";

export interface FocusSession {
  id: string;
  startTime: Date;
  endTime: Date;
  status: "completed" | "abandoned";
  durationMinutes: number;
  tag?: string;
  mode?: string;
}

const sessionTags = [
  { id: "work", label: "工作", color: "#8BA4B8" },
  { id: "study", label: "学习", color: "#C4A882" },
  { id: "reading", label: "阅读", color: "#A3B8A0" },
  { id: "creative", label: "创作", color: "#9A8EAF" },
  { id: "other", label: "其他", color: "#b0aa9e" },
];

const mockSessions: FocusSession[] = [];

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "今天";
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function FilterChip({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.68rem] cursor-pointer transition-colors"
        style={{
          background: value !== "all" ? "rgba(138,132,120,0.1)" : "rgba(58, 55, 51, 0.025)",
          color: value !== "all" ? "#5a5650" : "#918b80",
        }}
      >
        <Filter size={10} />
        <span>{selected?.label || label}</span>
        <ChevronDown size={10} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-1.5 z-50 rounded-xl overflow-hidden min-w-[120px]"
              style={{
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 6px 24px rgba(58, 55, 51, 0.06), 0 1px 3px rgba(58, 55, 51, 0.04)",
              }}
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[0.68rem] transition-colors cursor-pointer hover:bg-[#3a3733]/[0.03]"
                  style={{ color: opt.value === value ? "#3a3733" : "#918b80" }}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function WeeklyChart({ sessions }: { sessions: FocusSession[] }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const dayData = days.map((day) => {
    const daySessions = sessions.filter(
      (s) => s.status === "completed" && s.startTime.toDateString() === day.toDateString()
    );
    const totalMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    return { date: day, minutes: totalMinutes, label: dayLabels[day.getDay()] };
  });

  const maxMinutes = Math.max(...dayData.map((d) => d.minutes), 30);

  return (
    <div className="flex items-end justify-between gap-1 h-[52px] px-1">
      {dayData.map((d, i) => {
        const height = d.minutes > 0 ? Math.max(6, (d.minutes / maxMinutes) * 44) : 4;
        const isToday = d.date.toDateString() === today.toDateString();

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <motion.div
              className="w-full max-w-[18px] rounded-full relative group cursor-default"
              style={{
                height,
                background: isToday
                  ? "rgba(139,168,138,0.35)"
                  : d.minutes > 0
                  ? "rgba(168,162,150,0.2)"
                  : "rgba(58, 55, 51, 0.04)",
              }}
              initial={{ height: 4 }}
              animate={{ height }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
            >
              {d.minutes > 0 && (
                <div
                  className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    background: "rgba(58,55,51,0.9)",
                    padding: "2px 6px",
                    borderRadius: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span className="text-[0.55rem] text-white tabular-nums">
                    {d.minutes}m
                  </span>
                </div>
              )}
            </motion.div>
            <span
              className="text-[0.55rem] tabular-nums"
              style={{
                color: isToday ? "#7A9A78" : "#c0bab0",
              }}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatsCard({ sessions }: { sessions: FocusSession[] }) {
  const today = new Date();
  const todaySessions = sessions.filter(
    (s) => s.startTime.toDateString() === today.toDateString()
  );
  const todayCompleted = todaySessions.filter((s) => s.status === "completed");
  const todayMinutes = todayCompleted.reduce((sum, s) => sum + s.durationMinutes, 0);
  const completionRate =
    todaySessions.length > 0
      ? Math.round((todayCompleted.length / todaySessions.length) * 100)
      : 0;

  // Calculate streak
  let streak = 0;
  const checkDate = new Date(today);
  while (true) {
    const daySessions = sessions.filter(
      (s) =>
        s.status === "completed" &&
        s.startTime.toDateString() === checkDate.toDateString()
    );
    if (daySessions.length === 0 && checkDate.toDateString() !== today.toDateString()) break;
    if (daySessions.length > 0) streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      <div
        className="rounded-xl px-2.5 py-2.5 text-center"
        style={{ background: "rgba(139,168,138,0.05)" }}
      >
        <p
          className="text-[1rem] text-[#3a3733] tabular-nums"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          {todayMinutes}
        </p>
        <p className="text-[0.55rem] text-[#a09a90] uppercase tracking-[0.06em] mt-0.5">
          今日分钟
        </p>
      </div>
      <div
        className="rounded-xl px-2.5 py-2.5 text-center"
        style={{ background: "rgba(196,168,130,0.05)" }}
      >
        <p
          className="text-[1rem] text-[#3a3733] tabular-nums"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          {completionRate}%
        </p>
        <p className="text-[0.55rem] text-[#a09a90] uppercase tracking-[0.06em] mt-0.5">
          完成率
        </p>
      </div>
      <div
        className="rounded-xl px-2.5 py-2.5 text-center"
        style={{ background: "rgba(154,142,175,0.05)" }}
      >
        <div className="flex items-center justify-center gap-1">
          <Flame size={12} className="text-[#D4956A]" />
          <p
            className="text-[1rem] text-[#3a3733] tabular-nums"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            {streak}
          </p>
        </div>
        <p className="text-[0.55rem] text-[#a09a90] uppercase tracking-[0.06em] mt-0.5">
          连续天数
        </p>
      </div>
    </div>
  );
}

export function FocusHistory({ externalSessions }: { externalSessions?: FocusSession[] }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allSessions = useMemo(
    () => [...(externalSessions || []), ...mockSessions],
    [externalSessions]
  );

  const filtered = allSessions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (durationFilter === "short" && s.durationMinutes > 30) return false;
    if (durationFilter === "long" && s.durationMinutes <= 30) return false;
    if (selectedTag && s.tag !== selectedTag) return false;
    return true;
  });

  // Group by date
  const grouped: Record<string, FocusSession[]> = {};
  filtered.forEach((s) => {
    const key = formatDate(s.startTime);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  const completedToday = allSessions.filter(
    (s) => s.status === "completed" && s.startTime.toDateString() === new Date().toDateString()
  ).length;

  const totalMinutesToday = allSessions
    .filter(
      (s) => s.status === "completed" && s.startTime.toDateString() === new Date().toDateString()
    )
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <div className="focus-zip-history h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h2
          style={{ fontFamily: "'DM Serif Display', serif" }}
          className="text-[1.15rem] text-[#3a3733] tracking-[-0.01em]"
        >
          专注记录
        </h2>
        <p className="text-[0.7rem] text-[#a09a90] mt-0.5 tracking-wide">
          {completedToday} 次 · 今日 {totalMinutesToday} 分钟
        </p>
      </div>

      {/* Stats card */}
      <StatsCard sessions={allSessions} />

      {/* Weekly chart */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <TrendingUp size={11} className="text-[#b0aa9e]" />
          <span className="text-[0.62rem] text-[#918b80] uppercase tracking-[0.08em]">
            本周
          </span>
        </div>
        <div
          className="rounded-xl px-3 py-3"
          style={{ background: "rgba(58, 55, 51, 0.015)" }}
        >
          <WeeklyChart sessions={allSessions} />
        </div>
      </div>

      {/* Tags filter */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setSelectedTag(null)}
          className="px-2 py-0.5 rounded-md text-[0.62rem] cursor-pointer transition-colors"
          style={{
            background: !selectedTag ? "rgba(138,132,120,0.1)" : "rgba(58, 55, 51, 0.02)",
            color: !selectedTag ? "#5a5650" : "#b0aa9e",
          }}
        >
          全部
        </motion.button>
        {sessionTags.map((tag) => (
          <motion.button
            key={tag.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
            className="px-2 py-0.5 rounded-md text-[0.62rem] cursor-pointer transition-colors"
            style={{
              background:
                selectedTag === tag.id ? `${tag.color}18` : "rgba(58, 55, 51, 0.02)",
              color: selectedTag === tag.id ? tag.color : "#b0aa9e",
            }}
          >
            {tag.label}
          </motion.button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-3">
        <FilterChip
          label="状态"
          options={[
            { value: "all", label: "全部状态" },
            { value: "completed", label: "已完成" },
            { value: "abandoned", label: "已放弃" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <FilterChip
          label="时长"
          options={[
            { value: "all", label: "全部时长" },
            { value: "short", label: "≤ 30 min" },
            { value: "long", label: "> 30 min" },
          ]}
          value={durationFilter}
          onChange={setDurationFilter}
        />
      </div>

      {/* Session List */}
      <div
        className="flex-1 overflow-y-auto pr-1 -mr-1"
        style={{ scrollbarWidth: "none" }}
      >
        {Object.entries(grouped).map(([dateLabel, sessions]) => (
          <div key={dateLabel} className="mb-4">
            <p className="text-[0.6rem] text-[#c0bab0] uppercase tracking-[0.1em] mb-2 px-1">
              {dateLabel}
            </p>
            <div className="space-y-1">
              <AnimatePresence>
                {sessions.map((session, idx) => {
                  const tag = sessionTags.find((t) => t.id === session.tag);
                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.25 }}
                      className="p-3 rounded-xl transition-colors"
                      style={{
                        background:
                          session.status === "completed"
                            ? "rgba(139,168,138,0.035)"
                            : "rgba(58, 55, 51, 0.012)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {session.status === "completed" ? (
                            <CheckCircle2 size={12} className="text-[#8BA88A]" />
                          ) : (
                            <XCircle size={12} className="text-[#C4A882]" />
                          )}
                          <span className="text-[0.74rem] text-[#4a4640] tabular-nums">
                            {formatTime(session.startTime)} – {formatTime(session.endTime)}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-[0.62rem] text-[#b0aa9e] tabular-nums">
                          <Clock size={9} />
                          {session.durationMinutes}m
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-5">
                        <span
                          className="text-[0.6rem] px-1.5 py-0.5 rounded-md"
                          style={{
                            background:
                              session.status === "completed"
                                ? "rgba(139,168,138,0.1)"
                                : "rgba(196,168,130,0.1)",
                            color:
                              session.status === "completed" ? "#7A9A78" : "#B09870",
                          }}
                        >
                          {session.status === "completed" ? "已完成" : "已放弃"}
                        </span>
                        {tag && (
                          <span
                            className="text-[0.58rem] px-1.5 py-0.5 rounded-md"
                            style={{
                              background: `${tag.color}10`,
                              color: tag.color,
                            }}
                          >
                            {tag.label}
                          </span>
                        )}
                        {session.mode && (
                          <span className="text-[0.58rem] text-[#c8c2b8]">
                            {session.mode}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Award size={22} className="text-[#d0cac0] mb-2.5" />
            <p className="text-[0.76rem] text-[#b0aa9e]">暂无记录</p>
            <p className="text-[0.66rem] text-[#c8c2b8] mt-1">
              尝试调整筛选条件
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
