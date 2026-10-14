import { useEffect } from 'react'
import { getPlatform } from '../../../platform'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import { emitTasksChanged } from '../taskSync'
import { createTaskFromQuickInput } from './taskActions'

/**
 * Files lines jotted down outside the app as tasks (the desktop's ⌥Space box; never fires on
 * the web). Each line goes through the same quick-add syntax as ⌘K.
 */
export const useQuickCapture = () => {
  const { t, language } = useI18n()
  const toast = useToast()

  // The shell draws the capture box itself; it should speak the app's language, not the system's.
  useEffect(() => {
    void getPlatform().setUiLanguage(language)
  }, [language])

  useEffect(() => getPlatform().onQuickCapture((text) => {
    void createTaskFromQuickInput(text)
      .then((task) => {
        emitTasksChanged('quick-capture')
        toast.push({ variant: 'success', message: t('tasks.quickCapture.saved', { title: task.title }) })
      })
      .catch((error) => {
        console.error('[useQuickCapture] create failed', error)
        // Keep the words: the box is gone, this toast is the only copy.
        toast.push({ variant: 'error', message: t('tasks.quickCapture.failed', { text }) })
      })
  }), [t, toast])
}
