import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { NoteAppearanceSettings, NoteFontFamily } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'

type Props = {
  open: boolean
  settings: NoteAppearanceSettings
  onClose: () => void
  onUpdate: (patch: Partial<NoteAppearanceSettings>) => void
}

const FONT_OPTIONS: Array<{ value: NoteFontFamily; labelKey: 'notes.appearancePanel.font.uiSans' | 'notes.appearancePanel.font.humanistSans' | 'notes.appearancePanel.font.cnSans' | 'notes.appearancePanel.font.serif' | 'notes.appearancePanel.font.cnSerif' | 'notes.appearancePanel.font.mono' }> = [
  { value: 'uiSans', labelKey: 'notes.appearancePanel.font.uiSans' },
  { value: 'humanistSans', labelKey: 'notes.appearancePanel.font.humanistSans' },
  { value: 'cnSans', labelKey: 'notes.appearancePanel.font.cnSans' },
  { value: 'serif', labelKey: 'notes.appearancePanel.font.serif' },
  { value: 'cnSerif', labelKey: 'notes.appearancePanel.font.cnSerif' },
  { value: 'mono', labelKey: 'notes.appearancePanel.font.mono' },
]

export default function AppearanceModal({ open, settings, onClose, onUpdate }: Props) {
  const { t } = useI18n()
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
        <h2 className="text-[16px] font-semibold">{t('notes.appearance')}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-accent">
          <X size={16} />
        </button>
      </div>
      <div className="note-page__panel-scroll space-y-5 px-4 pb-4">
        <div>
          <label className="mb-2 block text-[12px] font-medium text-muted-foreground">{t('notes.appearancePanel.font')}</label>
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
                {t(font.labelKey)}
              </button>
            ))}
          </div>
        </div>
        <SliderSetting label={t('notes.appearancePanel.fontSize')} value={settings.fontSize} min={12} max={20} step={1} display={`${settings.fontSize}px`} onChange={(value) => onUpdate({ fontSize: value })} />
        <SliderSetting label={t('notes.appearancePanel.lineHeight')} value={settings.lineHeight} min={1.2} max={2.2} step={0.1} display={settings.lineHeight.toFixed(1)} onChange={(value) => onUpdate({ lineHeight: value })} />
        <SliderSetting
          label={t('notes.appearancePanel.contentWidth')}
          value={settings.contentWidth}
          min={0}
          max={100}
          step={5}
          display={
            settings.contentWidth < 15
              ? t('notes.appearancePanel.width.full')
              : settings.contentWidth < 45
                ? t('notes.appearancePanel.width.wide')
                : settings.contentWidth < 75
                  ? t('notes.appearancePanel.width.medium')
                  : t('notes.appearancePanel.width.narrow')
          }
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
