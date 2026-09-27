import { lazy, startTransition, Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { FocusTimer } from "./components/FocusTimer";
import type { FocusSession } from "./components/FocusHistory";
import { focusRepo } from "../../../data/repositories/focusRepo";
import { tasksRepo } from "../../../data/repositories/tasksRepo";
import { useI18n } from "../../../shared/i18n/useI18n";

const FOCUS_TIMER_EVENT = "focus:timer-updated";
const INITIAL_SESSIONS_LIMIT = 60;
const WhiteNoise = lazy(() => import("./components/WhiteNoise").then((mod) => ({ default: mod.WhiteNoise })));
const FocusHistory = lazy(() => import("./components/FocusHistory").then((mod) => ({ default: mod.FocusHistory })));

type Translate = ReturnType<typeof useI18n>["t"];

const getModeLabel = (plannedMinutes: number, t: Translate) => {
  if (plannedMinutes === 25) return t("focus.mode.pomodoro");
  if (plannedMinutes === 50) return t("focus.mode.deepWork");
  if (plannedMinutes === 15) return t("focus.mode.sprint");
  if (plannedMinutes === 90) return t("focus.mode.flow");
  return undefined;
};

const toHistorySession = (t: Translate, taskTitleById: Map<string, string>) => (session: Awaited<ReturnType<typeof focusRepo.listSessions>>[number]): FocusSession => ({
  id: session.id,
  startTime: new Date(session.createdAt),
  endTime: new Date(session.completedAt ?? session.updatedAt),
  status: session.status === "completed" ? "completed" : "abandoned",
  durationMinutes: session.actualMinutes ?? session.plannedMinutes,
  mode: getModeLabel(session.plannedMinutes, t),
  taskTitle: session.taskId ? taskTitleById.get(session.taskId) : undefined,
});

export default function App() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [sidePanelsReady, setSidePanelsReady] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.dataset.theme === "dark" || root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const run = () => setSidePanelsReady(true);
    const idleWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(run, { timeout: 600 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timeoutId = globalThis.setTimeout(run, 180);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const rows = await focusRepo.listSessions(INITIAL_SESSIONS_LIMIT);
      const taskTitleById = rows.some((row) => row.taskId)
        ? new Map((await tasksRepo.list()).map((task) => [task.id, task.title] as const))
        : new Map<string, string>();
      startTransition(() => {
        setSessions(rows.map(toHistorySession(t, taskTitleById)));
      });
    } catch {
      startTransition(() => {
        setSessions([]);
      });
    }
  }, [t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const onTimerUpdate = () => {
      void loadSessions();
    };
    window.addEventListener(FOCUS_TIMER_EVENT, onTimerUpdate);
    return () => window.removeEventListener(FOCUS_TIMER_EVENT, onTimerUpdate);
  }, [loadSessions]);

  // Calculate today's stats from external sessions
  const todayStats = useMemo(() => {
    const today = new Date();
    const todayExternal = sessions.filter(
      (s) => s.status === "completed" && s.startTime.toDateString() === today.toDateString()
    );
    const externalMinutes = todayExternal.reduce((sum, s) => sum + s.durationMinutes, 0);
    return {
      minutes: externalMinutes,
      sessions: todayExternal.length,
    };
  }, [sessions]);

  // Panels follow the dashboard card language: theme surface + hairline
  // border, slightly translucent so the ambient-scene glass still reads.
  const panelBackground = "color-mix(in srgb, var(--bg-elevated) 92%, transparent)";
  const panelBackgroundStrong = "color-mix(in srgb, var(--bg-elevated) 96%, transparent)";
  const shellShadow = isDark
    ? "0 18px 44px rgba(0, 0, 0, 0.22), 0 1px 4px rgba(0, 0, 0, 0.18)"
    : "0 4px 32px rgba(58, 55, 51, 0.05), 0 1px 4px rgba(58, 55, 51, 0.04)";
  const panelFallback = (
    <div
      className="h-full rounded-2xl"
      style={{
        background: "color-mix(in srgb, var(--bg-elevated) 92%, transparent)",
      }}
    />
  );

  return (
    <div className={`focus-zip-app w-full h-screen overflow-hidden relative ${isDark ? "is-dark" : ""}`} style={{ fontFamily: 'var(--font-body)' }}>
      {/* Paper & Ink: the page sits on the shell's sheet; no decorative light spots. */}
      {/* Main 3-column layout */}
      <div className="h-full pt-6 pb-6 px-6 flex gap-5">
        {/* Left Column - White Noise */}
        <div className="focus-zip-app__column focus-zip-app__column--left w-[300px] min-w-[280px] flex-shrink-0">
          <div
            className="focus-zip-app__panel h-full rounded-2xl p-6 overflow-hidden"
            style={{
              background: panelBackground,
              backdropFilter: "blur(18px)",
              boxShadow: shellShadow,
            }}
          >
            {sidePanelsReady ? (
              <Suspense fallback={panelFallback}>
                <WhiteNoise />
              </Suspense>
            ) : panelFallback}
          </div>
        </div>

        {/* Center Column - Focus Timer */}
        <div className="focus-zip-app__column focus-zip-app__column--center flex-1 min-w-0">
          <div
            className="focus-zip-app__panel h-full rounded-2xl overflow-hidden relative"
            style={{
              background: panelBackgroundStrong,
              backdropFilter: "blur(18px)",
              boxShadow: shellShadow,
            }}
          >
            <FocusTimer
              todayMinutes={todayStats.minutes}
              todaySessions={todayStats.sessions}
              dailyGoal={120}
            />
          </div>
        </div>

        {/* Right Column - Focus History */}
        <div className="focus-zip-app__column focus-zip-app__column--right w-[300px] min-w-[280px] flex-shrink-0">
          <div
            className="focus-zip-app__panel h-full rounded-2xl p-6 overflow-hidden"
            style={{
              background: panelBackground,
              backdropFilter: "blur(18px)",
              boxShadow: shellShadow,
            }}
          >
            {sidePanelsReady ? (
              <Suspense fallback={panelFallback}>
                <FocusHistory externalSessions={sessions} />
              </Suspense>
            ) : panelFallback}
          </div>
        </div>
      </div>
    </div>
  );
}
