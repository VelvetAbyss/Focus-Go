import { useSyncExternalStore } from 'react'
import { Switch } from '@/components/ui/switch'
import { anonymousCountsEnabled, setAnonymousCountsEnabled, subscribeAnonymousCounts } from './anonymousCounts'

export default function AnonymousCountsSetting({ language }: { language: string }) {
  const enabled = useSyncExternalStore(subscribeAnonymousCounts, anonymousCountsEnabled, () => false)
  const zh = language === 'zh'
  return <section className="rounded-[var(--radius-lg)] border p-5" aria-labelledby="anonymous-counts-title">
    <div className="flex items-center justify-between gap-4">
      <h3 id="anonymous-counts-title" className="font-semibold">{zh ? '匿名使用计数' : 'Anonymous usage counts'}</h3>
      <Switch aria-labelledby="anonymous-counts-title" checked={enabled} onCheckedChange={setAnonymousCountsEnabled} />
    </div>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{zh ? '自托管统计只累加每日计数，不发送用户标识、任务或笔记内容。这里仅记录本浏览器首次成功保存任务或完成专注。选择只保存在本浏览器，浏览器隐私信号优先。' : 'Self-hosted daily totals contain no user identifier, task text or notes. The app counts only the first successful task save or focus completion observed in this browser. This choice stays in this browser; browser privacy signals take priority.'}</p>
  </section>
}
