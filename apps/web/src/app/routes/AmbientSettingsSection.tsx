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
import {
  resetAmbientPreferences,
  setAmbientPreferences,
  setSceneEffect,
  useAmbientPreferences,
  type AmbientFrameRate,
} from '../../features/focus/ambientPreferences'

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
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <p className="text-xs text-muted-foreground/80">{description}</p>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
)

const FRAME_RATE_OPTIONS: { value: AmbientFrameRate; label: string; hint: string }[] = [
  { value: 24, label: '24 FPS', hint: '电影感 · 最省电' },
  { value: 30, label: '30 FPS', hint: '默认 · 平衡' },
  { value: 60, label: '60 FPS', hint: '丝滑 · 耗电较高' },
]

const AmbientSettingsSection = () => {
  const prefs = useAmbientPreferences()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-base font-semibold text-foreground">背景氛围</h3>
          <p className="text-sm text-muted-foreground">
            控制动画场景的节奏、声画耦合，以及每个场景下的细节效果。
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetAmbientPreferences}
          className="text-xs"
        >
          <RotateCcw className="mr-1 h-3 w-3" /> 全部重置
        </Button>
      </div>

      <Group title="全局" description="跨所有场景生效">
        <Row
          icon={Gauge}
          title="背景帧率"
          description="动画刷新频率。低帧率更省电，高帧率更顺滑。"
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
                  <span className="ml-2 text-xs text-muted-foreground">{opt.hint}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row
          icon={Wind}
          title="声画耦合"
          description="让雨/风/海/火的音量驱动粒子密度、闪电频率与火光跳动。"
        >
          <Switch
            checked={prefs.audioReactivity}
            onCheckedChange={(checked) => setAmbientPreferences({ audioReactivity: checked })}
          />
        </Row>

        <Row
          icon={Sparkles}
          title="进出场缓动"
          description="切换场景时粒子由稀到密渐入，避免一秒变天的突兀感。"
        >
          <Switch
            checked={prefs.intensityRamp}
            onCheckedChange={(checked) => setAmbientPreferences({ intensityRamp: checked })}
          />
        </Row>

        <Row
          icon={Sparkles}
          title="鼠标互动"
          description="鼠标周围雨/雪粒子自动避让,火星和泡沫被鼠标牵引。"
        >
          <Switch
            checked={prefs.cursorReactivity}
            onCheckedChange={(checked) => setAmbientPreferences({ cursorReactivity: checked })}
          />
        </Row>

        <Row
          icon={Sparkles}
          title="每日随机化"
          description="每次打开应用,风向、闪电频率、火光节奏都会有细微变化。"
        >
          <Switch
            checked={prefs.sessionVariation}
            onCheckedChange={(checked) => setAmbientPreferences({ sessionVariation: checked })}
          />
        </Row>
      </Group>

      <Group title="🌧 雨天咖啡馆" description="">
        <Row
          icon={CloudRain}
          title="窗上凝水滴"
          description="大水珠顺着「玻璃」缓慢蜿蜒滑落,有重力感。"
        >
          <Switch
            checked={prefs.effects.rainyCafe.condensationDrops}
            onCheckedChange={(checked) => setSceneEffect('rainyCafe', { condensationDrops: checked })}
          />
        </Row>
        <Row
          icon={CloudRain}
          title="底部暖雾"
          description="屏幕底端一条暖色雾气,像杯口蒸汽糊住了视线下沿。"
        >
          <Switch
            checked={prefs.effects.rainyCafe.steamFog}
            onCheckedChange={(checked) => setSceneEffect('rainyCafe', { steamFog: checked })}
          />
        </Row>
        <Row
          icon={CloudRain}
          title="窗外人影"
          description="偶尔有半透明的剪影从窗外走过(每分钟一次以下)。"
        >
          <Switch
            checked={prefs.effects.rainyCafe.passerbySilhouettes}
            onCheckedChange={(checked) => setSceneEffect('rainyCafe', { passerbySilhouettes: checked })}
          />
        </Row>
      </Group>

      <Group title="⛈ 暴风雨之夜" description="">
        <Row
          icon={CloudLightning}
          title="闪电同步打亮雨滴"
          description="每次闪光的 100 毫秒里,雨滴瞬间变白变亮,真实暴雨的视觉签名。"
        >
          <Switch
            checked={prefs.effects.stormyNight.lightningFlashOnRain}
            onCheckedChange={(checked) => setSceneEffect('stormyNight', { lightningFlashOnRain: checked })}
          />
        </Row>
        <Row
          icon={CloudLightning}
          title="雷鸣震屏"
          description="闪光峰值后整个仪表盘会有一次微震,模拟雷声冲击。"
        >
          <Switch
            checked={prefs.effects.stormyNight.thunderShake}
            onCheckedChange={(checked) => setSceneEffect('stormyNight', { thunderShake: checked })}
          />
        </Row>
        <Row
          icon={CloudLightning}
          title="闪后紫光残影"
          description="闪光结束后留一层淡紫余韵,慢慢褪去。"
        >
          <Switch
            checked={prefs.effects.stormyNight.afterFlashPurple}
            onCheckedChange={(checked) => setSceneEffect('stormyNight', { afterFlashPurple: checked })}
          />
        </Row>
        <Row
          icon={CloudLightning}
          title="湿地反射"
          description="屏幕底部一道镜像模糊的雨痕,营造「地面湿了」的反射感(较耗性能)。"
        >
          <Switch
            checked={prefs.effects.stormyNight.wetGroundReflection}
            onCheckedChange={(checked) => setSceneEffect('stormyNight', { wetGroundReflection: checked })}
          />
        </Row>
      </Group>

      <Group title="🌊 海风" description="">
        <Row
          icon={Waves}
          title="三层视差波纹"
          description="远、中、近三层不同速度的波纹叠加,海面有了深度。"
        >
          <Switch
            checked={prefs.effects.oceanBreeze.parallaxLayers}
            onCheckedChange={(checked) => setSceneEffect('oceanBreeze', { parallaxLayers: checked })}
          />
        </Row>
        <Row
          icon={Waves}
          title="海面焦散"
          description="水面反射的浮动光斑,叠加在波纹上(略耗 GPU)。"
        >
          <Switch
            checked={prefs.effects.oceanBreeze.surfaceCaustics}
            onCheckedChange={(checked) => setSceneEffect('oceanBreeze', { surfaceCaustics: checked })}
          />
        </Row>
        <Row
          icon={Sun}
          title="日月光晕"
          description="根据本地时间出现的太阳/月亮高光,每小时移动一点。"
        >
          <Switch
            checked={prefs.effects.oceanBreeze.sunMoonHighlight}
            onCheckedChange={(checked) => setSceneEffect('oceanBreeze', { sunMoonHighlight: checked })}
          />
        </Row>
      </Group>

      <Group title="🔥 壁炉暖意" description="">
        <Row
          icon={Flame}
          title="全场暖色闪烁"
          description="整个仪表盘跟着火光呼吸,色温随机微偏暖——氛围灵魂。"
        >
          <Switch
            checked={prefs.effects.cozyFireside.globalWarmFlicker}
            onCheckedChange={(checked) => setSceneEffect('cozyFireside', { globalWarmFlicker: checked })}
          />
        </Row>
        <Row
          icon={Flame}
          title="炉膛木柴剪影"
          description="屏幕最底部一道深色木柴轮廓,锚定火焰来源。"
        >
          <Switch
            checked={prefs.effects.cozyFireside.logSilhouette}
            onCheckedChange={(checked) => setSceneEffect('cozyFireside', { logSilhouette: checked })}
          />
        </Row>
        <Row
          icon={Flame}
          title="烟丝"
          description="缓慢上升的几道模糊垂直烟带(较耗性能)。"
        >
          <Switch
            checked={prefs.effects.cozyFireside.smokeWisps}
            onCheckedChange={(checked) => setSceneEffect('cozyFireside', { smokeWisps: checked })}
          />
        </Row>
        <Row
          icon={Flame}
          title="木柴爆裂"
          description="火炉音量较高时,自动生成更密的火星迸发。"
        >
          <Switch
            checked={prefs.effects.cozyFireside.crackleSparkSync}
            onCheckedChange={(checked) => setSceneEffect('cozyFireside', { crackleSparkSync: checked })}
          />
        </Row>
      </Group>

      <Group title="✨ 默认 (无场景)" description="未选择白噪音时的环境氛围">
        <Row
          icon={Sun}
          title="昼夜调色"
          description="背景色根据本地时间在「晨黄 → 午象牙 → 暮琥珀 → 夜胡桃」间漂移。"
        >
          <Switch
            checked={prefs.effects.idle.timeOfDayPalette}
            onCheckedChange={(checked) => setSceneEffect('idle', { timeOfDayPalette: checked })}
          />
        </Row>
        <Row
          icon={Sparkles}
          title="极慢呼吸"
          description="整个背景以 14 秒为周期几乎察觉不到的亮度脉动。"
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
