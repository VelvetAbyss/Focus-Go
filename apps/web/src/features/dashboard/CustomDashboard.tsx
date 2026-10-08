import { useEffect, useMemo, useState } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import { absoluteStrategy } from 'react-grid-layout/core'
import { Plus, Copy, Pencil, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '../../shared/i18n/useI18n'
import { useLifeI18n } from '../life/lifeI18n'
import { useIsBreakpoint } from '../../hooks/use-is-breakpoint'
import { getDashboardCards, getLifeCards } from './registry'
import { useDashboardGridEdit } from './useDashboardGridEdit'
import { appendViewWidget, uniqueViewName, viewNameError, type CustomView } from './customViews'
import './custom-views.css'

type Props = {
  view: CustomView
  views: CustomView[]
  isNew: boolean
  onSave: (view: CustomView) => void
  onDelete: () => void
  onCopy: (view: CustomView) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}

const zhTitles: Record<string, string> = { 'task-progress-summary': '本周成果', tasks: '任务', spend: '支出', weather: '天气', 'widget-todos': '待办列表', world_clock: '世界时钟', stocks: '股票' }

export default function CustomDashboard({ view, views, isNew, onSave, onDelete, onCopy, onCancel, onDirtyChange }: Props) {
  const { language } = useI18n()
  const { t: lifeT } = useLifeI18n()
  const zh = language === 'zh'
  const text = (cn: string, en: string) => zh ? cn : en
  const cards = useMemo(() => [...getDashboardCards(), ...getLifeCards(lifeT)], [lifeT])
  const title = (id: string) => (zh && zhTitles[id]) || cards.find(card => card.id === id)?.title || id
  const [draft, setDraft] = useState<CustomView>(() => structuredClone(view))
  const [editing, setEditing] = useState(isNew)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  useEffect(() => { onDirtyChange(editing && (isNew || JSON.stringify(draft) !== JSON.stringify(view))) }, [editing, isNew, draft, view, onDirtyChange])
  useEffect(() => {
    if (!editing || (!isNew && JSON.stringify(draft) === JSON.stringify(view))) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [editing, isNew, draft, view])
  const mobile = useIsBreakpoint('max', 768)
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: window.innerWidth })
  const items = editing ? draft.items : view.items
  const grid = useDashboardGridEdit({ layout: items, enabled: editing && !mobile, cols: 12, rowHeight: 60, margin: [18, 18], padding: [18, 18], width: Math.max(width, 320), minW: 2, minH: 2,
    onUpdate: next => setDraft(prev => ({ ...prev, items: next })),
    onCommit: next => setDraft(prev => ({ ...prev, items: next })),
  })
  const save = () => {
    const issue = viewNameError(draft.name, views, draft.id)
    if (issue) { setError(issue === 'duplicate' ? text('已有同名视图，请换个名字。', 'A view with this name already exists.') : text('请输入 1–40 个字符的视图名字。', 'Enter a view name with 1–40 characters.')); return }
    try { onSave({ ...draft, name: draft.name.trim() }); setEditing(false); setError('') }
    catch { setError(text('保存失败，请检查浏览器存储空间后重试。', 'Save failed. Check browser storage and try again.')) }
  }
  const cancel = () => { setDraft(structuredClone(view)); setEditing(false); setError(''); if (isNew) onCancel() }
  const toggle = (id: string) => {
    setDraft(prev => {
      if (prev.items.some(item => item.key === id)) return { ...prev, items: prev.items.filter(item => item.key !== id) }
      const card = cards.find(card => card.id === id)!
      const w = card.pageScope === 'life' ? Math.max(3, Math.round(card.defaultSize.w / 2)) : card.defaultSize.w
      return { ...prev, items: appendViewWidget(prev.items, id, w, card.defaultSize.h) }
    })
  }
  const reorder = (index: number, delta: number) => {
    setDraft(prev => {
      const ordered = [...prev.items].sort((a, b) => a.y - b.y || a.x - b.x)
      const target = index + delta
      if (target < 0 || target >= ordered.length) return prev
      ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
      let y = 0
      return { ...prev, items: ordered.map(item => { const next = { ...item, x: 0, y }; y += item.h; return next }) }
    })
  }
  const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const mobileLayout = ordered.map((item, index) => ({ ...item, x: 0, w: 4, y: ordered.slice(0, index).reduce((y, previous) => y + previous.h, 0) }))
  return <section className="custom-view" ref={containerRef} aria-label={text('自定义视图', 'Custom view')}>
    <div className="custom-view__toolbar">
      <div className="custom-view__heading">
        {editing ? <Input aria-label={text('视图名字', 'View name')} maxLength={40} value={draft.name} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))} /> : <h2>{view.name}</h2>}
        <span>{editing ? text('编辑后保存 · 组件数据与原页面共用', 'Save when ready · Widgets share their original data') : text('已保存在此浏览器', 'Saved in this browser')}</span>
      </div>
      <div className="custom-view__actions">
        {editing ? <><Button variant="outline" onClick={cancel}>{text('取消', 'Cancel')}</Button><Button onClick={save}>{text('保存视图', 'Save view')}</Button></> : <>
          <Button variant="ghost" onClick={() => { setDraft(structuredClone(view)); setEditing(true); setDeleting(false) }}><Pencil size={14} />{text('编辑视图', 'Edit view')}</Button>
          <Button variant="ghost" onClick={() => { try { onCopy({ ...structuredClone(view), id: crypto.randomUUID(), name: uniqueViewName(text(`${view.name} 副本`, `${view.name} copy`), views) }) } catch { setError(text('复制未保存，请重试。', 'Copy could not be saved. Try again.')) } }}><Copy size={14} />{text('复制', 'Duplicate')}</Button>
          <Button variant="ghost" aria-label={text('删除视图', 'Delete view')} onClick={() => setDeleting(true)}><Trash2 size={14} /></Button>
        </>}
      </div>
    </div>
    {error && <p className="custom-view__error" role="alert">{error}</p>}
    {deleting && <div className="custom-view__confirm" role="alert">
      <span>{text(`删除“${view.name}”？组件里的数据会保留。`, `Delete “${view.name}”? Widget data will be kept.`)}</span>
      <Button variant="outline" onClick={() => setDeleting(false)}>{text('取消', 'Cancel')}</Button>
      <Button variant="destructive" onClick={() => { try { onDelete() } catch { setError(text('删除未保存，请重试。', 'Deletion could not be saved. Try again.')) } }}>{text('确认删除', 'Delete view')}</Button>
    </div>}
    {editing && <div className="custom-view__editor">
      <div className="custom-view__catalog">
        <h3>{text('添加组件', 'Add widgets')}</h3>
        <Input type="search" aria-label={text('搜索组件', 'Search widgets')} placeholder={text('搜索组件…', 'Search widgets…')} value={query} onChange={e => setQuery(e.target.value)} />
        {(['main', 'life'] as const).map(scope => <div key={scope}>
          <h4>{scope === 'main' ? 'Focus' : 'Life'}</h4>
          {cards.filter(card => card.pageScope === scope && title(card.id).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(card => {
            const added = draft.items.some(item => item.key === card.id)
            return <button type="button" key={card.id} className="custom-view__widget-option" aria-label={text(`${added ? '移除' : '添加'} ${title(card.id)}`, `${added ? 'Remove' : 'Add'} ${title(card.id)}`)} aria-pressed={added} onClick={() => toggle(card.id)}><span>{title(card.id)}</span>{added ? <X size={14} /> : <Plus size={14} />}<span className="sr-only">{added ? text('移除', 'Remove') : text('添加', 'Add')}</span></button>
          })}
        </div>)}
        {!cards.some(card => title(card.id).toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <p>{text('没有匹配的组件', 'No matching widgets')}</p>}
      </div>
      <div className="custom-view__arrange">
        <h3>{text('组件布局', 'Widget layout')}</h3>
        <p>{mobile ? text('使用箭头调整顺序，桌面端可拖动布局。', 'Use arrows to reorder. Drag on desktop for a custom layout.') : text('拖动下方组件调整位置，拖动右下角改变尺寸。', 'Drag widgets below to move them. Drag the corner to resize.')}</p>
        {ordered.map((item, index) => <div className="custom-view__layout-row" key={item.key}>
          <span>{title(item.key)}</span>
          <button type="button" disabled={index === 0} aria-label={text(`上移 ${title(item.key)}`, `Move ${title(item.key)} up`)} onClick={() => reorder(index, -1)}><ArrowUp size={14} /></button>
          <button type="button" disabled={index === ordered.length - 1} aria-label={text(`下移 ${title(item.key)}`, `Move ${title(item.key)} down`)} onClick={() => reorder(index, 1)}><ArrowDown size={14} /></button>
          <select aria-label={text(`${title(item.key)}宽度`, `${title(item.key)} width`)} value={item.w} onChange={e => setDraft(prev => ({ ...prev, items: prev.items.map(row => row.key === item.key ? { ...row, w: Number(e.target.value), x: 0, y: prev.items.reduce((y, other) => Math.max(y, other.y + other.h), 0) } : row) }))}>
            {Array.from({ length: 11 }, (_, i) => i + 2).map(w => <option value={w} key={w}>{w}/12</option>)}
          </select>
          <input type="number" min={2} max={30} aria-label={text(`${title(item.key)}高度`, `${title(item.key)} height`)} value={item.h} onChange={e => { const h = Number(e.target.value); if (Number.isInteger(h) && h >= 2 && h <= 30) setDraft(prev => ({ ...prev, items: prev.items.map(row => row.key === item.key ? { ...row, h, y: prev.items.reduce((y, other) => Math.max(y, other.y + other.h), 0) } : row) })) }} />
          <button type="button" aria-label={text(`移除 ${title(item.key)}`, `Remove ${title(item.key)}`)} onClick={() => toggle(item.key)}><X size={14} /></button>
        </div>)}
      </div>
    </div>}
    {items.length === 0 && <div className="custom-view__empty"><h3>{text('留一页给你自己的节奏', 'A page for your own rhythm')}</h3><p>{text('把任务、天气、书籍或世界时钟放在一起。', 'Bring tasks, weather, books or world clocks together.')}</p>{!editing && <Button variant="outline" onClick={() => setEditing(true)}><Plus size={14} />{text('添加组件', 'Add widgets')}</Button>}</div>}
    {mounted && items.length > 0 && <GridLayout className={`dashboard__grid${editing && !mobile ? ' dashboard__grid--edit-mode' : ''}`} width={Math.max(width, 1)} layout={(mobile ? mobileLayout : items).map(item => ({ i: item.key, x: item.x, y: item.y, w: item.w, h: item.h }))} gridConfig={{ cols: mobile ? 4 : 12, rowHeight: 60, margin: [18, 18], containerPadding: [18, 18] }} dragConfig={{ enabled: false }} resizeConfig={{ enabled: false }} positionStrategy={absoluteStrategy}>
      {items.map(item => <div key={item.key} className={`dashboard__item${editing && !mobile ? ' is-layout-edit' : ''}${grid.activeId === item.key ? ' is-dragging' : ''}`}>
        {cards.find(card => card.id === item.key)?.render() ?? <p>{text('此组件暂不可用，可在编辑中移除。', 'This widget is unavailable. Remove it in the editor.')}</p>}
        {editing && !mobile && <><div className="dashboard__edit-overlay" {...grid.dragProps(item.key)}><span>{title(item.key)}</span></div><div className="dashboard__resize-handle" {...grid.resizeProps(item.key)} /></>}
      </div>)}
    </GridLayout>}
  </section>
}
