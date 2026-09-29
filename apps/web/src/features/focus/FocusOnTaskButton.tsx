import { Timer } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROUTES } from '../../app/routes/routes'
import { useI18n } from '../../shared/i18n/useI18n'
import { setFocusTaskId } from './focusTask'
import { withReturnPath, withTaskContext } from '../../shared/navigation/returnPath'

type FocusOnTaskButtonProps = {
  taskId: string
  className?: string
  /** Runs before navigating (e.g. mark the task in progress, close the drawer). */
  onLaunch?: () => void
}

/** "专注" — make this task the focus timer's task and open the focus page. Needs a router. */
export default function FocusOnTaskButton({ taskId, className, onLaunch }: FocusOnTaskButtonProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('h-8 rounded-full px-3.5 text-meta font-semibold', className)}
      title={t('focus.task.startHint')}
      onClick={() => {
        setFocusTaskId(taskId)
        onLaunch?.()
        navigate(withReturnPath(ROUTES.FOCUS, withTaskContext(`${location.pathname}${location.search}`, taskId)))
      }}
    >
      <Timer className="mr-1.5 h-3.5 w-3.5" />
      {t('focus.task.start')}
    </Button>
  )
}
