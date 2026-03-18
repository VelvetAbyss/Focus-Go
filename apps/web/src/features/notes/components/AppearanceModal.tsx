import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { NoteAppearanceSettings, NoteFontFamily } from '../../../data/models/types'

type Props = {
  open: boolean
  settings: NoteAppearanceSettings
  onClose: () => void
  onUpdate: (patch: Partial<NoteAppearanceSettings>) => void
}

const FONT_OPTIONS: Array<{ value: NoteFontFamily; label: string }> = [
  { value: 'uiSans', label: 'UI Sans' },
  { value: 'humanistSans', label: 'Humanist Sans' },
  { value: 'cnSans', label: 'CN Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'cnSerif', label: 'CN Serif' },
  { value: 'mono', label: 'Mono' },
]

export default function AppearanceModal({ open, settings, onClose, onUpdate }: Props) {
  const [rendered, setRendered] = useState(open)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setRendered(true)
      setVisible(true)
      return
    }
    setVisible(false)
    const timer = window.setTimeout(() => setRendered(false), 180)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!rendered) return null

  return (
    <div data-note-floating-panel="appearance" data-state={visible ? 'open' : 'closed'} className="note-page__panel note-page__panel--wide">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h2 className="text-[16px] font-semibold">Appearance</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-accent">
          <X size={16} />
        </button>
      </div>
      <div className="note-page__panel-scroll space-y-5 px-4 pb-4">
        <div>
          <label className="mb-2 block text-[12px] font-medium text-muted-foreground">Font</label>
          <div className="grid grid-cols-3 gap-2">
            {FONT_OPTIONS.map((font) => (
              <button
                key={font.value}
                type="button"
                onClick={() => onUpdate({ font: font.value })}
                className={`rounded-lg border px-2 py-2 text-[11px] transition-colors ${
                  settings.font === font.value ? 'border-foreground bg-accent' : 'border-border hover:border-foreground/30'
                }`}
              >
                {font.label}
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
          display={settings.contentWidth < 15 ? 'Full' : settings.contentWidth < 45 ? 'Wide' : settings.contentWidth < 75 ? 'Medium' : 'Narrow'}
          onChange={(value) => onUpdate({ contentWidth: value })}
        />
      </div>
    </div>
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
