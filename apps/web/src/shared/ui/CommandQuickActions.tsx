import { Coffee, Pause, Play } from 'lucide-react'
import { Command } from 'cmdk'
import { useI18n } from '../i18n/useI18n'
import { useAuthGate } from '../../features/auth/AuthGateContext'
import { useSharedFocusTimer } from '../../features/focus/useSharedFocusTimer'
import { startBreak, stopBreak, useSalaryState } from '../../features/salary/useSalaryState'

type CommandQuickActionsProps = {
  /** Lower-cased query; empty shows every action. */
  needle: string
  /** Closes the palette, then runs the action. */
  run: (fn: () => void) => void
}

type QuickAction = { id: string; label: string; keywords: string; icon: typeof Play; act: () => void }

/**
 * Things ⌘K can do on the spot rather than go to: start or pause the focus timer, and start or
 * end a break when the pay widgets are set up. Mounted only while the palette is open, so the
 * timer's ticks don't re-render a closed palette.
 */
const CommandQuickActions = ({ needle, run }: CommandQuickActionsProps) => {
  const { t } = useI18n()
  const { requireAuth } = useAuthGate()
  const { state, start, pause, resume } = useSharedFocusTimer({ defaultDurationMinutes: 25 })
  const { settings, activeBreakStartAt } = useSalaryState()

  const actions: QuickAction[] = []
  if (state.running) {
    actions.push({ id: 'focus-pause', label: t('commandPalette.do.pauseFocus'), keywords: 'pause focus timer 暂停 专注', icon: Pause, act: () => void pause() })
  } else if (state.status === 'paused') {
    actions.push({ id: 'focus-resume', label: t('commandPalette.do.resumeFocus'), keywords: 'resume focus timer 继续 专注', icon: Play, act: () => void resume() })
  } else {
    actions.push({
      id: 'focus-start',
      label: t('commandPalette.do.startFocus', { n: state.durationMinutes }),
      keywords: 'start focus pomodoro timer 开始 专注 番茄',
      icon: Play,
      act: () => void start(state.durationMinutes),
    })
  }
  if (settings) {
    actions.push(
      activeBreakStartAt
        ? { id: 'break-stop', label: t('commandPalette.do.stopBreak'), keywords: 'end break 结束 摸鱼 休息', icon: Coffee, act: () => stopBreak() }
        : { id: 'break-start', label: t('commandPalette.do.startBreak'), keywords: 'start break 开始 摸鱼 休息', icon: Coffee, act: () => startBreak() },
    )
  }

  const visible = actions.filter((action) => !needle || `${action.label} ${action.keywords}`.toLowerCase().includes(needle))
  if (visible.length === 0) return null

  return (
    <Command.Group heading={t('commandPalette.group.do')} className="command-palette__group">
      {visible.map((action) => {
        const Icon = action.icon
        return (
          <Command.Item
            key={action.id}
            value={`do:${action.id}`}
            className="command-palette__item"
            onSelect={() => run(() => requireAuth(action.act))}
          >
            <Icon className="size-4" />
            <span>{action.label}</span>
          </Command.Item>
        )
      })}
    </Command.Group>
  )
}

export default CommandQuickActions
