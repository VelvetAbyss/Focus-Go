import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { useSymbolicCopy } from './useSymbolic'
import type { SymbolicModule } from './types'
import './symbolic.css'
import './reading.css'

export function SymbolicShell({ module, title, subtitle, actions, children }: { module: SymbolicModule; title: string; subtitle: string; actions?: ReactNode; children: ReactNode }) {
  const { text } = useSymbolicCopy()
  return <main className={`symbolic-page symbolic-page--${module}`}>
    <header className="symbolic-header">
      <div className="symbolic-breadcrumb"><Link to="/labs"><ArrowLeft size={14} />{text('实验室','Labs')}</Link><span> / {title}</span></div>
      <div className="symbolic-heading"><div><span className="symbolic-eyebrow">{module === 'bazi' ? 'THE FOUR PILLARS' : module === 'astrology' ? 'A PERSONAL ATLAS' : 'A MOMENT TO REFLECT'}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="symbolic-actions">{actions}<Link className="symbolic-button" to={`/?symbolicWidget=${module}`}>{text('添加到工作台','Add widget')}<ArrowUpRight size={14}/></Link></div></div>
    </header>
    <div className="symbolic-content">{children}</div>
    <footer className="symbolic-footer">{text('传统象征体系 · 用于自我观察，解读不代表必然发生的结果。','Symbolic traditions · A lens for reflection; interpretations do not predict certain outcomes.')}</footer>
  </main>
}

export function SymbolicTabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <nav className="symbolic-tabs">{items.map(item => <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => onChange(item.id)}>{item.label}</button>)}</nav>
}

export function DataStatus({ ready, error }: { ready: boolean; error: boolean }) {
  const { text } = useSymbolicCopy()
  return <div className="symbolic-empty" role={error ? 'alert' : 'status'}>{error ? text('无法读取本地记录。请保留现有数据，检查浏览器存储权限后刷新。','Local records could not be read. Keep existing data, check browser storage permissions and refresh.') : !ready ? text('正在读取本地记录…','Loading local records…') : null}</div>
}
