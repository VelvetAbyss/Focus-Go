import { useEffect, useState, type ReactNode } from 'react'
import BrandLoader from '../shared/ui/loading/BrandLoader'
import { usePreferences } from '../shared/prefs/usePreferences'
import { loadLanguage } from '../shared/i18n/translator'
import { syncedPreferencesRepo } from '../data/repositories/syncedPreferencesRepo'
import { applyTheme, resolveInitialTheme } from '../shared/theme/theme'
import type { LanguageCode } from '../shared/i18n/types'
import { installMotionVisibilityController } from '../shared/utils/motionVisibility'

// Install once at module evaluation time — runs before first render.
// Pauses all CSS animations when the tab is hidden (saves CPU/GPU/battery).
installMotionVisibilityController()

// Minimum on-screen time so the loader registers as a deliberate moment
// rather than a flash. Matches entry+label choreography (~320ms).
const MIN_VISIBLE_MS = 360
// Safety net: if any single step hangs we must still render the app.
const MAX_GATE_MS = 4000
// Exit animation duration from BrandLoader.css
const EXIT_MS = 320

let bootPromise: Promise<void> | null = null

const runBoot = (language: LanguageCode): Promise<void> => {
  if (bootPromise) return bootPromise
  const started = performance.now()

  const deadline = new Promise<void>((resolve) => setTimeout(resolve, MAX_GATE_MS))

  const work = Promise.allSettled([
    loadLanguage(language),
    syncedPreferencesRepo.hydrateLocalFromDb().then(() => applyTheme(resolveInitialTheme())),
  ])

  bootPromise = Promise.race([work.then(() => undefined), deadline]).then(() => {
    const elapsed = performance.now() - started
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
    if (remaining === 0) return
    return new Promise<void>((resolve) => setTimeout(resolve, remaining))
  })

  return bootPromise
}

const AppBootGate = ({ children }: { children: ReactNode }) => {
  const { language } = usePreferences()
  const [ready, setReady] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let cancelled = false
    runBoot(language).then(() => {
      if (cancelled) return
      setExiting(true)
      setTimeout(() => {
        if (cancelled) return
        setReady(true)
      }, EXIT_MS)
    })
    return () => {
      cancelled = true
    }
    // Boot runs once per mount; language/auth changes after boot are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After initial boot, lazily fetch any newly-selected language.
  // `t()` keeps returning the previously loaded messages until this resolves —
  // a couple hundred ms of stale-but-correct output, no flash.
  useEffect(() => {
    if (!ready) return
    void loadLanguage(language)
  }, [language, ready])

  if (!ready) {
    return <BrandLoader variant="fullscreen" state={exiting ? 'exit' : 'entry'} />
  }
  return <>{children}</>
}

export default AppBootGate
