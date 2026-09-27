import { motion } from 'motion/react'
import {
  CloudRain,
  CloudLightning,
  Waves,
  Flame,
  Sun,
  Sparkles,
  Gauge,
  Wind,
  RotateCcw,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useI18n } from '../../shared/i18n/useI18n'
import type { TranslationKey } from '../../shared/i18n/types'
import {
  resetAmbientPreferences,
  setAmbientPreferences,
  setSceneEffect,
  useAmbientPreferences,
  type AmbientFrameRate,
} from '../../features/focus/ambientPreferences'
import { DURATION, EASE } from '../../shared/motion/tokens'

type RowProps = {
  icon: typeof Gauge
  title: string
  description: string
  children: React.ReactNode
}

const Row = ({ icon: Icon, title, description, children }: RowProps) => (
  <motion.div
    layout
    className="grid gap-4 rounded-xl bg-background/40 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: DURATION.slow, ease: EASE.emphasized }}
    whileHover={{ y: -2 }}
  >
    <div className="flex gap-3">
      <div className="mt-0.5 rounded-md border border-border/80 bg-muted/60 p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="w-full lg:w-auto lg:justify-self-end">{children}</div>
  </motion.div>
)

type GroupProps = {
  title: string
  description: string
  children: React.ReactNode
}

const Group = ({ title, description, children }: GroupProps) => (
  <div className="space-y-2">
    <div className="px-1">
      <h4 className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)]r text-muted-foreground">{title}</h4>
      <p className="text-xs text-muted-foreground/80">{description}</p>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
)

const FRAME_RATE_OPTIONS: { value: AmbientFrameRate; label: string; hintKey: TranslationKey }[] = [
  { value: 24, label: '24 FPS', hintKey: 'settings.ambient.fps.24.hint' },
  { value: 30, label: '30 FPS', hintKey: 'settings.ambient.fps.30.hint' },
  { value: 60, label: '60 FPS', hintKey: 'settings.ambient.fps.60.hint' },
]

const AmbientSettingsSection = () => {
  const { t } = useI18n()
  const prefs = useAmbientPreferences()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('settings.ambient.heading')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('settings.ambient.intro')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetAmbientPreferences}
          className="text-xs"
        >
          <RotateCcw className="mr-1 h-3 w-3" /> {t('settings.ambient.resetAll')}
        </Button>
      </div>

      <Group title={t('settings.ambient.group.global')} description={t('settings.ambient.group.globalDesc')}>
        <Row
          icon={Gauge}
          title={t('settings.ambient.fps.title')}
          description={t('settings.ambient.fps.desc')}
        >
          <Select
            value={String(prefs.frameRate)}
            onValueChange={(value) =>
              setAmbientPreferences({ frameRate: Number(value) as AmbientFrameRate })
            }
          >
            <SelectTrigger className="w-full sm:max-w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRAME_RATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  <span className="font-medium">{opt.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t(opt.hintKey)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row
          icon={Wind}
          title={t('settings.ambient.audioCoupling.title')}
          description={t('settings.ambient.audioCoupling.desc')}
        >
          <Switch
            checked={prefs.audioReactivity}
            onCheckedChange={(checked) => setAmbientPreferences({ audioReactivity: checked })}
          />
        </Row>

        <Row
          icon={Sparkles}
          title={t('settings.ambient.easing.title')}
          description={t('settings.ambient.easing.desc')}
        >
          <Switch
            checked={prefs.intensityRamp}
            onCheckedChange={(checked) => setAmbientPreferences({ intensityRamp: checked })}
          />
        </Row>

        <Row
          icon={Sparkles}
          title={t('settings.ambient.pointer.title')}
          description={t('settings.ambient.pointer.desc')}
        >
          <Switch
            checked={prefs.cursorReactivity}
            onCheckedChange={(checked) => setAmbientPreferences({ cursorReactivity: checked })}
          />
        </Row>

        <Row
          icon={Sparkles}
          title={t('settings.ambient.daily.title')}
          description={t('settings.ambient.daily.desc')}
        >
          <Switch
            checked={prefs.sessionVariation}
            onCheckedChange={(checked) => setAmbientPreferences({ sessionVariation: checked })}
          />
        </Row>
      </Group>

      <Group title={t('settings.ambient.group.rainCafe')} description="">
        <Row
          icon={CloudRain}
          title={t('settings.ambient.condensation.title')}
          description={t('settings.ambient.condensation.desc')}
        >
          <Switch
            checked={prefs.effects.rainyCafe.condensationDrops}
            onCheckedChange={(checked) => setSceneEffect('rainyCafe', { condensationDrops: checked })}
          />
        </Row>
        <Row
          icon={CloudRain}
          title={t('settings.ambient.warmHaze.title')}
          description={t('settings.ambient.warmHaze.desc')}
        >
          <Switch
            checked={prefs.effects.rainyCafe.steamFog}
            onCheckedChange={(checked) => setSceneEffect('rainyCafe', { steamFog: checked })}
          />
        </Row>
        <Row
          icon={CloudRain}
          title={t('settings.ambient.passersby.title')}
          description={t('settings.ambient.passersby.desc')}
        >
          <Switch
            checked={prefs.effects.rainyCafe.passerbySilhouettes}
            onCheckedChange={(checked) => setSceneEffect('rainyCafe', { passerbySilhouettes: checked })}
          />
        </Row>
      </Group>

      <Group title={t('settings.ambient.group.storm')} description="">
        <Row
          icon={CloudLightning}
          title={t('settings.ambient.lightningRain.title')}
          description={t('settings.ambient.lightningRain.desc')}
        >
          <Switch
            checked={prefs.effects.stormyNight.lightningFlashOnRain}
            onCheckedChange={(checked) => setSceneEffect('stormyNight', { lightningFlashOnRain: checked })}
          />
        </Row>
        <Row
          icon={CloudLightning}
          title={t('settings.ambient.thunderShake.title')}
          description={t('settings.ambient.thunderShake.desc')}
        >
          <Switch
            checked={prefs.effects.stormyNight.thunderShake}
            onCheckedChange={(checked) => setSceneEffect('stormyNight', { thunderShake: checked })}
          />
        </Row>
        <Row
          icon={CloudLightning}
          title={t('settings.ambient.afterglow.title')}
          description={t('settings.ambient.afterglow.desc')}
        >
          <Switch
            checked={prefs.effects.stormyNight.afterFlashPurple}
            onCheckedChange={(checked) => setSceneEffect('stormyNight', { afterFlashPurple: checked })}
          />
        </Row>
        <Row
          icon={CloudLightning}
          title={t('settings.ambient.wetReflection.title')}
          description={t('settings.ambient.wetReflection.desc')}
        >
          <Switch
            checked={prefs.effects.stormyNight.wetGroundReflection}
            onCheckedChange={(checked) => setSceneEffect('stormyNight', { wetGroundReflection: checked })}
          />
        </Row>
      </Group>

      <Group title={t('settings.ambient.group.seaBreeze')} description="">
        <Row
          icon={Waves}
          title={t('settings.ambient.parallax.title')}
          description={t('settings.ambient.parallax.desc')}
        >
          <Switch
            checked={prefs.effects.oceanBreeze.parallaxLayers}
            onCheckedChange={(checked) => setSceneEffect('oceanBreeze', { parallaxLayers: checked })}
          />
        </Row>
        <Row
          icon={Waves}
          title={t('settings.ambient.caustics.title')}
          description={t('settings.ambient.caustics.desc')}
        >
          <Switch
            checked={prefs.effects.oceanBreeze.surfaceCaustics}
            onCheckedChange={(checked) => setSceneEffect('oceanBreeze', { surfaceCaustics: checked })}
          />
        </Row>
        <Row
          icon={Sun}
          title={t('settings.ambient.halo.title')}
          description={t('settings.ambient.halo.desc')}
        >
          <Switch
            checked={prefs.effects.oceanBreeze.sunMoonHighlight}
            onCheckedChange={(checked) => setSceneEffect('oceanBreeze', { sunMoonHighlight: checked })}
          />
        </Row>
      </Group>

      <Group title={t('settings.ambient.group.fireplace')} description="">
        <Row
          icon={Flame}
          title={t('settings.ambient.warmFlicker.title')}
          description={t('settings.ambient.warmFlicker.desc')}
        >
          <Switch
            checked={prefs.effects.cozyFireside.globalWarmFlicker}
            onCheckedChange={(checked) => setSceneEffect('cozyFireside', { globalWarmFlicker: checked })}
          />
        </Row>
        <Row
          icon={Flame}
          title={t('settings.ambient.logs.title')}
          description={t('settings.ambient.logs.desc')}
        >
          <Switch
            checked={prefs.effects.cozyFireside.logSilhouette}
            onCheckedChange={(checked) => setSceneEffect('cozyFireside', { logSilhouette: checked })}
          />
        </Row>
        <Row
          icon={Flame}
          title={t('settings.ambient.smoke.title')}
          description={t('settings.ambient.smoke.desc')}
        >
          <Switch
            checked={prefs.effects.cozyFireside.smokeWisps}
            onCheckedChange={(checked) => setSceneEffect('cozyFireside', { smokeWisps: checked })}
          />
        </Row>
        <Row
          icon={Flame}
          title={t('settings.ambient.crackle.title')}
          description={t('settings.ambient.crackle.desc')}
        >
          <Switch
            checked={prefs.effects.cozyFireside.crackleSparkSync}
            onCheckedChange={(checked) => setSceneEffect('cozyFireside', { crackleSparkSync: checked })}
          />
        </Row>
      </Group>

      <Group title={t('settings.ambient.group.default')} description={t('settings.ambient.group.defaultDesc')}>
        <Row
          icon={Sun}
          title={t('settings.ambient.dayNight.title')}
          description={t('settings.ambient.dayNight.desc')}
        >
          <Switch
            checked={prefs.effects.idle.timeOfDayPalette}
            onCheckedChange={(checked) => setSceneEffect('idle', { timeOfDayPalette: checked })}
          />
        </Row>
        <Row
          icon={Sparkles}
          title={t('settings.ambient.breathe.title')}
          description={t('settings.ambient.breathe.desc')}
        >
          <Switch
            checked={prefs.effects.idle.slowBreath}
            onCheckedChange={(checked) => setSceneEffect('idle', { slowBreath: checked })}
          />
        </Row>
      </Group>
    </div>
  )
}

export default AmbientSettingsSection
