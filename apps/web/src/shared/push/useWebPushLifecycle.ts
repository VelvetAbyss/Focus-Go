import { useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuth, subscribeAuth } from '../../store/auth'
import { usePreferences } from '../prefs/usePreferences'
import { useSyncActions } from '../../data/sync/service'
import { requestOpen } from '../navigation/openRequest'
import { buildTaskDetailRoute } from '../../app/routes/routes'
import {
  disableWebPush,
  forgetWebPushOnSignOut,
  isWebPushSupported,
  readWebPushEnabled,
  refreshWebPushRegistration,
} from './webPush'

type AuthPhase = 'signed-in' | 'pending' | 'signed-out'

// The persisted hint says who was signed in before the session exchange finishes; only "no user
// and no token" means signed out. Treating "pending" as signed out would drop the subscription
// on every page load.
const readAuthPhase = (): AuthPhase => {
  const auth = getAuth()
  if (auth?.accessToken) return 'signed-in'
  return auth?.user ? 'pending' : 'signed-out'
}

/**
 * Keeps this device's push subscription in step with the account and reminder settings, and
 * handles what the service worker sends back (a clicked notification, a push while in front).
 */
export const useWebPushLifecycle = () => {
  const navigate = useNavigate()
  const { syncNow } = useSyncActions()
  const { taskReminderEnabled, taskReminderLeadMinutes, language } = usePreferences()
  const authPhase = useSyncExternalStore(subscribeAuth, readAuthPhase, () => 'signed-out' as AuthPhase)

  useEffect(() => {
    if (!readWebPushEnabled()) return
    if (authPhase === 'signed-out') {
      // Another person may sign in here next; they must not get this account's reminders.
      void forgetWebPushOnSignOut()
      return
    }
    if (authPhase !== 'signed-in') return
    if (!taskReminderEnabled) {
      void disableWebPush()
      return
    }
    void refreshWebPushRegistration({ leadMinutes: taskReminderLeadMinutes, language })
  }, [authPhase, language, taskReminderEnabled, taskReminderLeadMinutes])

  useEffect(() => {
    if (!isWebPushSupported()) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; taskId?: string | null; url?: string } | null
      if (data?.type === 'focusgo:open') {
        if (data.taskId) {
          requestOpen('task', data.taskId)
          navigate(buildTaskDetailRoute(data.taskId))
        } else if (data.url?.startsWith('/')) {
          navigate(data.url)
        }
      } else if (data?.type === 'focusgo:push-reminder') {
        // A reminder arrived while the app is in front; pull, so the in-app reminder can fire
        // even if the task was set on another device moments ago.
        void syncNow()
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate, syncNow])
}
