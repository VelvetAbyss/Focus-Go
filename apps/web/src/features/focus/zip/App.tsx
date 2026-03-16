import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { PanelLeft } from "lucide-react";
import { WhiteNoise } from "./components/WhiteNoise";
import { FocusTimer } from "./components/FocusTimer";
import { FocusHistory, type FocusSession } from "./components/FocusHistory";
import { db } from "../../../data/db";

const FOCUS_HISTORY_RESET_KEY = "focusgo.focus-history-reset-v1";

export default function App() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(FOCUS_HISTORY_RESET_KEY) === "1") return;

    const clearFocusHistory = async () => {
      await db.focusSessions.clear();
      window.localStorage.setItem(FOCUS_HISTORY_RESET_KEY, "1");
    };

    void clearFocusHistory();
  }, []);

  const handleSessionComplete = useCallback(
    (session: {
      startTime: Date;
      endTime: Date;
      status: "completed" | "abandoned";
      durationMinutes: number;
      mode: string;
    }) => {
      setSessions((prev) => [
        {
          id: `s-${Date.now()}`,
          ...session,
        },
        ...prev,
      ]);
    },
    []
  );

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

  return (
    <div className="focus-zip-app w-full h-screen overflow-hidden relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Ambient misty background */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 120% 80% at 20% 10%, rgba(210, 208, 200, 0.25) 0%, transparent 60%),
              radial-gradient(ellipse 100% 70% at 80% 90%, rgba(195, 205, 200, 0.2) 0%, transparent 55%),
              radial-gradient(ellipse 80% 60% at 50% 50%, rgba(220, 218, 212, 0.15) 0%, transparent 50%),
              linear-gradient(175deg, #f7f6f3 0%, #f3f2ee 35%, #efeeea 65%, #f0efeb 100%)
            `,
          }}
        />
        {/* Subtle floating light spots */}
        <div
          className="focus-zip-app__light focus-zip-app__light--left absolute w-[500px] h-[500px] rounded-full"
          style={{
            top: "10%",
            left: "15%",
            background: "radial-gradient(circle, rgba(200,198,190,0.12) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="focus-zip-app__light focus-zip-app__light--right absolute w-[400px] h-[400px] rounded-full"
          style={{
            bottom: "5%",
            right: "10%",
            background: "radial-gradient(circle, rgba(190,200,195,0.1) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-5">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "rgba(139,168,138,0.6)" }}
          />
          <span
            className="text-[0.82rem] tracking-[0.06em] text-[#8a8478]"
            style={{ fontFamily: "'DM Serif Display', serif" }}
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
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 1px 4px rgba(58, 55, 51, 0.03)",
          }}
        >
          <PanelLeft size={15} className="text-[#918b80]" />
          <span className="text-[0.72rem] text-[#918b80]">Toggle Nav</span>
        </motion.button>
      </div>

      {/* Main 3-column layout */}
      <div className="h-full pt-16 pb-6 px-6 flex gap-5">
        {/* Left Column - White Noise */}
        <div className="focus-zip-app__column focus-zip-app__column--left w-[300px] min-w-[280px] flex-shrink-0">
          <div
            className="focus-zip-app__panel h-full rounded-2xl p-6 overflow-hidden"
            style={{
              background: "rgba(255, 255, 255, 0.55)",
              backdropFilter: "blur(18px)",
              boxShadow:
                "0 4px 32px rgba(58, 55, 51, 0.03), 0 1px 4px rgba(58, 55, 51, 0.02)",
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
              background: "rgba(255, 255, 255, 0.45)",
              backdropFilter: "blur(18px)",
              boxShadow:
                "0 8px 48px rgba(58, 55, 51, 0.03), 0 1px 4px rgba(58, 55, 51, 0.015)",
            }}
          >
            {/* Subtle inner ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(245,243,237,0.6) 0%, transparent 70%)",
              }}
            />
            <FocusTimer
              onSessionComplete={handleSessionComplete}
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
              background: "rgba(255, 255, 255, 0.55)",
              backdropFilter: "blur(18px)",
              boxShadow:
                "0 4px 32px rgba(58, 55, 51, 0.03), 0 1px 4px rgba(58, 55, 51, 0.02)",
            }}
          >
            <FocusHistory externalSessions={sessions} />
          </div>
        </div>
      </div>
    </div>
  );
}
