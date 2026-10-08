import { useEffect, useRef, type CSSProperties } from 'react'
import type { SceneId } from './ambient/scenes/types'
import { useAmbientPreferences } from '../../features/focus/ambientPreferences'
import { useSharedNoise } from '../../features/focus/SharedNoiseProvider'
import './ambient/ambient-motion.css'

const SESSION_VARIATION = Math.random()
const PARTICLES = Array.from({ length: 14 }, (_, i) => i)

/** Static colour fields + bounded CSS layers. No canvas, WebGL import,
 * animation loop or per-frame React state. Theme colours live on html; only
 * decorative motion lives here, behind the reading surfaces. */
const AmbientSceneStage = ({ scene }: { scene: SceneId }) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const prefs = useAmbientPreferences()
  const { noise } = useSharedNoise()
  const idle = scene === 'idle' || scene === 'window-light'
  const rain = scene === 'rainy-cafe' || scene === 'stormy-night'
  const cafe = scene === 'rainy-cafe'
  const storm = scene === 'stormy-night'
  const ocean = scene === 'ocean-breeze'
  const fire = scene === 'cozy-fireside'
  const seed = prefs.sessionVariation ? SESSION_VARIATION : 0.5
  const loudness = (id: keyof typeof noise.tracks) => prefs.audioReactivity && noise.tracks[id].enabled
    ? noise.tracks[id].volume * (noise.masterVolume ?? 0) : 0
  const rainDuration = (storm ? 1.1 : 2.4) - loudness('rain') * 0.45
  const thunderDuration = 18 - loudness('thunder') * 7
  const style = {
    '--rain-duration': `${rainDuration}s`,
    '--rain-steps': Math.round(rainDuration * prefs.frameRate),
    '--rain-alpha': (storm ? 0.28 : 0.18) + loudness('rain') * 0.1,
    '--thunder-duration': `${thunderDuration}s`,
    '--wave-duration': `${16 - loudness('ocean') * 4}s`,
    '--wave-steps': Math.round((16 - loudness('ocean') * 4) * prefs.frameRate),
    '--fire-duration': `${4 - loudness('fireplace')}s`,
    '--fire-steps': Math.round((4 - loudness('fireplace')) * prefs.frameRate),
    '--rainy-cafe-steam-on': Number(prefs.effects.rainyCafe.steamFog),
    '--cozy-fireside-log-on': Number(prefs.effects.cozyFireside.logSilhouette),
    '--ocean-breeze-caustics-on': Number(prefs.effects.oceanBreeze.surfaceCaustics),
    '--scene-enter-duration': prefs.intensityRamp ? '1800ms' : '0ms',
  } as CSSProperties

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection
    let inViewport = true
    let clockTimer = 0
    const update = () => {
      const still = !prefs.motionEnabled || media.matches || document.documentElement.dataset.motion === 'reduce' || Boolean(connection?.saveData)
      const paused = document.hidden || !inViewport
      root.dataset.motion = still ? 'still' : 'running'
      root.dataset.paused = String(paused)
      window.clearTimeout(clockTimer)
      // Opt-in daylight changes at coarse wall-clock intervals. All ordinary
      // scenes have zero JS timers, including when they are animating.
      if (idle && prefs.effects.idle.timeOfDayPalette) {
        const hour = new Date().getHours()
        root.dataset.daylight = hour >= 6 && hour < 18 ? 'day' : 'evening'
        if (!paused) clockTimer = window.setTimeout(update, 300_000)
      } else delete root.dataset.daylight
    }
    update()
    media.addEventListener('change', update)
    connection?.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    const motionObserver = new MutationObserver(update)
    motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
    const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      inViewport = !entry || entry.isIntersecting
      update()
    })
    intersection?.observe(root)
    return () => {
      window.clearTimeout(clockTimer)
      media.removeEventListener('change', update)
      connection?.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
      motionObserver.disconnect()
      intersection?.disconnect()
    }
  }, [idle, prefs.effects.idle.timeOfDayPalette, prefs.motionEnabled])

  useEffect(() => {
    const root = rootRef.current
    const shell = root?.parentElement
    if (!root || !shell || !prefs.cursorReactivity) return
    const onMove = (event: PointerEvent) => {
      if (root.dataset.motion === 'still' || root.dataset.paused === 'true') return
      // No synchronous layout read in the pointer path; this backdrop fills
      // the shell viewport. Pointer events do not start an animation loop.
      root.style.setProperty('--ambient-pointer-x', `${((event.clientX / window.innerWidth - 0.5) * 4).toFixed(1)}px`)
    }
    const leave = () => root.style.removeProperty('--ambient-pointer-x')
    shell.addEventListener('pointermove', onMove, { passive: true })
    shell.addEventListener('pointerleave', leave)
    return () => { shell.removeEventListener('pointermove', onMove); shell.removeEventListener('pointerleave', leave); leave() }
  }, [prefs.cursorReactivity])

  const particleStyle = (index: number) => ({
    '--particle-x': `${((index * 37 + seed * 29) % 100).toFixed(1)}%`,
    '--particle-delay': `${-index * 0.63 - seed * 3}s`,
    '--particle-drift': `${(index % 2 ? 1 : -1) * (6 + index * 2)}px`,
  } as CSSProperties)

  return (
    <div ref={rootRef} className="focus-shell__scene-backdrop is-current" data-scene={scene} data-renderer="css" aria-hidden="true" style={style}>
      <div key={scene} className="ambient-environment__detail">
        {rain && <div className={`ambient-rain ${storm && prefs.effects.stormyNight.thunderShake ? 'ambient-rain--thunder' : ''}`}>
          <i className="ambient-rain__near" /><i className="ambient-rain__far" />
        </div>}
        {cafe && prefs.effects.rainyCafe.condensationDrops && <div className="ambient-condensation">
          {PARTICLES.slice(0, 6).map(i => <i key={i} style={particleStyle(i)} />)}
        </div>}
        {cafe && prefs.effects.rainyCafe.passerbySilhouettes && <i className="ambient-passerby" />}
        {storm && prefs.effects.stormyNight.lightningFlashOnRain && <i className="ambient-lightning" />}
        {storm && prefs.effects.stormyNight.afterFlashPurple && <i className="ambient-lightning ambient-lightning--after" />}
        {storm && prefs.effects.stormyNight.wetGroundReflection && <i className="ambient-rain-reflection" />}
        {ocean && <div className={`ambient-waves ${prefs.effects.oceanBreeze.parallaxLayers ? 'ambient-waves--layered' : ''}`}>
          <i /><i /><i />
        </div>}
        {ocean && prefs.effects.oceanBreeze.sunMoonHighlight && <i className="ambient-sea-light" />}
        {fire && <div className="ambient-embers">
          {PARTICLES.slice(0, prefs.effects.cozyFireside.crackleSparkSync ? 14 : 8).map(i => <i key={i} style={particleStyle(i)} />)}
        </div>}
        {fire && prefs.effects.cozyFireside.globalWarmFlicker && <i className="ambient-firelight" />}
        {fire && prefs.effects.cozyFireside.smokeWisps && <i className="ambient-smoke" />}
        {idle && prefs.effects.idle.slowBreath && <i className="ambient-daylight-breath" />}
      </div>
      <div className="focus-shell__scene-vignette" />
    </div>
  )
}

export default AmbientSceneStage
