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
} from "lucide-react";
import { useI18n } from "../../../../shared/i18n/useI18n";
import { DURATION, EASE } from '../../../../shared/motion/tokens'
import { appIntlLocale } from '../../../../shared/i18n/format'
import Doodle from '../../../../shared/ui/Doodle'

export interface FocusSession {
  id: string;
  startTime: Date;
  endTime: Date;
  status: "completed" | "abandoned";
  durationMinutes: number;
  tag?: string;
  mode?: string;
  /** Title of the task the session was for, when one was chosen. */
  taskTitle?: string;
}

const sessionTags = [
  { id: "work" },
  { id: "study" },
  { id: "reading" },
  { id: "creative" },
  { id: "other" },
];

const mockSessions: FocusSession[] = [];

function formatTime(date: Date) {
  return date.toLocaleTimeString(appIntlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(date: Date, language: "en" | "zh") {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return language === "zh" ? "今天" : "Today";
  if (date.toDateString() === yesterday.toDateString()) return language === "zh" ? "昨天" : "Yesterday";
  return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
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
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-meta cursor-pointer transition-colors"
        style={{
          background: value !== "all" ? "var(--accent-wash)" : "color-mix(in srgb, var(--text-primary) 2.5%, transparent)",
          color: value !== "all" ? "var(--accent)" : "var(--text-secondary)",
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
              transition={{ duration: DURATION.fast }}
              className="absolute top-full left-0 mt-1.5 z-50 rounded-xl overflow-hidden min-w-[120px]"
              style={{
                background: "var(--paper-raised)",
                boxShadow: "0 6px 24px color-mix(in srgb, var(--text-primary) 6%, transparent), 0 1px 3px color-mix(in srgb, var(--text-primary) 4%, transparent)",
              }}
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-meta transition-colors cursor-pointer hover:bg-[var(--text-primary)]/[0.03]"
                  style={{ color: opt.value === value ? "var(--text-primary)" : "var(--text-secondary)" }}
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

// Week chart (DESIGN.md › Charts): the daily goal is a dashed pencil outline,
// what actually happened is an ink bar, today is the pen. Values sit on the
// marks; one baseline, no gridlines.
function WeeklyChart({ sessions, goalMinutes }: { sessions: FocusSession[]; goalMinutes: number }) {
  const { language } = useI18n();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const dayLabels = language === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["S", "M", "T", "W", "T", "F", "S"];

  const dayData = days.map((day) => {
    const daySessions = sessions.filter(
      (s) => s.status === "completed" && s.startTime.toDateString() === day.toDateString()
    );
    const totalMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    return { date: day, minutes: totalMinutes, label: dayLabels[day.getDay()] };
  });

  const PLOT = 56;
  const scaleMax = Math.max(goalMinutes, ...dayData.map((d) => d.minutes));
  const goalHeight = Math.round((goalMinutes / scaleMax) * PLOT);

  return (
    <div className="focus-week-chart">
      <div className="focus-week-chart__plot" style={{ height: PLOT + 16 }}>
        {dayData.map((d, i) => {
          const height = d.minutes > 0 ? Math.max(3, Math.round((d.minutes / scaleMax) * PLOT)) : 0;
          const isToday = d.date.toDateString() === today.toDateString();
          return (
            <div key={i} className="focus-week-chart__col" data-today={isToday ? "true" : undefined}>
              <span className="focus-week-chart__goal" style={{ height: goalHeight }} aria-hidden />
              {d.minutes > 0 ? (
                <span className="focus-week-chart__value" style={{ bottom: Math.max(height, goalHeight) + 3 }}>
                  {d.minutes}
                </span>
              ) : null}
              <motion.span
                className="focus-week-chart__bar"
                initial={{ height: 0 }}
                animate={{ height }}
                transition={{ delay: i * 0.04, duration: DURATION.slow, ease: EASE.emphasized }}
                aria-label={`${d.label} ${d.minutes}m`}
              />
            </div>
          );
        })}
      </div>
      <div className="focus-week-chart__labels">
        {dayData.map((d, i) => (
          <span key={i} data-today={d.date.toDateString() === today.toDateString() ? "true" : undefined}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatsCard({ sessions }: { sessions: FocusSession[] }) {
  const { t } = useI18n();
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
        style={{ background: "var(--paper-sunken)" }}
      >
        <p
          className="text-section text-[var(--text-primary)] tabular-nums"
          style={{ fontFamily: 'var(--font-numeral)', fontVariantNumeric: 'var(--num-features)' }}
        >
          {todayMinutes}
        </p>
        <p className="text-meta text-[var(--text-secondary)] uppercase tracking-[var(--tracking-caps)] mt-0.5">
          {t("focus.stats.minToday")}
        </p>
      </div>
      <div
        className="rounded-xl px-2.5 py-2.5 text-center"
        style={{ background: "var(--paper-sunken)" }}
      >
        <p
          className="text-section text-[var(--text-primary)] tabular-nums"
          style={{ fontFamily: 'var(--font-numeral)', fontVariantNumeric: 'var(--num-features)' }}
        >
          {completionRate}%
        </p>
        <p className="text-meta text-[var(--text-secondary)] uppercase tracking-[var(--tracking-caps)] mt-0.5">
          {t("focus.stats.rate")}
        </p>
      </div>
      <div
        className="rounded-xl px-2.5 py-2.5 text-center"
        style={{ background: "var(--paper-sunken)" }}
      >
        <div className="flex items-center justify-center gap-1">
          <Flame size={12} className="text-tone-done" />
          <p
            className="text-section text-[var(--text-primary)] tabular-nums"
            style={{ fontFamily: 'var(--font-numeral)', fontVariantNumeric: 'var(--num-features)' }}
          >
            {streak}
          </p>
        </div>
        <p className="text-meta text-[var(--text-secondary)] uppercase tracking-[var(--tracking-caps)] mt-0.5">
          {t("focus.stats.streak")}
        </p>
      </div>
    </div>
  );
}

export function FocusHistory({ externalSessions, goalMinutes = 120 }: { externalSessions?: FocusSession[]; goalMinutes?: number }) {
  const { language, t } = useI18n();
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
    const key = formatDate(s.startTime, language);
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
  const sessionTagLabels: Record<string, string> = {
    work: t("focus.filter.work"),
    study: t("focus.filter.study"),
    reading: t("focus.filter.reading"),
    creative: t("focus.filter.creative"),
    other: t("focus.filter.other"),
  };

  return (
    <div className="focus-zip-history h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h2
          style={{ fontFamily: 'var(--font-display)' }}
          className="text-subhead text-[var(--text-primary)] tracking-[-0.01em]"
        >
          {t("focus.history")}
        </h2>
        <p className="text-meta text-[var(--text-secondary)] mt-0.5 tracking-wide">
          {language === "zh" ? `${completedToday} 次 · 今日 ${totalMinutesToday} 分钟` : `${completedToday} sessions today · ${totalMinutesToday} min`}
        </p>
      </div>

      {/* Stats card */}
      <StatsCard sessions={allSessions} />

      {/* Weekly chart */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <TrendingUp size={11} className="text-[var(--text-secondary)]" />
          <span className="text-meta text-[var(--text-secondary)] uppercase tracking-[var(--tracking-caps)]">
            {t("focus.stats.thisWeek")}
          </span>
        </div>
        <WeeklyChart sessions={allSessions} goalMinutes={goalMinutes} />
      </div>

      {/* Tags filter — only once sessions actually carry a category; otherwise every chip is empty. */}
      {allSessions.some((session) => session.tag) ? (
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setSelectedTag(null)}
          className="px-2 py-0.5 rounded-md text-meta cursor-pointer transition-colors"
          style={{
            background: !selectedTag ? "rgba(138,132,120,0.1)" : "color-mix(in srgb, var(--text-primary) 2%, transparent)",
            color: !selectedTag ? "var(--text-secondary)" : "var(--text-secondary)",
          }}
        >
          {t("focus.filter.all")}
        </motion.button>
        {sessionTags.map((tag) => (
          <motion.button
            key={tag.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
            className="px-2 py-0.5 rounded-md text-meta cursor-pointer transition-colors"
            style={{
              background:
                selectedTag === tag.id ? "var(--accent-wash)" : "color-mix(in srgb, var(--text-primary) 2%, transparent)",
              color: selectedTag === tag.id ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {sessionTagLabels[tag.id] ?? tag.id}
          </motion.button>
        ))}
      </div>
      ) : null}

      {/* Filters */}
      <div className="flex gap-1.5 mb-3">
        <FilterChip
          label={language === "zh" ? "状态" : "Status"}
          options={[
            { value: "all", label: t("focus.filter.allStatus") },
            { value: "completed", label: t("tasks.status.done") },
            { value: "abandoned", label: language === "zh" ? "已放弃" : "Abandoned" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <FilterChip
          label={language === "zh" ? "时长" : "Duration"}
          options={[
            { value: "all", label: t("focus.filter.allDurations") },
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
            <p className="text-meta text-[var(--text-secondary)] uppercase tracking-[var(--tracking-caps)] mb-2 px-1">
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
                      transition={{ delay: idx * 0.03, duration: DURATION.medium }}
                      className="p-3 rounded-xl transition-colors"
                      style={{
                        background:
                          "color-mix(in srgb, var(--text-primary) 1.2%, transparent)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {session.status === "completed" ? (
                            <CheckCircle2 size={12} className="text-tone-done" />
                          ) : (
                            <XCircle size={12} className="text-tone-warn" />
                          )}
                          <span className="text-label text-[var(--text-secondary)] tabular-nums">
                            {formatTime(session.startTime)} – {formatTime(session.endTime)}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-meta text-[var(--text-secondary)] tabular-nums">
                          <Clock size={9} />
                          {session.durationMinutes}m
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-5">
                        <span
                          className="text-meta px-1.5 py-0.5 rounded-md"
                          style={{
                            background:
                              session.status === "completed"
                                ? "var(--tone-done-wash)"
                                : "var(--tone-warn-wash)",
                            color:
                              session.status === "completed" ? "var(--tone-done)" : "var(--tone-warn)",
                          }}
                        >
                          {session.status === "completed" ? t("tasks.status.done") : language === "zh" ? "已放弃" : "Abandoned"}
                        </span>
                        {tag && (
                          <span
                            className="text-meta px-1.5 py-0.5 rounded-md"
                            style={{
                              background: "var(--paper-sunken)",
                              color: "var(--ink-2)",
                            }}
                          >
                            {sessionTagLabels[tag.id] ?? tag.id}
                          </span>
                        )}
                        {session.taskTitle ? (
                          <span className="min-w-0 truncate text-meta font-medium text-ink-1">
                            {session.taskTitle}
                          </span>
                        ) : session.mode ? (
                          <span className="text-meta text-[var(--text-secondary)]">
                            {session.mode}
                          </span>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          // Centred: one serif line, one sentence (DESIGN.md › Empty states).
          <div className="flex flex-col items-center py-6 text-center">
            {allSessions.length === 0 ? <Doodle name="levitate" height={88} className="mb-3" /> : null}
            <p className="font-display text-section font-semibold text-ink-1">{t("focus.empty.noSessions")}</p>
            <p className="text-label text-ink-3 mt-1">
              {allSessions.length === 0 ? t("focus.empty.firstSession") : t("focus.empty.adjustFilters")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
