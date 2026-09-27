import { Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROUTES } from '../../app/routes/routes'
import { useI18n } from '../../shared/i18n/useI18n'
import { setFocusTaskId } from './focusTask'

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
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('h-8 rounded-full px-3.5 text-meta font-semibold', className)}
      title={t('focus.task.startHint')}
      onClick={() => {
        setFocusTaskId(taskId)
        onLaunch?.()
        navigate(ROUTES.FOCUS)
      }}
    >
      <Timer className="mr-1.5 h-3.5 w-3.5" />
      {t('focus.task.start')}
    </Button>
  )
}
