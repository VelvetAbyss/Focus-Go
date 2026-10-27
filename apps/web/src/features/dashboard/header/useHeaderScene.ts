import { useEffect, useState } from 'react'
import { DEFAULT_HEADER_SCENE, normalizeHeaderScene, type HeaderScene, type HeaderScenePatch } from './sceneSettings'

export type { HeaderScene } from './sceneSettings'
export const HEADER_SCENE_KEY = 'focusgo.dashboard.headerScene'

export function readHeaderScene(): HeaderScene {
  try {
    return normalizeHeaderScene(JSON.parse(localStorage.getItem(HEADER_SCENE_KEY) ?? 'null'))
  } catch { return { ...DEFAULT_HEADER_SCENE } }
}

/** Like desk props, this is a device-local visual preference, not workspace data. */
export function useHeaderScene() {
  const [scene, setScene] = useState(readHeaderScene)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === HEADER_SCENE_KEY || event.key === null) setScene(readHeaderScene()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const update = (patch: HeaderScenePatch) => {
    setScene(current => {
      const next = normalizeHeaderScene({ ...current, ...patch, spring: { ...current.spring, ...patch.spring } })
      try { localStorage.setItem(HEADER_SCENE_KEY, JSON.stringify(next)) } catch { /* Keep the usable in-memory choice. */ }
      return next
    })
  }
  return [scene, update] as const
}

type Connection = EventTarget & { saveData?: boolean }
export function useSceneReducedMotion() {
  const read = () => document.documentElement.dataset.motion === 'reduce'
    || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    || Boolean((navigator as Navigator & { connection?: Connection }).connection?.saveData)
  const [reduced, setReduced] = useState(read)
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: Connection }).connection
    const sync = () => setReduced(read())
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
    media?.addEventListener('change', sync); connection?.addEventListener('change', sync)
    return () => { observer.disconnect(); media?.removeEventListener('change', sync); connection?.removeEventListener('change', sync) }
  }, [])
  return reduced
}
