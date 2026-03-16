import { Moon, Sun, X } from 'lucide-react'
import type { NoteAppearanceSettings, NoteFontFamily } from '../../../data/models/types'

type Props = {
  open: boolean
  settings: NoteAppearanceSettings
  onClose: () => void
  onUpdate: (patch: Partial<NoteAppearanceSettings>) => void
}

export default function AppearanceModal({ open, settings, onClose, onUpdate }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#3a3733]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center justify-between px-6 pb-4 pt-5">
          <h2 className="text-[16px] font-semibold">Appearance</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-accent">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-5 px-6 pb-6">
          <div>
            <label className="mb-2 block text-[12px] font-medium text-muted-foreground">Theme</label>
            <div className="flex gap-2">
              <ThemeButton label="Paper" icon={Sun} active={settings.theme === 'paper'} onClick={() => onUpdate({ theme: 'paper' })} />
              <ThemeButton label="Graphite" icon={Moon} active={settings.theme === 'graphite'} onClick={() => onUpdate({ theme: 'graphite' })} />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-[12px] font-medium text-muted-foreground">Font</label>
            <div className="flex gap-2">
              {(['sans', 'serif', 'mono'] as NoteFontFamily[]).map((font) => (
                <button
                  key={font}
                  type="button"
                  onClick={() => onUpdate({ font })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[12px] transition-colors ${
                    settings.font === font ? 'border-foreground bg-accent' : 'border-border hover:border-foreground/30'
                  }`}
                >
                  {font === 'sans' ? 'UI Sans' : font === 'serif' ? 'Serif' : 'Mono'}
                </button>
              ))}
            </div>
          </div>
          <SliderSetting label="Font Size" value={settings.fontSize} min={12} max={20} step={1} display={`${settings.fontSize}px`} onChange={(value) => onUpdate({ fontSize: value })} />
          <SliderSetting label="Line Height" value={settings.lineHeight} min={1.2} max={2.2} step={0.1} display={settings.lineHeight.toFixed(1)} onChange={(value) => onUpdate({ lineHeight: value })} />
          <SliderSetting
            label="Content Width"
            value={settings.contentWidth}
            min={0}
            max={100}
            step={5}
            display={settings.contentWidth < 30 ? 'Narrow' : settings.contentWidth > 70 ? 'Wide' : 'Medium'}
            onChange={(value) => onUpdate({ contentWidth: value })}
          />
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-muted-foreground">Focus Mode</label>
            <button
              type="button"
              onClick={() => onUpdate({ focusMode: !settings.focusMode })}
              className={`relative h-[22px] w-10 rounded-full transition-colors ${settings.focusMode ? 'bg-foreground' : 'bg-[var(--switch-background)]'}`}
            >
              <div className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${settings.focusMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeButton({ label, icon: Icon, active, onClick }: { label: string; icon: React.ElementType; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] transition-colors ${active ? 'border-foreground bg-accent' : 'border-border hover:border-foreground/30'}`}
    >
      <Icon size={15} />
      {label}
    </button>
  )
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
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[12px] font-medium text-muted-foreground">{label}</label>
        <span className="text-[11px] text-muted-foreground">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(parseFloat(event.target.value))} className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-accent accent-foreground" />
    </div>
  )
}
