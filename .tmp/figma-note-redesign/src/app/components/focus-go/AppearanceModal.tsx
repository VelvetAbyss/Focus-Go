import { X, Sun, Moon } from "lucide-react";
import type { AppearanceSettings, ThemeMode, FontFamily } from "./types";

interface AppearanceModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppearanceSettings;
  onUpdate: (settings: Partial<AppearanceSettings>) => void;
}

export function AppearanceModal({
  open,
  onClose,
  settings,
  onUpdate,
}: AppearanceModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-popover rounded-2xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Appearance</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Theme */}
          <div>
            <label className="text-muted-foreground mb-2 block" style={{ fontSize: "12px", fontWeight: 500 }}>
              Theme
            </label>
            <div className="flex gap-2">
              <ThemeOption
                label="Paper"
                icon={Sun}
                active={settings.theme === "paper"}
                onClick={() => onUpdate({ theme: "paper" })}
              />
              <ThemeOption
                label="Graphite"
                icon={Moon}
                active={settings.theme === "graphite"}
                onClick={() => onUpdate({ theme: "graphite" })}
              />
            </div>
          </div>

          {/* Font */}
          <div>
            <label className="text-muted-foreground mb-2 block" style={{ fontSize: "12px", fontWeight: 500 }}>
              Font
            </label>
            <div className="flex gap-2">
              {(["sans", "serif", "mono"] as FontFamily[]).map((f) => (
                <button
                  key={f}
                  onClick={() => onUpdate({ font: f })}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    settings.font === f
                      ? "border-foreground bg-accent"
                      : "border-border hover:border-foreground/30"
                  }`}
                  style={{
                    fontSize: "12px",
                    fontFamily: f === "sans" ? "system-ui" : f === "serif" ? "Georgia, serif" : "monospace",
                  }}
                >
                  {f === "sans" ? "UI Sans" : f === "serif" ? "Serif" : "Mono"}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <SliderSetting
            label="Font Size"
            value={settings.fontSize}
            min={12}
            max={20}
            step={1}
            display={`${settings.fontSize}px`}
            onChange={(v) => onUpdate({ fontSize: v })}
          />

          {/* Line Height */}
          <SliderSetting
            label="Line Height"
            value={settings.lineHeight}
            min={1.2}
            max={2.2}
            step={0.1}
            display={settings.lineHeight.toFixed(1)}
            onChange={(v) => onUpdate({ lineHeight: v })}
          />

          {/* Content Width */}
          <SliderSetting
            label="Content Width"
            value={settings.contentWidth}
            min={0}
            max={100}
            step={5}
            display={settings.contentWidth < 30 ? "Narrow" : settings.contentWidth > 70 ? "Wide" : "Medium"}
            onChange={(v) => onUpdate({ contentWidth: v })}
          />

          {/* Focus Mode */}
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>
              Focus Mode
            </label>
            <button
              onClick={() => onUpdate({ focusMode: !settings.focusMode })}
              className={`relative w-10 h-[22px] rounded-full transition-colors ${
                settings.focusMode ? "bg-foreground" : "bg-[var(--switch-background)]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${
                  settings.focusMode ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeOption({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
        active ? "border-foreground bg-accent" : "border-border hover:border-foreground/30"
      }`}
      style={{ fontSize: "13px" }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function SliderSetting({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>
          {label}
        </label>
        <span className="text-muted-foreground" style={{ fontSize: "11px" }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-accent cursor-pointer accent-foreground"
      />
    </div>
  );
}
