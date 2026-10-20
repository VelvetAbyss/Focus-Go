import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '../../shared/i18n/useI18n'
import { useSyncActions } from '../../data/sync/service'
import { db } from '../../data/db'
import { DB_NAME, DB_VERSION, TABLES } from '../../data/db/schema'
import { prepareAppUpdate } from '../../shared/runtime/updateLifecycle'
import { createBackupDownload, createBrowserStorageAdapter, createTableDatabaseAdapter, downloadBackupFile, exportLocalBackup } from '../../shared/backup/localBackup'

export default function DataSafetyNotice({ onClose }: { onClose: () => void }) {
  const { language } = useI18n()
  const { syncNow } = useSyncActions()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const zh = language === 'zh'
  const exportBackup = async () => {
    setBusy(true)
    try {
      await prepareAppUpdate()
      const tableNames = Object.values(TABLES)
      downloadBackupFile(await createBackupDownload(await exportLocalBackup({
        db: createTableDatabaseAdapter(db, tableNames), storage: createBrowserStorageAdapter(localStorage),
        tableNames, dbName: DB_NAME, dbVersion: DB_VERSION,
      })))
      setMessage(zh ? '已发起备份下载，请确认文件已保存。本机数据仍保留。' : 'Backup download started. Verify the saved file. Device data is retained.')
    } catch {
      setMessage(zh ? '备份未完成，本机数据已保留。请重试。' : 'Backup failed. Device data is retained. Please retry.')
    } finally { setBusy(false) }
  }
  return <div role="alert" data-testid="data-safety-notice" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
    <p className="font-medium">{zh ? '操作已暂停，本机数据已保留' : 'Action paused. Device data retained.'}</p>
    <p className="my-2">{zh ? '存在未上传、未处理冲突或尚未确认的数据。请先同步并核对；也可以导出备份。请勿清除浏览器的网站数据。' : 'Some data is unsent, conflicted or unconfirmed. Sync and review it first, or export a backup. Keep browser site data.'}</p>
    {message ? <p role="status" className="my-2">{message}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={() => void exportBackup()}>{zh ? '导出本机备份' : 'Export device backup'}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { setBusy(true); void syncNow().catch(() => {}).finally(() => { setBusy(false); setMessage(zh ? '请核对同步状态后重试原操作。' : 'Review sync status before retrying the action.') }) }}>{zh ? '重试同步' : 'Retry sync'}</Button>
      <Button size="sm" variant="ghost" onClick={onClose}>{zh ? '保留并返回' : 'Keep data & return'}</Button>
    </div>
  </div>
}
