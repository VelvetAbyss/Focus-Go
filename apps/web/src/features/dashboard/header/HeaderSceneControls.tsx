import { useId } from 'react'
import { Image, LampDesk, Pause, Play, RotateCcw, TrainFront, Flower2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { HeaderScene } from './useHeaderScene'
import { TRAIN_DEFAULTS, TRAIN_RANGES, SPRING_DEFAULTS, SPRING_RANGES, type TrainSetting, type SpringNumericSetting, type HeaderScenePatch } from './sceneSettings'

export default function HeaderSceneControls({ scene, update, reduced }: {
  scene: HeaderScene; update: (patch: HeaderScenePatch) => void; reduced: boolean
}) {
  const { language } = useI18n()
  const zh = language === 'zh'
  const id = useId()
  const spring = scene.mode === 'spring'
  const active = spring ? scene.spring : scene
  // All numeric fields have explicit ranges; only the active scene's controls render.
  const values = spring ? { ...scene, ...scene.spring } : { ...scene.spring, ...scene }
  const ranges = spring ? { ...TRAIN_RANGES, ...SPRING_RANGES } : { ...SPRING_RANGES, ...TRAIN_RANGES }
  const updateActive = (patch: Partial<typeof TRAIN_DEFAULTS & Omit<typeof SPRING_DEFAULTS, 'palette'>>) => update(spring ? { spring: patch } : patch)
  const slider = (key: TrainSetting | SpringNumericSetting, label: string) => {
    const value = values[key]
    const direction = key === 'sceneX'
      ? (value < 0 ? (zh ? '左移' : 'Left') : (zh ? '右移' : 'Right'))
      : (value < 0 ? (zh ? '上移' : 'Up') : (zh ? '下移' : 'Down'))
    const formatted = key === 'speed' ? `${value.toFixed(2)}×`
      : key === 'sceneHeight' ? `${value}px`
      : key === 'height' ? (value === 80 ? (zh ? '原尺寸' : 'Original') : `${value}px`)
      : key === 'sceneX' || key === 'sceneY' ? (value === 0 ? (zh ? '原位' : 'Original') : `${direction} ${Math.abs(value)}%`)
      : key === 'railOffset' ? (value === 0 ? (zh ? '居中' : 'Centered') : `${value > 0 ? '+' : ''}${value}%`)
      : `${value}%`
    return <div className="dash-scene-slider" key={key}>
      <span><label htmlFor={`${id}-${key}`}>{label}</label>{key === 'width' || key === 'sceneHeight' ? <span className="dash-scene-dimension">
        <input key={value} type="number" defaultValue={value} {...ranges[key]} aria-label={`${zh ? '输入' : 'Enter '}${label}`} onBlur={event => {
          const next = event.currentTarget.valueAsNumber
          const bounded = Number.isFinite(next) ? Math.min(ranges[key].max, Math.max(ranges[key].min, next)) : value
          event.currentTarget.value = String(bounded)
          if (Number.isFinite(next)) updateActive({ [key]: bounded })
        }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = String(value); event.currentTarget.blur() } }} />
        <span aria-hidden="true">{key === 'width' ? '%' : 'px'}</span>
      </span> : <output htmlFor={`${id}-${key}`}>{formatted}</output>}</span>
      <input id={`${id}-${key}`} type="range" {...ranges[key]} value={value} aria-valuetext={formatted} onChange={event => updateActive({ [key]: Number(event.target.value) })} />
    </div>
  }
  const pauseLabel = reduced ? (zh ? '已减少动态效果' : 'Reduced motion is on')
    : active.paused ? (zh ? (spring ? '播放田野动画' : '播放列车动画') : (spring ? 'Play field animation' : 'Play train animation')) : (zh ? (spring ? '暂停田野动画' : '暂停列车动画') : (spring ? 'Pause field animation' : 'Pause train animation'))
  const palettes = [
    ['auto', zh ? '跟随主题' : 'Match theme'], ['sunset', zh ? '落日' : 'Sunset'],
    ['morning', zh ? '晨光' : 'Morning'], ['night', zh ? '夜航' : 'Night'],
  ] as const
  return (
    <>
      {scene.mode !== 'desk' && <button type="button" className="dash-toolbar__action dash-scene-pause" aria-label={pauseLabel} title={pauseLabel} aria-pressed={active.paused || reduced} disabled={reduced} onClick={() => updateActive({ paused: !active.paused })}>
        {active.paused || reduced ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
      </button>}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="dash-toolbar__action dash-scene-picker" aria-label={zh ? '选择顶栏场景' : 'Choose header scene'} title={zh ? '选择顶栏场景' : 'Choose header scene'}>
            <Image size={14} aria-hidden="true" /><span>{zh ? '风景' : 'Scenery'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="dash-scene-popover" align="end" sideOffset={8} collisionPadding={12}>
          <div className="dash-scene-popover__label">{zh ? '顶栏风景' : 'Header scenery'}</div>
          <div className="dash-scene-options" role="group" aria-label={zh ? '顶栏风景' : 'Header scenery'}>
            <button type="button" aria-pressed={scene.mode === 'cloudtrain'} onClick={() => update({ mode: 'cloudtrain' })}><TrainFront size={18} aria-hidden="true" /><span>{zh ? '云间列车' : 'Cloudbound'}</span></button>
            <button type="button" aria-pressed={spring} onClick={() => update({ mode: 'spring' })}><Flower2 size={18} aria-hidden="true" /><span>{zh ? '春日田野' : 'Spring fields'}</span></button>
            <button type="button" aria-pressed={scene.mode === 'desk'} onClick={() => update({ mode: 'desk' })}><LampDesk size={18} aria-hidden="true" /><span>{zh ? '桌面摆件' : 'Desk objects'}</span></button>
          </div>
          {scene.mode !== 'desk' && <>
            {!spring && <><div className="dash-scene-popover__label">{zh ? '沿途光景' : 'Along the way'}</div>
            <div className="dash-scene-palettes" role="group" aria-label={zh ? '列车配色' : 'Train palette'}>
              {palettes.map(([value, label]) => <button key={value} type="button" aria-pressed={scene.palette === value} onClick={() => update({ palette: value })}><span className="dash-scene-swatch" data-palette={value} aria-hidden="true" />{label}</button>)}
            </div>
            </>}
            {spring && <><div className="dash-scene-popover__label">{zh ? '田野光景' : 'Field light'}</div>
              <div className="dash-scene-palettes" role="group" aria-label={zh ? '田野配色' : 'Field palette'}>
                {([['auto', zh ? '跟随主题' : 'Match theme'], ['day', zh ? '春日' : 'Daylight'], ['dusk', zh ? '晚霞' : 'Dusk'], ['night', zh ? '月色' : 'Moonlight']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={scene.spring.palette === value} onClick={() => update({ spring: { palette: value } })}><span className="dash-scene-swatch" data-palette={`spring-${value}`} aria-hidden="true" />{label}</button>)}
              </div>
            </>}
            <details className="dash-scene-section" open>
              <summary>{zh ? '尺寸与位置' : 'Size & placement'}</summary>
              <div className="dash-scene-anchor" role="group" aria-label={zh ? '动画对齐方式' : 'Scenery alignment'}>
                <button type="button" aria-pressed={active.sceneAnchor === 'bottom' && active.sceneY === 0} onClick={() => updateActive({ sceneAnchor: 'bottom', sceneY: 0 })}>{zh ? '贴紧顶栏底部' : 'Pin to header bottom'}</button>
                <button type="button" aria-pressed={active.sceneAnchor === 'top' && active.sceneY === 0} onClick={() => updateActive({ sceneAnchor: 'top', sceneY: 0 })}>{zh ? '靠顶部' : 'Align to top'}</button>
              </div>
              {slider('width', zh ? '动画宽度' : 'Scenery width')}
              {slider('sceneHeight', zh ? '动画高度' : 'Scenery height')}
              {slider('sceneX', zh ? '动画左右位置' : 'Scenery horizontal position')}
              {slider('sceneY', zh ? '动画上下位置' : 'Scenery vertical position')}
              <div className="dash-scene-position-reset"><button type="button" onClick={() => updateActive({ sceneX: 0, sceneY: 0, sceneAnchor: 'bottom' })}>{zh ? '动画位置归位' : 'Reset scenery position'}</button></div>
              <p className="dash-scene-hint">{zh ? '贴底时调整高度会向上展开。宽高可直接输入，放大时顶栏自动留出空间。' : 'Pinned scenery grows upward. Enter a width or height; the header makes room as needed.'}</p>
              {spring ? slider('zoom', zh ? '景物大小' : 'Landscape scale') : <>{slider('trainScale', zh ? '列车大小' : 'Train size')}{slider('railOffset', zh ? '列车上下位置' : 'Train vertical position')}</>}
              {slider('opacity', zh ? '风景浓度' : 'Scenery opacity')}
              {slider('height', zh ? '顶栏高度' : 'Header height')}
              <p className="dash-scene-hint">{zh ? '默认沿用原顶栏尺寸，窄屏会自动留出文字空间。' : 'Original header size by default. Small screens keep room for text.'}</p>
            </details>
            <details className="dash-scene-section">
              <summary>{zh ? (spring ? '田野与动画' : '云海与动画') : (spring ? 'Fields & motion' : 'Clouds & motion')}</summary>
              {slider('speed', zh ? '行进速度' : 'Travel speed')}
              {spring ? <>{slider('clouds', zh ? '云影浓度' : 'Cloud density')}{slider('texture', zh ? '纸面颗粒' : 'Paper grain')}<label className="dash-scene-toggle"><span>{zh ? '小飞机' : 'Airplane'}</span><input type="checkbox" role="switch" checked={scene.spring.plane} onChange={event => update({ spring: { plane: event.target.checked } })} /></label></> : <>
              {slider('billow', zh ? '云海起伏' : 'Cloud billow')}
              {slider('detail', zh ? '云层细节' : 'Cloud detail')}
              {slider('cloudLevel', zh ? '下方云海高度' : 'Cloud sea level')}
              {slider('steam', zh ? '蒸汽浓度' : 'Steam density')}</>}
              {reduced && <p className="dash-scene-hint">{zh ? '已跟随设备设置暂停动态效果，外观仍可调整。' : 'Device motion settings pause animation. Appearance can still be adjusted.'}</p>}
            </details>
            <div className="dash-scene-footer">
              <span>{zh ? '各场景分别保存在此设备' : 'Saved separately for each scene'}</span>
              <button type="button" onClick={() => update(spring ? { spring: { ...SPRING_DEFAULTS } } : { ...TRAIN_DEFAULTS, palette: 'auto', sceneAnchor: 'bottom', paused: false })}><RotateCcw size={12} aria-hidden="true" />{zh ? '恢复默认' : 'Reset defaults'}</button>
            </div>
          </>}
        </PopoverContent>
      </Popover>
    </>
  )
}
