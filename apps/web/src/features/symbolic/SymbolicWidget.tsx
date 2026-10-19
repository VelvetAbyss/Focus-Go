import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import Card from '../../shared/ui/Card'
import { useLabs } from '../labs/LabsContext'
import { useSymbolicCopy } from './useSymbolic'
import type { SymbolicModule } from './types'
import './widgets.css'
import './reportWidgets.css'

export function SymbolicWidget({module,children}:{module:SymbolicModule;children:ReactNode}) {
  const {ready,catalog}=useLabs(),{text}=useSymbolicCopy()
  const title=module==='bazi'?text('八字 · 今日','BaZi · Today'):module==='astrology'?text('星座 · 今日','Astrology · Today'):text('塔罗 · 每日一张','Tarot · Daily card')
  const installed=catalog.some(c=>c.featureKey===module&&c.state==='installed')
  return <Card title={title} className="symbolic-widget" actions={<Link className="symbolic-widget__open" to={installed?`/${module}`:'/labs'} aria-label={text('打开页面','Open page')}><ArrowUpRight size={14}/></Link>}>
    {!ready?<p className="symbolic-widget__note">{text('正在读取…','Loading…')}</p>:!installed?<div className="symbolic-widget__empty"><p>{text('模块已移除，记录仍保留。','Module removed. Records are retained.')}</p><Link to="/labs">{text('到实验室恢复 →','Restore in Labs →')}</Link></div>:children}
  </Card>
}
export function WidgetStatus({ready,error,empty,module}:{ready:boolean;error:boolean;empty:boolean;module:SymbolicModule}) {
  const {text}=useSymbolicCopy()
  return <div className="symbolic-widget__empty"><p>{error?text('本地记录暂时无法读取。','Local records are unavailable.'):!ready?text('正在读取…','Loading…'):empty?text('填写出生档案，开启你的每日观察。','Add birth details to begin your daily reflection.'):null}</p>{ready&&!error&&<Link to={`/${module}`}>{text('建立出生档案 →','Create birth profile →')}</Link>}</div>
}
