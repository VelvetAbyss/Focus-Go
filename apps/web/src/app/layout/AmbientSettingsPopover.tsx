import * as Popover from '@radix-ui/react-popover'
import { RotateCcw, Settings2 } from 'lucide-react'
import {
  AMBIENT_PREFERENCES_DEFAULTS,
  resetAmbientPreferences,
  setAmbientPreferences,
  useAmbientPreferences,
} from '../../features/focus/ambientPreferences'

/**
 * Small gear next to the scene dropdown. Opens a popover with two sliders:
 * dashboard surface opacity (how much scene shows through) and frosted-glass blur.
 * Live preview is automatic — sliders write to the store, which mirrors CSS vars
 * onto <html>.
 */
const AmbientSettingsPopover = () => {
  const prefs = useAmbientPreferences()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="sidebar-noise-mini__gear"
          aria-label="调节背景显示"
          title="调节背景显示"
        >
          <Settings2 size={13} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="ambient-prefs-popover"
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <header className="ambient-prefs-popover__header">
            <span>背景显示</span>
            <button
              type="button"
              className="ambient-prefs-popover__reset"
              onClick={resetAmbientPreferences}
              aria-label="恢复默认"
              title="恢复默认"
            >
              <RotateCcw size={12} aria-hidden="true" />
            </button>
          </header>

          <label className="ambient-prefs-popover__row">
            <span className="ambient-prefs-popover__label">面板不透明度</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(prefs.surfaceOpacity * 100)}
              onChange={(event) =>
                setAmbientPreferences({ surfaceOpacity: Number(event.target.value) / 100 })
              }
              aria-label="面板不透明度"
            />
            <span className="ambient-prefs-popover__value">
              {Math.round(prefs.surfaceOpacity * 100)}%
            </span>
          </label>

          <label className="ambient-prefs-popover__row">
            <span className="ambient-prefs-popover__label">毛玻璃强度</span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={Math.round(prefs.glassBlur)}
              onChange={(event) =>
                setAmbientPreferences({ glassBlur: Number(event.target.value) })
              }
              aria-label="毛玻璃强度"
            />
            <span className="ambient-prefs-popover__value">
              {Math.round(prefs.glassBlur)}px
            </span>
          </label>

          <footer className="ambient-prefs-popover__hint">
            默认 {Math.round(AMBIENT_PREFERENCES_DEFAULTS.surfaceOpacity * 100)}% ·{' '}
            {AMBIENT_PREFERENCES_DEFAULTS.glassBlur}px
          </footer>

          <Popover.Arrow className="ambient-prefs-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default AmbientSettingsPopover
