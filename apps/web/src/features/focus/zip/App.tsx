import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { PanelLeft } from "lucide-react";
import { WhiteNoise } from "./components/WhiteNoise";
import { FocusTimer } from "./components/FocusTimer";
import { FocusHistory, type FocusSession } from "./components/FocusHistory";
import { focusRepo } from "../../../data/repositories/focusRepo";

const FOCUS_TIMER_EVENT = "focus:timer-updated";

const getModeLabel = (plannedMinutes: number) => {
  if (plannedMinutes === 25) return "番茄钟";
  if (plannedMinutes === 50) return "深度工作";
  if (plannedMinutes === 15) return "冲刺";
  if (plannedMinutes === 90) return "心流";
  return undefined;
};

const toHistorySession = (session: Awaited<ReturnType<typeof focusRepo.listSessions>>[number]): FocusSession => ({
  id: session.id,
  startTime: new Date(session.createdAt),
  endTime: new Date(session.completedAt ?? session.updatedAt),
  status: session.status === "completed" ? "completed" : "abandoned",
  durationMinutes: session.actualMinutes ?? session.plannedMinutes,
  mode: getModeLabel(session.plannedMinutes),
});

export default function App() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [navExpanded, setNavExpanded] = useState(false);
  const [entered] = useState(true);
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

  const loadSessions = useCallback(async () => {
    const rows = await focusRepo.listSessions();
    setSessions(rows.map(toHistorySession));
  }, []);

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

  const shellGradient = isDark
    ? `
      radial-gradient(ellipse 120% 80% at 20% 10%, rgba(110, 138, 132, 0.18) 0%, transparent 60%),
      radial-gradient(ellipse 100% 70% at 80% 90%, rgba(76, 98, 112, 0.2) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 50%, rgba(92, 88, 82, 0.14) 0%, transparent 50%),
      linear-gradient(175deg, #1f2328 0%, #232932 36%, #242924 68%, #1e211e 100%)
    `
    : `
      radial-gradient(ellipse 120% 80% at 20% 10%, rgba(210, 208, 200, 0.25) 0%, transparent 60%),
      radial-gradient(ellipse 100% 70% at 80% 90%, rgba(195, 205, 200, 0.2) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 50%, rgba(220, 218, 212, 0.15) 0%, transparent 50%),
      linear-gradient(175deg, #f7f6f3 0%, #f3f2ee 35%, #efeeea 65%, #f0efeb 100%)
    `;
  const panelBackground = isDark ? "rgba(23, 29, 35, 0.62)" : "rgba(255, 255, 255, 0.55)";
  const panelBackgroundStrong = isDark ? "rgba(26, 32, 38, 0.72)" : "rgba(255, 255, 255, 0.45)";
  const shellShadow = isDark
    ? "0 18px 56px rgba(0, 0, 0, 0.28), 0 1px 4px rgba(0, 0, 0, 0.2)"
    : "0 4px 32px rgba(58, 55, 51, 0.03), 0 1px 4px rgba(58, 55, 51, 0.02)";

  return (
    <div className={`focus-zip-app w-full h-screen overflow-hidden relative ${isDark ? "is-dark" : ""}`} style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Ambient misty background */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: shellGradient,
          }}
        />
        {/* Subtle floating light spots */}
        <div
          className="focus-zip-app__light focus-zip-app__light--left absolute w-[500px] h-[500px] rounded-full"
          style={{
            top: "10%",
            left: "15%",
            background: isDark ? "radial-gradient(circle, rgba(110,138,132,0.14) 0%, transparent 70%)" : "radial-gradient(circle, rgba(200,198,190,0.12) 0%, transparent 70%)",
            filter: entered ? "blur(40px)" : "none",
            opacity: entered ? 1 : 0.3,
          }}
        />
        <div
          className="focus-zip-app__light focus-zip-app__light--right absolute w-[400px] h-[400px] rounded-full"
          style={{
            bottom: "5%",
            right: "10%",
            background: isDark ? "radial-gradient(circle, rgba(88,108,124,0.14) 0%, transparent 70%)" : "radial-gradient(circle, rgba(190,200,195,0.1) 0%, transparent 70%)",
            filter: entered ? "blur(40px)" : "none",
            opacity: entered ? 1 : 0.3,
          }}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-5">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: isDark ? "rgba(126,219,199,0.72)" : "rgba(139,168,138,0.6)" }}
          />
          <span
            className="text-[0.82rem] tracking-[0.06em]"
            style={{ color: isDark ? "#d5d0c8" : "#8a8478", fontFamily: "'DM Serif Display', serif" }}
          >
            Focus&go
          </span>
        </div>

        {/* Toggle Nav */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setNavExpanded(!navExpanded)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-colors"
          style={{
            background: isDark ? "rgba(24,29,35,0.72)" : "rgba(255,255,255,0.6)",
            backdropFilter: entered ? "blur(12px)" : "none",
            boxShadow: shellShadow,
          }}
        >
          <PanelLeft size={15} className={isDark ? "text-[#d5d0c8]" : "text-[#918b80]"} />
          <span className={`text-[0.72rem] ${isDark ? "text-[#d5d0c8]" : "text-[#918b80]"}`}>Toggle Nav</span>
        </motion.button>
      </div>

      {/* Main 3-column layout */}
      <div className="h-full pt-16 pb-6 px-6 flex gap-5">
        {/* Left Column - White Noise */}
        <div className="focus-zip-app__column focus-zip-app__column--left w-[300px] min-w-[280px] flex-shrink-0">
          <div
            className="focus-zip-app__panel h-full rounded-2xl p-6 overflow-hidden"
            style={{
              background: panelBackground,
              backdropFilter: entered ? "blur(18px)" : "none",
              boxShadow: shellShadow,
            }}
          >
            <WhiteNoise />
          </div>
        </div>

        {/* Center Column - Focus Timer */}
        <div className="focus-zip-app__column focus-zip-app__column--center flex-1 min-w-0">
          <div
            className="focus-zip-app__panel h-full rounded-2xl overflow-hidden relative"
            style={{
              background: panelBackgroundStrong,
              backdropFilter: entered ? "blur(18px)" : "none",
              boxShadow: shellShadow,
            }}
          >
            {/* Subtle inner ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: isDark
                  ? "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(126,219,199,0.1) 0%, transparent 70%)"
                  : "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(245,243,237,0.6) 0%, transparent 70%)",
              }}
            />
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
              backdropFilter: entered ? "blur(18px)" : "none",
              boxShadow: shellShadow,
            }}
          >
            <FocusHistory externalSessions={sessions} />
          </div>
        </div>
      </div>
    </div>
  );
}
