import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SymbolicWidget, WidgetStatus } from '../symbolic/SymbolicWidget'
import { WidgetReport } from '../symbolic/ReportView'
import { useSymbolic, useSymbolicCopy, useSymbolicNow } from '../symbolic/useSymbolic'
import { baziDateKey, baziForecast } from './reports'
export default function BaziWidget(){return <SymbolicWidget module="bazi"><BaziWidgetBody/></SymbolicWidget>}
function BaziWidgetBody(){
  const {data,ready,error}=useSymbolic(),{text,language}=useSymbolicCopy(),now=useSymbolicNow()
  const date=baziDateKey(now,data.profile?.zi??2)
  const report=useMemo(()=>{try{return data.profile?baziForecast(data.profile,date,'day',language):null}catch{return null}},[data.profile,date,language])
  if(!ready||error||!data.profile)return <WidgetStatus ready={ready} error={error} empty={!data.profile} module="bazi"/>
  if(!report)return <div className="symbolic-widget__empty" role="alert"><p>{text('本次日运暂时无法计算，请核对出生档案。','This daily report could not be calculated. Check the birth details.')}</p><Link to="/bazi">{text('查看档案 →','Review profile →')}</Link></div>
  return <div className="symbolic-widget__content"><span className="symbolic-widget__note">{data.profile.name||text('我的档案','My profile')} · {date}</span><WidgetReport report={report}/><div className="symbolic-widget__bottom"><span>{text('北京标准时间 · UTC+08','Beijing time · UTC+08')}</span><Link to="/bazi">{text('今日详情 →','Today’s reading →')}</Link></div></div>
}
