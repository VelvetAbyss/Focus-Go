import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SymbolicWidget, WidgetStatus } from '../symbolic/SymbolicWidget'
import { WidgetReport } from '../symbolic/ReportView'
import { useSymbolic, useSymbolicCopy, useSymbolicNow } from '../symbolic/useSymbolic'
import { localDateKey } from '../symbolic/time'
import { SIGNS } from './engine'
import { astrologyForecast } from './reports'
import { resolveAstrologySource, useAstrologySelection } from './useAstrologySelection'
export default function AstrologyWidget(){return <SymbolicWidget module="astrology"><AstrologyWidgetBody/></SymbolicWidget>}
function AstrologyWidgetBody(){
  const {owner,data,ready,error}=useSymbolic(),{text,language,zh}=useSymbolicCopy(),now=useSymbolicNow()
  const selection=useAstrologySelection(owner),source=resolveAstrologySource(selection,Boolean(data.profile))
  const date=localDateKey(now,data.timeZone)
  const input=source==='personal'?data.profile:selection.sign
  const report=useMemo(()=>{try{return input===null?null:astrologyForecast(input,date,'day',language,data.timeZone)}catch{return null}},[input,date,language,data.timeZone])
  if(!ready||error)return <WidgetStatus ready={ready} error={error} empty={false} module="astrology"/>
  if(input===null)return <div className="symbolic-widget__empty"><p>{source==='personal'?text('建立出生档案，查看个人今日运势。','Add birth details to see your personal daily reading.'):text('选择太阳星座，开始每日速览。','Choose a Sun sign to begin your daily overview.')}</p><Link to="/astrology">{source==='personal'?text('建立个人星盘 →','Create a personal chart →'):text('选择星座 →','Choose a sign →')}</Link></div>
  if(!report)return <div className="symbolic-widget__empty" role="alert"><p>{text('今日报告暂时无法计算，请到页面核对资料。','The daily report could not be calculated. Open the page to check your details.')}</p><Link to="/astrology">{text('查看 →','Open →')}</Link></div>
  return <div className="symbolic-widget__content"><span className="symbolic-widget__note">{source==='personal'?text('个人星盘 · ','Personal · ')+(data.profile?.name||text('我的档案','My profile')):text('十二星座 · ','Sun sign · ')+SIGNS[selection.sign!][zh?0:1]} · {date}</span><WidgetReport report={report}/><div className="symbolic-widget__bottom"><span>{data.timeZone}</span><Link to="/astrology">{text('今日详情 →','Today’s reading →')}</Link></div></div>
}
