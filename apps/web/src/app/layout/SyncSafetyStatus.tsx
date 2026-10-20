import { Link } from 'react-router-dom'
import { getAuth, useIsLoggedIn } from '../../store/auth'
import { useSyncActions } from '../../data/sync/service'
import { useSyncSafety } from '../../data/sync/useSyncSafety'
import { useI18n } from '../../shared/i18n/useI18n'
import { Button } from '@/components/ui/button'

export default function SyncSafetyStatus() {
  const loggedIn = useIsLoggedIn()
  const { enabled, syncNow } = useSyncActions()
  const { safety, failed, online, now } = useSyncSafety()
  const { language } = useI18n()
  const zh = language === 'zh'
  const pending = safety?.pendingCount ?? 0
  const delayed = !!safety?.oldestPendingAt && now - safety.oldestPendingAt >= 60_000
  const problem = failed || safety?.state?.status === 'error' || safety?.state?.status === 'blocked'
    || !!safety?.conflictCount || (pending > 0 && (delayed || !online || !enabled || !loggedIn))
  const confirmed = !problem && safety?.state?.status === 'idle' && safety && pending === 0 && !!safety.state?.lastCloudConfirmedAt
    && loggedIn && safety.state.cloudConfirmedAccountId === getAuth()?.user?.id
    && !safety.state.pendingBlobPush && !safety.state.missingBlobPull
  const label = failed ? (zh ? '保存状态待核对' : 'Save status unavailable')
    : pending ? (zh ? `本机已保存 · 待上传 ${pending} 项` : `Saved on device · ${pending} pending`)
    : confirmed ? (zh ? '云端已确认' : 'Cloud confirmed')
    : (zh ? '尚未获得云端确认' : 'Awaiting cloud confirmation')
  const reason = !online ? (zh ? '离线，联网后自动重试' : 'Offline; retries on reconnection')
    : !loggedIn ? (zh ? '登录后才能上传' : 'Sign in to upload')
    : !enabled ? (zh ? '云同步已暂停' : 'Cloud sync paused')
    : safety?.conflictCount || safety?.state?.status === 'blocked' ? (zh ? '有同步冲突待核对' : 'Sync conflicts need review')
    : safety?.state?.status === 'error' ? (zh ? '上传失败，将自动重试' : 'Upload failed; automatic retry scheduled')
    : delayed ? (zh ? '上传仍未完成' : 'Upload is still pending') : ''
  const detail = zh
    ? '未上传的数据只在本机。请勿清除浏览器的网站数据；可先导出备份。'
    : 'Unsent data exists only on this device. Keep browser site data, or export a backup first.'
  return (
    <div data-testid="sync-safety-status" role={problem ? 'alert' : 'status'}
      className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs ${problem ? 'border-amber-500/40 bg-amber-500/10 text-foreground' : 'border-border/50 text-muted-foreground'}`}>
      <span className="font-medium">{label}</span>
      {reason ? <span>{reason}</span> : null}
      {problem ? <span>{detail}</span> : null}
      {confirmed ? <span>{new Date(safety.state!.lastCloudConfirmedAt!).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US')}</span> : null}
      {problem && loggedIn && enabled && online ? <Button size="sm" variant="ghost" onClick={() => void syncNow()}>{zh ? '重试上传' : 'Retry upload'}</Button> : null}
      {problem || !confirmed ? <Link className="underline underline-offset-4" to="/workspace/settings?section=data">{zh ? '同步与备份' : 'Sync & backup'}</Link> : null}
    </div>
  )
}
