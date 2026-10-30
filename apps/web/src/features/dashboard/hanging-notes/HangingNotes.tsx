import { useEffect, useRef, useSyncExternalStore } from 'react'
import { liveQuery } from 'dexie'
import { getAuth, subscribeAuth } from '../../../store/auth'
import { syncedPreferencesRepo } from '../../../data/repositories/syncedPreferencesRepo'
import { createHangingNotes } from './controller'
import { useI18n } from '../../../shared/i18n/useI18n'
import { onPrepareAppUpdate } from '../../../shared/runtime/updateLifecycle'
import { normalizeHangingNotes } from './model'
import './hanging-notes.css'

const account = () => String(getAuth()?.user?.id ?? 'local')

export default function HangingNotes() {
  const { language } = useI18n()
  const zh = language === 'zh'
  const root = useRef<HTMLDivElement>(null)
  const owner = useSyncExternalStore(subscribeAuth, account, () => 'local')
  useEffect(() => {
    const element = root.current
    if (!element) return
    let disposed = false, pendingSaves = 0, saveRevision = 0
    let engine: ReturnType<typeof createHangingNotes> | undefined
    let queue = Promise.resolve<unknown>(undefined)
    const stopPreparing = onPrepareAppUpdate(() => queue)
    const subscription = liveQuery(() => syncedPreferencesRepo.get()).subscribe({
      next: preferences => {
        if (disposed) return
        const notes = normalizeHangingNotes(preferences?.hangingNotes)
        if (engine) { if (!pendingSaves) engine.update(notes); return }
        engine = createHangingNotes(element, notes, (next, before) => {
          pendingSaves++
          const revision = ++saveRevision
          const save = queue.catch(() => undefined).then(() => syncedPreferencesRepo.saveHangingNotes(next, before(), () => account() === owner))
          queue = save
          void save.then(() => {
            pendingSaves--
            if (!disposed && !pendingSaves) {
              void syncedPreferencesRepo.get().then(value => { if (!disposed && !pendingSaves && revision === saveRevision) engine?.update(normalizeHangingNotes(value?.hangingNotes)) }).catch(() => undefined)
            }
          }, () => { pendingSaves-- })
          return save
        }, zh)
      },
      error: () => { if (!disposed) { engine?.destroy(); engine = undefined; element.textContent = zh ? '便签暂时无法读取，请重新打开仪表盘。' : 'Notes could not load. Please reopen Dashboard.' } },
    })
    return () => { disposed = true; subscription.unsubscribe(); engine?.destroy(); stopPreparing() }
  }, [owner, zh])
  return <div ref={root} className="dashboard-notes" aria-label={zh ? '风中便签' : 'Hanging notes'} />
}
