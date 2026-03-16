import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  Coffee,
  Flame,
  CloudRain,
  Wind,
  CloudLightning,
  Waves,
  Moon,
  Sparkles,
} from "lucide-react";
import { useSharedNoise } from "../../SharedNoiseProvider";
import type { NoiseTrackId } from "../../../../data/models/types";

interface SoundTrack {
  id: NoiseTrackId;
  name: string;
  icon: ReactNode;
  enabled: boolean;
  volume: number;
  color: string;
}

interface SoundPreset {
  id: string;
  name: string;
  emoji: string;
  tracks: Record<NoiseTrackId, { enabled: boolean; volume: number }>;
}

const soundPresets: SoundPreset[] = [
  {
    id: "rainy-cafe",
    name: "Rainy Cafe",
    emoji: "☕",
    tracks: {
      cafe: { enabled: true, volume: 0.5 },
      fireplace: { enabled: false, volume: 0.4 },
      rain: { enabled: true, volume: 0.65 },
      wind: { enabled: false, volume: 0.3 },
      thunder: { enabled: false, volume: 0.2 },
      ocean: { enabled: false, volume: 0.5 },
    },
  },
  {
    id: "stormy-night",
    name: "Stormy Night",
    emoji: "🌩",
    tracks: {
      cafe: { enabled: false, volume: 0.5 },
      fireplace: { enabled: true, volume: 0.6 },
      rain: { enabled: true, volume: 0.8 },
      wind: { enabled: true, volume: 0.4 },
      thunder: { enabled: true, volume: 0.35 },
      ocean: { enabled: false, volume: 0.5 },
    },
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    emoji: "🌊",
    tracks: {
      cafe: { enabled: false, volume: 0.5 },
      fireplace: { enabled: false, volume: 0.4 },
      rain: { enabled: false, volume: 0.5 },
      wind: { enabled: true, volume: 0.35 },
      thunder: { enabled: false, volume: 0.2 },
      ocean: { enabled: true, volume: 0.75 },
    },
  },
  {
    id: "cozy-fireside",
    name: "Cozy Fireside",
    emoji: "🔥",
    tracks: {
      cafe: { enabled: false, volume: 0.5 },
      fireplace: { enabled: true, volume: 0.7 },
      rain: { enabled: true, volume: 0.3 },
      wind: { enabled: false, volume: 0.2 },
      thunder: { enabled: false, volume: 0.15 },
      ocean: { enabled: false, volume: 0.5 },
    },
  },
];

const defaultTracks: SoundTrack[] = [
  { id: "cafe", name: "Cafe", icon: <Coffee size={15} />, enabled: true, volume: 0.6, color: "#C4A882" },
  { id: "fireplace", name: "Fireplace", icon: <Flame size={15} />, enabled: true, volume: 0.4, color: "#D4956A" },
  { id: "rain", name: "Rain", icon: <CloudRain size={15} />, enabled: true, volume: 0.7, color: "#8BA4B8" },
  { id: "wind", name: "Wind", icon: <Wind size={15} />, enabled: false, volume: 0.5, color: "#A3B8A0" },
  { id: "thunder", name: "Thunder", icon: <CloudLightning size={15} />, enabled: false, volume: 0.3, color: "#9A8EAF" },
  { id: "ocean", name: "Ocean", icon: <Waves size={15} />, enabled: false, volume: 0.5, color: "#7BA5B5" },
];

function SoundBarVisualizer({ tracks, isPlaying }: { tracks: SoundTrack[]; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const barsRef = useRef<number[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const barCount = 36;
    const gap = 3;
    const barWidth = (w - gap * (barCount - 1)) / barCount;
    const activeTracks = tracks.filter((t) => t.enabled);
    const avgVol =
      activeTracks.length > 0
        ? activeTracks.reduce((sum, t) => sum + t.volume, 0) / activeTracks.length
        : 0;

    if (barsRef.current.length !== barCount) {
      barsRef.current = Array.from({ length: barCount }, () => Math.random() * 0.3);
    }

    for (let i = 0; i < barCount; i++) {
      const target =
        isPlaying && activeTracks.length > 0
          ? (Math.sin(Date.now() * 0.002 + i * 0.5) * 0.3 + 0.5) * avgVol
          : 0.03;
      barsRef.current[i] += (target - barsRef.current[i]) * 0.08;
      const barH = Math.max(2, barsRef.current[i] * h * 0.85);
      const x = i * (barWidth + gap);
      const y = (h - barH) / 2;

      const gradient = ctx.createLinearGradient(x, y, x, y + barH);
      gradient.addColorStop(0, "rgba(168, 162, 150, 0.12)");
      gradient.addColorStop(0.5, "rgba(168, 162, 150, 0.32)");
      gradient.addColorStop(1, "rgba(168, 162, 150, 0.12)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [tracks, isPlaying]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return <canvas ref={canvasRef} className="w-full" style={{ height: 44 }} />;
}

function PremiumSlider({
  value,
  onChange,
  color,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current || disabled) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onChange(pct);
    },
    [onChange, disabled]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => updateValue(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, updateValue]);

  return (
    <div
      ref={trackRef}
      className="relative h-[5px] rounded-full cursor-pointer group"
      style={{ background: disabled ? "rgba(58, 55, 51, 0.04)" : "rgba(58, 55, 51, 0.06)" }}
      onMouseDown={(e) => {
        setDragging(true);
        updateValue(e.clientX);
      }}
    >
      <motion.div
        className="absolute left-0 top-0 h-full rounded-full"
        style={{
          width: `${value * 100}%`,
          background: disabled ? "rgba(58, 55, 51, 0.08)" : color,
          opacity: disabled ? 0.4 : 0.5,
        }}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
      <motion.div
        className="absolute top-1/2 rounded-full"
        style={{
          left: `${value * 100}%`,
          width: 13,
          height: 13,
          background: disabled ? "rgba(58, 55, 51, 0.12)" : color,
          opacity: disabled ? 0.4 : 0.8,
          boxShadow: dragging
            ? `0 0 0 4px ${color}20, 0 1px 3px rgba(58, 55, 51, 0.1)`
            : "0 1px 3px rgba(58, 55, 51, 0.08)",
        }}
        initial={false}
        animate={{ x: -6.5, y: "-50%", scale: 1 }}
        whileHover={{ scale: 1.2 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
    </div>
  );
}

export function WhiteNoise() {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [showSleepOptions, setShowSleepOptions] = useState(false);
  const presetHydratedRef = useRef(false);
  const {
    noise,
    setNoise,
    toggleNoisePlaying,
    setNoiseTrackEnabled,
    setNoiseTrackVolume,
    setNoiseMasterVolume,
    setNoiseSleepTimer,
  } = useSharedNoise();

  const isPlaying = noise.playing;
  const masterVolume = noise.masterVolume;
  const sleepTimer = noise.sleepDurationMinutes ?? null;
  const tracks = useMemo(
    () =>
      defaultTracks.map((track) => ({
        ...track,
        enabled: noise.tracks[track.id].enabled,
        volume: noise.tracks[track.id].volume,
      })),
    [noise.tracks]
  );

  useEffect(() => {
    if (presetHydratedRef.current) return;
    const matchedPreset = soundPresets.find((preset) =>
      defaultTracks.every((track) => {
        const current = noise.tracks[track.id];
        const target = preset.tracks[track.id];
        return current.enabled === target.enabled && Math.abs(current.volume - target.volume) < 0.001;
      })
    );
    setActivePreset(matchedPreset?.id ?? null);
    presetHydratedRef.current = true;
  }, [noise.tracks]);

  const toggleTrack = (id: NoiseTrackId) => {
    setActivePreset(null);
    setNoiseTrackEnabled(id, !noise.tracks[id].enabled);
  };

  const setTrackVolume = (id: NoiseTrackId, volume: number) => {
    setActivePreset(null);
    setNoiseTrackVolume(id, volume);
  };

  const applyPreset = (preset: SoundPreset) => {
    if (activePreset === preset.id) {
      setActivePreset(null);
      return;
    }
    setActivePreset(preset.id);
    setNoise({
      ...noise,
      playing: true,
      tracks: preset.tracks,
    });
  };

  const startSleepTimer = (minutes: number) => {
    setNoiseSleepTimer(minutes);
    setShowSleepOptions(false);
  };

  const cancelSleepTimer = () => {
    setNoiseSleepTimer(null);
  };

  // Sleep timer countdown
  useEffect(() => {
    if (!noise.sleepEndsAt) {
      setSleepRemaining(null);
      return;
    }

    const sleepEndsAt = noise.sleepEndsAt;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 1000));
      setSleepRemaining(remaining);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [noise.sleepEndsAt]);

  const activeTracks = tracks.filter((t) => t.enabled).length;

  const handlePlayPause = () => {
    if (!isPlaying && activeTracks === 0) {
      return;
    }
    toggleNoisePlaying();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            style={{ fontFamily: "'DM Serif Display', serif" }}
            className="text-[1.15rem] text-[#3a3733] tracking-[-0.01em]"
          >
            White Noise
          </h2>
          <p className="text-[0.7rem] text-[#a09a90] mt-0.5 tracking-wide">
            {activeTracks} sound{activeTracks !== 1 ? "s" : ""} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sleep timer */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            onClick={() =>
                sleepTimer ? cancelSleepTimer() : setShowSleepOptions(!showSleepOptions)
              }
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer relative"
              style={{
                background: sleepTimer
                  ? "rgba(139,168,138,0.12)"
                  : "rgba(168, 162, 150, 0.08)",
              }}
            >
              <Moon
                size={13}
                className={sleepTimer ? "text-[#7A9A78]" : "text-[#a09a90]"}
              />
              {sleepRemaining !== null && (
                <span className="absolute -bottom-0.5 -right-0.5 text-[0.5rem] text-[#7A9A78] tabular-nums">
                  {Math.ceil(sleepRemaining / 60)}
                </span>
              )}
            </motion.button>
            <AnimatePresence>
              {showSleepOptions && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSleepOptions(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 z-50 rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(255,255,255,0.95)",
                      backdropFilter: "blur(20px)",
                      boxShadow:
                        "0 6px 24px rgba(58, 55, 51, 0.06), 0 1px 3px rgba(58, 55, 51, 0.04)",
                    }}
                  >
                    <div className="px-3 pt-2.5 pb-1">
                      <p className="text-[0.62rem] text-[#918b80] uppercase tracking-[0.08em]">
                        Sleep Timer
                      </p>
                    </div>
                    {[15, 30, 45, 60, 90].map((m) => (
                      <button
                        key={m}
                        onClick={() => startSleepTimer(m)}
                        className="w-full text-left px-3.5 py-1.5 text-[0.72rem] text-[#5a5650] transition-colors cursor-pointer hover:bg-[#3a3733]/[0.03] whitespace-nowrap"
                      >
                        {m} minutes
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          {/* Play/Pause */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePlayPause}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{
              background: isPlaying
                ? "rgba(168, 162, 150, 0.15)"
                : "rgba(168, 162, 150, 0.08)",
            }}
          >
            {isPlaying ? (
              <Pause size={14} className="text-[#7a7568]" />
            ) : (
              <Play size={14} className="text-[#7a7568] ml-0.5" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Visualizer */}
      <div
        className="mb-4 rounded-xl overflow-hidden"
        style={{ background: "rgba(58, 55, 51, 0.015)" }}
      >
        <SoundBarVisualizer tracks={tracks} isPlaying={isPlaying} />
      </div>

      {/* Scene Presets */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles size={11} className="text-[#b0aa9e]" />
          <span className="text-[0.66rem] text-[#918b80] uppercase tracking-[0.08em]">
            Scenes
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {soundPresets.map((preset) => (
            <motion.button
              key={preset.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => applyPreset(preset)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-left cursor-pointer transition-all"
              style={{
                background:
                  activePreset === preset.id
                    ? "rgba(139,168,138,0.08)"
                    : "rgba(58, 55, 51, 0.018)",
                border:
                  activePreset === preset.id
                    ? "1px solid rgba(139,168,138,0.15)"
                    : "1px solid transparent",
              }}
            >
              <span className="text-[0.85rem]">{preset.emoji}</span>
              <span
                className="text-[0.68rem] truncate"
                style={{
                  color:
                    activePreset === preset.id ? "#5a7a58" : "#8a8478",
                }}
              >
                {preset.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Master Volume */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[0.66rem] text-[#918b80] uppercase tracking-[0.08em]">
            Master Volume
          </span>
          <span className="text-[0.66rem] text-[#b0aa9e] tabular-nums">
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
        <PremiumSlider value={masterVolume} onChange={setNoiseMasterVolume} color="#8a8478" />
      </div>

      {/* Divider */}
      <div className="h-px mb-3" style={{ background: "rgba(58, 55, 51, 0.04)" }} />

      {/* Tracks */}
      <div
        className="flex-1 overflow-y-auto space-y-0.5 pr-1 -mr-1"
        style={{ scrollbarWidth: "none" }}
      >
        {tracks.map((track, idx) => (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.3 }}
            className="py-2.5 px-2.5 rounded-xl transition-colors"
            style={{
              background: track.enabled ? "rgba(58, 55, 51, 0.015)" : "transparent",
            }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-6.5 h-6.5 rounded-lg flex items-center justify-center transition-all"
                style={{
                  width: 26,
                  height: 26,
                  background: track.enabled ? `${track.color}18` : "rgba(58, 55, 51, 0.025)",
                  color: track.enabled ? track.color : "#c0bab0",
                }}
              >
                {track.icon}
              </div>
              <span
                className="flex-1 text-[0.76rem] transition-colors"
                style={{ color: track.enabled ? "#4a4640" : "#b0aa9e" }}
              >
                {track.name}
              </span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => toggleTrack(track.id)}
                className="w-7 h-[16px] rounded-full relative transition-colors cursor-pointer"
                style={{
                  background: track.enabled ? `${track.color}40` : "rgba(58, 55, 51, 0.06)",
                }}
              >
                <motion.div
                  className="absolute top-[2px] w-[12px] h-[12px] rounded-full"
                  style={{
                    background: track.enabled ? track.color : "#d0cac0",
                    opacity: track.enabled ? 0.85 : 0.5,
                  }}
                  animate={{ left: track.enabled ? 13 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>
            <div className="pl-9">
              <PremiumSlider
                value={track.volume}
                onChange={(v) => setTrackVolume(track.id, v)}
                color={track.color}
                disabled={!track.enabled}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sleep timer indicator */}
      <AnimatePresence>
        {sleepTimer !== null && sleepRemaining !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: "rgba(139,168,138,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <Moon size={11} className="text-[#7A9A78]" />
              <span className="text-[0.66rem] text-[#7A9A78]">
                Sleep in {Math.floor(sleepRemaining / 60)}:{String(sleepRemaining % 60).padStart(2, "0")}
              </span>
            </div>
            <button
              onClick={cancelSleepTimer}
              className="text-[0.62rem] text-[#a09a90] cursor-pointer hover:text-[#7a7568] transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
