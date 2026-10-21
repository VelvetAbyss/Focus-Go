import { useEffect, useId, useState } from 'react'
import { ArrowUpRight, Cloud, CloudCheck, CloudOff, LoaderCircle, Pause, RefreshCw, TriangleAlert } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../shared/ui/popover'
import './syncSafetyStatus.css'
import { Link } from 'react-router-dom'
import { getAuth, useIsLoggedIn } from '../../store/auth'
import { useSyncActions } from '../../data/sync/service'
import { useSyncSafety } from '../../data/sync/useSyncSafety'
import { useI18n } from '../../shared/i18n/useI18n'
import { Button } from '@/components/ui/button'

export default function SyncSafetyStatus() {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 960px)')
    if (!media) return
    const update = () => setCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const [open, setOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  const headingId = useId()
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
  const syncing = !problem && online && enabled && loggedIn && safety?.state?.status === 'syncing'
  const tone = problem ? 'warning' : !online || !enabled || !loggedIn ? 'paused' : confirmed ? 'confirmed' : syncing ? 'syncing' : 'waiting'
  const Icon = problem ? TriangleAlert : !online ? CloudOff : !enabled ? Pause : confirmed ? CloudCheck : syncing ? LoaderCircle : Cloud
  const title = problem ? (zh ? '同步需要留意' : 'Sync needs attention')
    : !online ? (zh ? '当前离线' : 'You’re offline')
    : !loggedIn ? (zh ? '尚未登录' : 'Not signed in')
    : !enabled ? (zh ? '同步已暂停' : 'Sync paused')
    : syncing ? (zh ? '正在同步' : 'Syncing') : label
  const summary = [title, title !== label ? label : '', reason].filter(Boolean).join(' · ')
  const retry = async () => {
    setRetrying(true)
    setRetryFailed(false)
    try { await syncNow() } catch { setRetryFailed(true) } finally { setRetrying(false) }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span className="sidebar-sync" data-tone={tone}>
        <span className="sr-only" data-testid="sync-safety-status" role={problem ? 'alert' : 'status'}>{summary}</span>
        <PopoverTrigger asChild>
          <button type="button" className="sidebar-sync__trigger" data-testid="sync-status-trigger"
            aria-label={summary} title={summary}>
            <Icon className={syncing ? 'sidebar-sync__spinner' : ''} size={17} strokeWidth={1.7} aria-hidden="true" />
            {(pending > 0 || problem) && <span className="sidebar-sync__dot" aria-hidden="true" />}
          </button>
        </PopoverTrigger>
      </span>
      <PopoverContent className="sidebar-sync__popover" side={compact ? 'bottom' : 'right'} align={compact ? 'end' : 'start'} sideOffset={12}
        collisionPadding={12} aria-labelledby={headingId}>
        <div className="sidebar-sync__heading" data-tone={tone}>
          <span className="sidebar-sync__seal"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <div><h2 id={headingId}>{title}</h2><p>{zh ? '同步与备份' : 'Sync & backup'}</p></div>
        </div>
        <div className="sidebar-sync__details">
          {title !== label && <p>{label}</p>}
          {reason && <p>{reason}</p>}
          {!!safety?.conflictCount && <p>{zh ? `待核对的冲突 · ${safety.conflictCount} 项` : `Conflicts to review · ${safety.conflictCount}`}</p>}
          {retryFailed && <p role="alert">{zh ? '暂时无法同步，请稍后重试。' : 'Could not sync. Please try again shortly.'}</p>}
          {confirmed && <p>{zh ? '最近确认' : 'Last confirmed'} · {new Date(safety.state!.lastCloudConfirmedAt!).toLocaleString(zh ? 'zh-CN' : 'en-US')}</p>}
          {!problem && !confirmed && !reason && <p>{zh ? '本地修改会在后台自动上传。' : 'Local changes upload automatically in the background.'}</p>}
          {problem && <p className="sidebar-sync__warning">{detail}</p>}
        </div>
        <div className="sidebar-sync__actions">
          {loggedIn && enabled && online && <Button size="sm" variant="ghost" disabled={retrying || syncing}
            onClick={() => void retry()}><RefreshCw size={14} aria-hidden="true" />{retrying || syncing ? (zh ? '正在同步' : 'Syncing') : problem ? (zh ? '重试上传' : 'Retry upload') : (zh ? '立即同步' : 'Sync now')}</Button>}
          <Link to="/workspace/settings?section=data" onClick={() => setOpen(false)}>
            {zh ? '同步与备份' : 'Sync & backup'}<ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
