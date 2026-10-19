import { Link } from 'react-router-dom'
import { SymbolicWidget } from '../symbolic/SymbolicWidget'
import { useSymbolic, useSymbolicCopy, useSymbolicNow } from '../symbolic/useSymbolic'
import { dailyReadingId } from '../symbolic/storage'
import { localDateKey } from '../symbolic/time'
import { tarotById, cardName, cardMeaning } from './deck'
import { TarotArt } from './TarotArt'
import './tarot-widget.css'
export default function TarotWidget() { return <SymbolicWidget module="tarot"><TarotWidgetBody/></SymbolicWidget> }
function TarotWidgetBody() {
 const { data, ready, error } = useSymbolic(), { text, language } = useSymbolicCopy(), now = useSymbolicNow()
 const reading = data.readings.find(r => r.id === dailyReadingId(now, data.timeZone) && !r.archived)
 const entry = reading?.cards[0], card = entry ? tarotById.get(entry.id) : null
 const report = reading?.reports?.[language]
 const session = data.sessions.find(s => s.spread === 'daily' && !s.completedReadingId && s.timeZone === data.timeZone && s.dateKey === localDateKey(now, data.timeZone))
 return <div className="symbolic-widget__content tarot-widget-content">
  <span className="symbolic-widget__note">{localDateKey(now, data.timeZone)} · {text('每日一牌','Daily card')}</span>
  {!ready || error ? <p>{error ? text('记录暂时无法读取。','Records are unavailable.') : text('正在读取…','Loading…')}</p> : <>
   <div className="tarot-widget-reading">
    <div className="tarot-widget-copy">
     <h4>{entry?.revealed && card ? cardName(card, language) : text('今天的牌，等你亲手选择','Today’s card is yours to choose')}</h4>
     <p className="symbolic-widget__summary">{entry?.revealed && card ? report?.summary ?? cardMeaning(card, entry.reversed, language) : text('洗牌后从牌背中选出一张，再慢慢翻开。','Shuffle, choose a face-down card and reveal it at your pace.')}</p>
    </div>
    {entry?.revealed && card && <div className="tarot-widget-card"><TarotArt card={card} reversed={entry.reversed}/></div>}
   </div>
   {entry?.revealed && report?.dos[0] && <p className="symbolic-widget__note tarot-widget-practice">{text('今日实践：','Try today: ')}{report.dos[0]}</p>}
   {!entry?.revealed && <Link className="symbolic-widget__draw" to="/tarot">{entry ? text('继续翻开今日牌','Reveal today’s card') : session ? text('继续选择今日牌','Continue your daily draw') : text('进入抽牌','Choose your card')}</Link>}
  </>}
  <div className="symbolic-widget__bottom"><span>{entry?.revealed ? entry.reversed ? text('逆位','Reversed') : text('正位','Upright') : text('当天首次抽取后固定','Fixed after your first daily draw')}</span><Link to="/tarot">{text('查看 →','Open →')}</Link></div>
 </div>
}
