import { useSyncExternalStore } from 'react'
import { Volume2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useI18n } from '../../shared/i18n/useI18n'
import {
  getSoundPreferences, setSoundPreferences, SOUND_DEFAULTS, subscribeSoundPreferences,
  type SoundTheme,
} from '../../shared/sound/soundPreferences'
import { playInteractionSound, type InteractionSound } from '../../shared/sound/interactionSounds'

const themes: SoundTheme[] = ['wood', 'grain', 'soft']
const cues = ['tap', 'on', 'off', 'create', 'place', 'complete', 'undo', 'remove', 'start', 'pause', 'resume', 'reset', 'finish'] as const satisfies readonly InteractionSound[]
const serverSnapshot = () => SOUND_DEFAULTS

export default function InteractionSoundSettings() {
  const { t } = useI18n()
  const prefs = useSyncExternalStore(subscribeSoundPreferences, getSoundPreferences, serverSnapshot)
  const audible = prefs.enabled && prefs.volume > 0
  return (
    <section className="space-y-5 rounded-xl border border-border/70 bg-background/60 p-4 sm:p-5" aria-labelledby="interaction-sound-heading">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 id="interaction-sound-heading" className="flex items-center gap-2 text-sm font-semibold">
            <Volume2 className="h-4 w-4" aria-hidden="true" />{t('settings.sound.title')}
          </h3>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{t('settings.sound.description')}</p>
        </div>
        <Switch sound={false} aria-label={t('settings.sound.title')} checked={prefs.enabled} onCheckedChange={(enabled) => {
          setSoundPreferences({ enabled })
          if (enabled) playInteractionSound('on')
        }} />
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">{t('settings.sound.theme')}</legend>
        {themes.map((theme) => (
          <label key={theme} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${prefs.theme === theme ? 'border-primary/60 bg-muted/70' : 'border-border/60 hover:bg-muted/40'}`}>
            <input type="radio" name="interaction-sound-theme" value={theme} checked={prefs.theme === theme}
              className="mt-1 !h-4 !w-4 shrink-0 accent-[hsl(var(--primary))]" onChange={() => {
                setSoundPreferences({ theme })
                playInteractionSound('place')
              }} />
            <span className="space-y-1">
              <span className="block text-sm font-medium">{t(`settings.sound.${theme}`)}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">{t(`settings.sound.${theme}.hint`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <label htmlFor="interaction-sound-volume" className="shrink-0 text-sm">{t('settings.sound.volume')}</label>
        <input id="interaction-sound-volume" type="range" min="0" max="100" step="1" value={Math.round(prefs.volume * 100)}
          disabled={!prefs.enabled} className="h-5 min-w-0 flex-1 accent-[hsl(var(--primary))] disabled:opacity-40"
          onChange={(event) => setSoundPreferences({ volume: Number(event.target.value) / 100 })}
          onPointerUp={() => playInteractionSound('tap')}
          onKeyUp={(event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) playInteractionSound('tap') }} />
        <output htmlFor="interaction-sound-volume" className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(prefs.volume * 100)}%</output>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{t(audible ? 'settings.sound.preview' : 'settings.sound.muted')}</p>
        <div className="flex flex-wrap gap-2">
          {cues.map((cue) => (
            <Button key={cue} type="button" size="sm" variant="outline" disabled={!audible}
              onClick={() => playInteractionSound(cue)} className="text-xs">{t(`settings.sound.cue.${cue}`)}</Button>
          ))}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.sound.deviceHint')}</p>
    </section>
  )
}
