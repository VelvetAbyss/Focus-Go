import { recordActivation } from '../../shared/performance/diagnostics'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '../../data/db'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { getAuth } from '../../store/auth'
import { useI18n } from '../../shared/i18n/useI18n'
import { useSharedFocusTimer } from '../focus/useSharedFocusTimer'
import './firstFocus.css'

const KEY = 'focusgo.first-focus.v1'
const TASK_KEY = 'focusgo.first-focus.task.v1'
const LoginModal = lazy(() => import('../../app/layout/LoginModal'))

function FirstFocusSession({ dismiss }: { dismiss: () => void }) {
  const { language } = useI18n()
  const zh = language === 'zh'
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [login, setLogin] = useState(false)
  const busyRef = useRef(false)
  const { state, start, pause, resume } = useSharedFocusTimer({ defaultDurationMinutes: 10 })
  const started = localStorage.getItem(KEY) === 'started'
  const completed = started && state.status === 'completed'
  const remaining = `${Math.floor(state.remainingSeconds / 60).toString().padStart(2, '0')}:${(state.remainingSeconds % 60).toString().padStart(2, '0')}`
  const begin = async () => {
    if (busyRef.current || !title.trim()) return
    busyRef.current = true
    setBusy(true)
    setError(false)
    try {
      const previousId = localStorage.getItem(TASK_KEY)
      const task = (previousId ? await db.tasks.get(previousId) : undefined) ?? await tasksRepo.add({ title: title.trim(), status: 'todo', priority: null, isToday: true })
      localStorage.setItem(TASK_KEY, task.id)
      await start(10, task.id)
      localStorage.setItem(KEY, 'started')
      recordActivation('first_focus_started')
    } catch { setError(true) } finally { busyRef.current = false; setBusy(false) }
  }
  return <section className="first-focus" data-auth-preview-allowed="true" aria-labelledby="first-focus-title">
    <p className="first-focus__eyebrow">{zh ? '从一件事开始' : 'One thing at a time'}</p>
    <h1 id="first-focus-title">{completed ? (zh ? '你已经专注了 10 分钟。' : 'You made 10 minutes of progress.') : (zh ? '给眼前这件事，10 分钟。' : 'Give one thing 10 minutes.')}</h1>
    <p>{completed ? (zh ? '这次专注已保存。接下来继续，或者休息一下。' : 'Your session is saved. Keep going, or take a break.') : (zh ? '不用先整理所有计划。写下现在想推进的一件事。' : 'No need to plan everything. Choose something you can move forward now.')}</p>
    {!started && <form onSubmit={(event) => { event.preventDefault(); void begin() }}>
      <label htmlFor="first-focus-task">{zh ? '现在想做什么？' : 'What will you work on?'}</label>
      <input id="first-focus-task" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder={zh ? '例如：写出提案的第一段' : 'For example: write the first paragraph'} required disabled={busy} />
      <button className="first-focus__primary" disabled={busy || !title.trim()}>{busy ? (zh ? '正在准备…' : 'Getting ready…') : (zh ? '开始 10 分钟专注' : 'Start 10-minute focus')}</button>
    </form>}
    {started && !completed && <div className="first-focus__timer">
      <output aria-label={zh ? '剩余时间' : 'Time remaining'}>{remaining}</output>
      <button type="button" onClick={() => { void (state.running ? pause() : resume()).catch(() => setError(true)) }}>{state.running ? (zh ? '暂停' : 'Pause') : (zh ? '继续专注' : 'Resume')}</button>
    </div>}
    {error && <p role="alert">{zh ? '暂时无法保存，请重试。已创建的任务会保留。' : 'Unable to save. Please retry; your existing task is kept.'}</p>}
    {completed && !getAuth()?.user && <button className="first-focus__primary" type="button" onClick={() => setLogin(true)}>{zh ? '登录并同步这次进展' : 'Sign in to sync your progress'}</button>}
    <button className="first-focus__skip" type="button" onClick={() => { localStorage.setItem(KEY, completed ? 'completed' : 'dismissed'); recordActivation(completed ? 'first_focus_completed' : 'first_focus_dismissed'); dismiss() }}>{completed ? (zh ? '进入工作区' : 'Open workspace') : (zh ? '我想先自己探索' : 'Explore on my own')}</button>
    {login && <Suspense fallback={null}><LoginModal onClose={() => setLogin(false)} /></Suspense>}
  </section>
}

export default function FirstFocus({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    const status = localStorage.getItem(KEY)
    if (status === 'completed' || status === 'dismissed' || getAuth()?.user) { setVisible(false); return }
    if (status === 'started') { setVisible(true); return }
    void Promise.all([db.tasks.count(), db.notes.count(), db.focusSessions.count(), db.diaryEntries.count()]).then((counts) => {
      if (active) setVisible(counts.every((count) => count === 0))
    }).catch(() => { if (active) setVisible(false) })
    return () => { active = false }
  }, [])
  if (visible === null) return <div role="status" aria-busy="true" />
  return visible ? <FirstFocusSession dismiss={() => setVisible(false)} /> : children
}
