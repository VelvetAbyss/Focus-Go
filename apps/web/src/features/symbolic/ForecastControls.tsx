import { Temporal } from '@js-temporal/polyfill'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSymbolicCopy } from './useSymbolic'
export type ForecastCycle = 'day' | 'week' | 'month' | 'year' | 'decade'
export function ForecastControls<T extends ForecastCycle>({date,onDate,cycle,onCycle,cycles,onToday,onShift}:{date:string;onDate:(date:string)=>void;cycle:T;onCycle:(cycle:T)=>void;cycles:T[];onToday:()=>void;onShift?:(direction:-1|1)=>void}) {
  const {text}=useSymbolicCopy()
  const labels:Record<ForecastCycle,[string,string]>={day:['日运','Day'],week:['周运','Week'],month:['月运','Month'],year:['年运','Year'],decade:['大运','Luck cycle']}
  const shift=(direction:-1|1)=>{
    if(onShift){onShift(direction);return}
    const next=Temporal.PlainDate.from(date).add(cycle==='day'?{days:direction}:cycle==='week'?{days:direction*7}:cycle==='month'?{months:direction}:{years:direction*(cycle==='decade'?10:1)}).toString()
    if(next>='1901-01-01'&&next<='2100-12-31')onDate(next)
  }
  return <div className="forecast-controls"><div className="forecast-cycles" aria-label={text('运势周期','Forecast cycle')}>{cycles.map(c=><button type="button" key={c} aria-pressed={c===cycle} onClick={()=>onCycle(c)}>{text(labels[c][0],labels[c][1])}</button>)}</div><div className="forecast-calendar"><button type="button" className="symbolic-icon-button" aria-label={text('上一周期','Previous period')} onClick={()=>shift(-1)}><ChevronLeft size={17}/></button><input aria-label={text('运势日期','Forecast date')} type="date" min="1901-01-01" max="2100-12-31" value={date} onChange={e=>{if(e.target.value>='1901-01-01'&&e.target.value<='2100-12-31')onDate(e.target.value)}}/><button type="button" className="symbolic-icon-button" aria-label={text('下一周期','Next period')} onClick={()=>shift(1)}><ChevronRight size={17}/></button><button type="button" className="symbolic-text-button" onClick={onToday}>{text('今天','Today')}</button></div></div>
}
