import { useRef, useState } from 'react'
import { ArrowRight, BookOpen, RotateCcw, Shuffle } from 'lucide-react'
import { SymbolicShell, SymbolicTabs, DataStatus } from '../symbolic/SymbolicShell'
import { useSymbolic, useSymbolicCopy, useSymbolicNow } from '../symbolic/useSymbolic'
import { dailyReadingId, finishTarotSession, selectTarotCard, startTarotSession, updateReading } from '../symbolic/storage'
import { ReportView } from '../symbolic/ReportView'
import { SymbolicSyncStatus } from '../symbolic/SyncStatus'
import { localDateKey } from '../symbolic/time'
import type { TarotContext, TarotReading, TarotSession } from '../symbolic/types'
import { TAROT_DECK, tarotById, cardName, cardMeaning } from './deck'
import { TarotArt } from './TarotArt'
import { buildTarotReports } from './interpretation'
import { cardSemantics } from './semantics'
import { defaultTarotContext, legacySpreadPositions, recommendedSpread, spreadName, spreadPositions, tarotTopicName, validateTarotContext } from './spreads'
import './tarot.css'

type Tab = 'daily' | 'question' | 'history' | 'library'
export default function TarotPage() {
 const state = useSymbolic()
 const { text } = useSymbolicCopy()
 return <SymbolicShell module="tarot" title={text('塔罗 · 一刻', 'Tarot · A Moment')} subtitle={text('从一个明确的问题出发，读懂每张牌，也读懂它们之间的联系。', 'Begin with a clear question. Read each card and the connections between them.')}>
  <SymbolicSyncStatus/>
  {!state.ready || state.error ? <DataStatus ready={state.ready} error={state.error}/> : <TarotWorkspace key={state.owner} owner={state.owner} readings={state.data.readings} sessions={state.data.sessions} timeZone={state.data.timeZone}/>}
 </SymbolicShell>
}
function TarotWorkspace({ owner, readings, sessions, timeZone }: { owner: string; readings: TarotReading[]; sessions: TarotSession[]; timeZone: string }) {
 const { text, language } = useSymbolicCopy()
 const now = useSymbolicNow()
 const [tab, setTab] = useState<Tab>('daily')
 const [context, setContext] = useState<TarotContext>(defaultTarotContext)
 const [review, setReview] = useState(false), [reverse, setReverse] = useState(true)
 const [sessionId, setSessionId] = useState<string | null>(null), [readingId, setReadingId] = useState<string | null>(null)
 const [fresh, setFresh] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
 const navigation = useRef(0), operation = useRef(0)
 const invalidateNavigation = () => { navigation.current += 1; operation.current += 1; setBusy(false); setError('') }
 const todayId = dailyReadingId(now, timeZone)
 const active = readings.find(r => r.id === readingId) ?? (tab === 'daily' ? readings.find(r => r.id === todayId && !r.archived) : undefined)
 const session = sessions.find(s => s.id === sessionId && !s.completedReadingId && (s.spread !== 'daily' || s.dateKey === localDateKey(now, timeZone) && s.timeZone === timeZone)) ?? (!fresh && !active ? sessions.find(s => !s.completedReadingId && (tab === 'daily' ? s.spread === 'daily' && s.dateKey === localDateKey(now, timeZone) && s.timeZone === timeZone : tab === 'question' && s.spread !== 'daily')) : undefined)
 const spread = tab === 'daily' ? 'daily' : recommendedSpread(context)
 const selectedContext = active ? active.context ?? defaultTarotContext() : session?.context ?? context
 const positions = active?.contentVersion === '1' ? legacySpreadPositions(active.spread) : spreadPositions(active?.spread ?? session?.spread ?? spread, selectedContext)
 const fullSelection = session && session.selected.length === positions.length
 const perform = async (action: (navigationId: number) => Promise<unknown>) => {
  const navigationId = navigation.current, operationId = ++operation.current
  setBusy(true); setError('')
  try { await action(navigationId); return navigationId === navigation.current } catch (failure) {
   if (navigationId !== navigation.current || operationId !== operation.current) return false
   const detail = failure instanceof Error ? failure.message : ''
   setError(/date changed|previous day|expired/i.test(detail) ? text('日期已变化，这次未完成的选择属于前一天。回到今日入口，开始新一天的抽牌。', 'The date changed. This unfinished selection belongs to the previous day. Return to today’s entry to begin a new daily draw.') : text('操作尚未完成，已保存的牌和选择会保留。请检查连接后重试。', 'This step is not complete. Saved cards and choices are retained. Check your connection and retry.') + (detail === 'Reflection changed in another tab' ? text(' 心得已在另一处更新。', ' The reflection changed elsewhere.') : ''))
   return false
  } finally { if (navigationId === navigation.current && operationId === operation.current) setBusy(false) }
 }
 const finish = async (current: TarotSession, navigationId: number) => {
  const saved = await finishTarotSession(owner, current.id, buildTarotReports(current))
  if (navigationId === navigation.current) { setReadingId(saved.id); setSessionId(null) }
 }
 const pick = (index: number) => perform(async navigationId => {
  if (!session) return
  const next = await selectTarotCard(owner, session.id, index)
  if (next.selected.length === spreadPositions(next.spread, next.context).length) await finish(next, navigationId)
 })
 const begin = () => perform(async navigationId => {
  const ctx = spread === 'daily' ? { ...defaultTarotContext(), question: text('今天我可以留意什么？', 'What can I pay attention to today?') } : context
  if (validateTarotContext(ctx, spread)) throw new Error('Invalid question')
  const saved = await startTarotSession(owner, { spread, timeZone, reverse, question: ctx.question, context: ctx })
  if (navigationId === navigation.current) { setSessionId(saved.id); setReadingId(null); setFresh(false) }
 })
 const switchTab = (value: Tab) => { invalidateNavigation(); setTab(value); setReadingId(null); setSessionId(null); setFresh(false) }
 const allRevealed = active?.cards.every(c => c.revealed)
 return <>
  <SymbolicTabs value={tab} onChange={switchTab} items={[{ id: 'daily', label: text('每日一牌','Daily card') }, { id: 'question', label: text('带着问题抽牌','Ask a question') }, { id: 'history', label: text('我的记录','My readings') }, { id: 'library', label: text('78 张牌释义','78-card guide') }]}/>
  {error && <p className="symbolic-error" role="alert">{error}</p>}
  {(tab === 'daily' || tab === 'question') && <>
   <div className="tarot-controls"><span className="symbolic-eyebrow">{active ? spreadName(active.spread, language) : session ? spreadName(session.spread, language) : tab === 'daily' ? text('留给今天的一张牌','ONE CARD FOR TODAY') : text('先把问题说清楚','BEGIN WITH THE QUESTION')}</span><span className="symbolic-note">{active?.dateKey ?? localDateKey(now, timeZone)} · {active?.timeZone ?? timeZone}</span></div>
   {!active && !session && tab === 'question' && !review && <form className="symbolic-panel tarot-question-form" onSubmit={event => { event.preventDefault(); if (!validateTarotContext(context, spread)) setReview(true) }}>
    <fieldset><legend>{text('01 · 选择主题','01 · Choose a topic')}</legend><div className="tarot-topic-options">{(['general','career','money','love'] as const).map(topic => <button key={topic} type="button" aria-pressed={context.topic === topic} onClick={() => setContext({ ...context, topic, intent: context.intent === 'relationship' && topic !== 'love' ? 'action' : context.intent })}>{tarotTopicName(topic, language)}</button>)}</div></fieldset>
    <label>{text('02 · 你想问什么？','02 · What would you like to explore?')}<textarea required value={context.question} maxLength={300} rows={3} placeholder={text('例如：推进这个项目，我下一步该怎样做？','For example: What can I do next to move this project forward?')} onChange={event => setContext({ ...context, question: event.target.value })}/></label>
    <label>{text('03 · 这次更想看哪一面？','03 · What is the focus?')}<select value={context.intent} onChange={event => setContext({ ...context, intent: event.target.value as TarotContext['intent'] })}><option value="action">{text('看清阻力与下一步行动','Understand friction and the next step')}</option><option value="development">{text('观察事情发展的趋势','Explore a developing situation')}</option><option value="choice">{text('比较两个具体选项','Compare two specific options')}</option>{context.topic === 'love' && <option value="relationship">{text('理解关系中的相处模式','Understand relationship patterns')}</option>}</select></label>
    {context.intent === 'choice' && <div className="symbolic-form-grid"><label>{text('选项 A','Option A')}<input required maxLength={120} value={context.optionA} placeholder={text('例如：留在当前岗位','For example: Stay in the current role')} onChange={event => setContext({ ...context, optionA: event.target.value })}/></label><label>{text('选项 B','Option B')}<input required maxLength={120} value={context.optionB} placeholder={text('例如：接受新岗位','For example: Accept a new role')} onChange={event => setContext({ ...context, optionB: event.target.value })}/></label></div>}
    {context.intent === 'choice' && context.optionA.trim() && context.optionA.trim() === context.optionB.trim() && <p className="symbolic-error">{text('请填写两个不同的选项。','Enter two different options.')}</p>}
    <p className="symbolic-note">{text('解读按主题、问题方向与牌位展开。写具体一点，之后更容易用实际处境核对。','The reading uses your topic, question focus and card positions. A concrete question makes it easier to relate the result to real circumstances.')}</p>
    <button className="symbolic-button symbolic-button--primary" disabled={Boolean(validateTarotContext(context, spread))}>{text('查看推荐牌阵','See recommended spread')}<ArrowRight size={14}/></button>
   </form>}
   {!active && !session && (tab === 'daily' || review) && <section className="symbolic-panel tarot-spread-review">
    <div><span className="symbolic-eyebrow">{tab === 'daily' ? text('每日一牌','DAILY CARD') : text('为这个问题推荐','RECOMMENDED FOR YOUR QUESTION')}</span><h2>{spreadName(spread, language)}</h2><p>{tab === 'daily' ? text('亲手从 78 张牌中选出一张。今天首次抽取后固定，页面与 widget 显示同一张。','Choose one card yourself from all 78. Your first draw is fixed for today and shared by this page and the widget.') : context.question}</p></div>
    <ol className="tarot-position-outline">{positions.map((p, i) => <li key={p.role}><span>{String(i + 1).padStart(2, '0')}</span><div><strong>{p.name[language === 'zh' ? 0 : 1]}</strong><p>{p.purpose[language === 'zh' ? 0 : 1]}</p></div></li>)}</ol>
    <div className="symbolic-section-head"><label className="symbolic-check"><input type="checkbox" checked={reverse} onChange={event => setReverse(event.target.checked)}/>{text('包含逆位','Include reversals')}</label><div className="tarot-form-actions">{review && <button className="symbolic-button" disabled={busy} onClick={() => setReview(false)}>{text('修改问题','Edit question')}</button>}<button className="symbolic-button symbolic-button--primary" disabled={busy} onClick={() => void begin()}><Shuffle size={15}/>{busy ? text('正在洗牌与保存…','Shuffling and saving…') : text('确认并洗牌','Confirm and shuffle')}</button></div></div>
   </section>}
   {session && <section className="tarot-table tarot-selection-table">
    <div className="tarot-table-heading"><span className="symbolic-eyebrow">{text('牌已洗好，交给你的选择','SHUFFLED. YOUR CHOICE NOW.')}</span><h2>{session.context.question}</h2><p role="status" aria-live="polite">{fullSelection ? text('已选齐。保存完成后，就可以逐张翻开。','Selection complete. Once saved, reveal the cards one by one.') : text(`已选 ${session.selected.length} / ${positions.length} 张 · 接下来选择「${positions[session.selected.length].name[0]}」`, `${session.selected.length} / ${positions.length} selected · Next: ${positions[session.selected.length].name[1]}`)}</p></div>
    <div className="tarot-chosen-slots">{positions.map((p, i) => <div key={p.role} data-selected={i < session.selected.length}><span>{i < session.selected.length ? text('已选定','Selected') : String(i + 1).padStart(2,'0')}</span><strong>{p.name[language === 'zh' ? 0 : 1]}</strong></div>)}</div>
    {!fullSelection && <div className="tarot-deck-grid" aria-label={text('78 张牌背，按选择顺序放入牌阵','78 face-down cards; picks fill the spread in order')}>{session.deck.map((_, i) => <button key={i} className="tarot-deck-card" aria-label={text(`选择第 ${i + 1} 张牌`, `Choose card ${i + 1}`)} aria-pressed={session.selected.includes(i)} disabled={busy || session.selected.includes(i)} onClick={() => void pick(i)}><TarotArt back/><span>{session.selected.includes(i) ? '✓' : i + 1}</span></button>)}</div>}
    {fullSelection && <button className="symbolic-button tarot-table-button" disabled={busy} onClick={() => void perform(navigationId => finish(session, navigationId))}>{busy ? text('正在确认与保存…','Confirming and saving…') : text('保存牌阵，准备翻开','Save spread and continue')}</button>}
    {session.spread !== 'daily' && <button className="symbolic-button tarot-table-button" disabled={busy} onClick={() => { invalidateNavigation(); setSessionId(null); setReadingId(null); setFresh(true); setContext(defaultTarotContext()); setReview(false); setTab('question') }}>{text('暂存并开始新问题','Keep this and begin a new question')}</button>}
    <p className="symbolic-note tarot-selection-note">{text('选择会保存，刷新后可以继续；选中的牌不会因刷新而更换。','Selections are saved. Refreshing lets you continue without changing selected cards.')}</p>
   </section>}
   {active && <>
    <section className="tarot-table"><div className="tarot-table-heading"><span className="symbolic-eyebrow">{text('你的牌阵','YOUR SPREAD')}</span><h2>{active.question || text('今天我可以留意什么？','What can I pay attention to today?')}</h2><p>{text('按顺序逐张翻开。所有牌揭示后，阅读完整的综合解读。','Reveal the cards in order. The complete reading appears after all cards are revealed.')}</p></div>
     <div className={`tarot-spread tarot-spread--${active.cards.length}`}>{active.cards.map((entry, i) => { const card = tarotById.get(entry.id)!; const next = active.cards.findIndex(c => !c.revealed); return <div className="tarot-slot" key={i}><small>{positions[i]?.name[language === 'zh' ? 0 : 1]}</small><button className="tarot-card-button" disabled={busy || entry.revealed || next !== i} aria-label={entry.revealed ? `${cardName(card, language)} · ${entry.reversed ? text('逆位','Reversed') : text('正位','Upright')}` : text(`翻开第 ${i + 1} 张牌`, `Reveal card ${i + 1}`)} onClick={() => void perform(() => updateReading(owner, active.id, { reveal: i }))}><TarotArt card={entry.revealed ? card : undefined} back={!entry.revealed} reversed={entry.revealed && entry.reversed}/></button><strong>{entry.revealed ? cardName(card, language) : next === i ? text('轻触翻开','Tap to reveal') : text('稍后揭示','Reveal in order')}</strong><span>{entry.revealed ? entry.reversed ? text('逆位','Reversed') : text('正位','Upright') : ' '}</span></div> })}</div>
     {active.spread !== 'daily' && allRevealed && <button className="symbolic-button tarot-table-button" onClick={() => { invalidateNavigation(); setReadingId(null); setSessionId(null); setContext(defaultTarotContext()); setReview(false); setFresh(true); setTab('question') }}><RotateCcw size={14}/>{text('开始新的问题','Begin a new question')}</button>}
    </section>
    {active.spread === 'daily' && active.id !== todayId && <p className="symbolic-note">{text('你正在查看过去日期的日牌。','You are viewing a daily card from another date.')} <button className="symbolic-text-button" onClick={() => { invalidateNavigation(); setReadingId(null); setSessionId(null); setFresh(false); setTab('daily') }}>{text('回到今天','Return to today')}</button></p>}
    {active.spread === 'daily' && active.serverConfirmed === false && <p className="symbolic-note">{text('这张日牌目前只在本地保存；启用账号同步并连接成功后，才会与其他设备统一。','This daily card is currently stored locally. Enable account sync and connect to reconcile it across devices.')}</p>}
    {active.archived && <p className="symbolic-note">{text('这是保留的历史记录，不是账号当前的今日牌。','This is a retained history record, not the account’s current daily card.')}</p>}
    {active.contentVersion === '1' && <p className="symbolic-note">{text('旧版 V1 记录：保留当时牌面与简明释义，没有补写新版综合报告。','V1 record: original cards and concise meanings are preserved; no newer synthesis has been added.')}</p>}
    {active.cards.some(c => c.revealed) && !allRevealed && <section className="symbolic-panel tarot-reveal-preview">{active.cards.map((entry, i) => entry.revealed && <article key={i}><small>{positions[i]?.name[language === 'zh' ? 0 : 1]}</small><h3>{cardName(tarotById.get(entry.id)!, language)}</h3>{active.contentVersion === '1' ? <p>{cardMeaning(tarotById.get(entry.id)!, entry.reversed, language)}</p> : (active.reports?.[language].sections.find(section => section.id === `card-${i}`)?.paragraphs ?? [text('原报告未保存此牌位内容。','The original report has no saved text for this position.')]).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</article>)}</section>}
    {allRevealed && <section className="symbolic-panel">{active.reports?.[language] ? <ReportView report={active.reports[language]}/> : <div className="tarot-readings">{active.cards.map((entry, i) => <article key={i}><h3>{cardName(tarotById.get(entry.id)!, language)}</h3><p>{cardMeaning(tarotById.get(entry.id)!, entry.reversed, language)}</p></article>)}</div>}<Reflection key={`${owner}:${active.id}`} reading={active} busy={busy} save={(value, base) => perform(() => updateReading(owner, active.id, { reflection: value, expectedReflection: base }))}/></section>}
   </>}
   <details className="symbolic-panel symbolic-prose"><summary>{text('抽牌规则与解读方式','Draw rules and interpretation')}</summary><p>{text('78 张完整牌组，密码学随机数等概率洗牌，一次牌阵不重复。开启逆位时，每张牌独立有 50% 概率为逆位，这是本产品的抽牌约定。','All 78 cards are shuffled using unbiased cryptographic randomness, without repeats within a spread. When reversals are enabled, each card has an independent 50% chance of reversal; this is the product’s draw convention.')}</p><p>{text('账号时区决定每日牌的日期。开启同步后，日牌须先经服务器确认再揭示；不同设备冲突时保留历史，并以账号确认的今日牌为准。','The account time zone defines each daily card’s date. With sync enabled, the server confirms the daily card before reveal. Conflicting device draws are retained in history while the account-confirmed card is used for today.')}</p><p>{text('牌义采用伟特体系参考，按主题、意图、牌位和牌间关系组合；自由问题仅用有限方向词辅助，不调用 AI。中文释义与场景线描为原创编辑内容，英文牌义参考 MIT 授权 Tarotoo 数据集。牌图为原创象征场景，并非原版伟特图像。','Waite-informed meanings are composed by topic, intent, position and relationships between cards. Free-text questions use limited focus-word hints, with no AI calls. Chinese copy and symbolic line-art scenes are original; English meaning references include the MIT-licensed Tarotoo dataset. These are original symbolic illustrations, not original Waite images.')}</p></details>
  </>}
  {tab === 'history' && <section className="symbolic-panel"><h2>{text('留下的片刻','Moments you kept')}</h2>{sessions.some(s => !s.completedReadingId && s.spread !== 'daily') && <div className="tarot-history"><h3>{text('还未完成的问题','Questions in progress')}</h3>{sessions.filter(s => !s.completedReadingId && s.spread !== 'daily').map(s => <button key={s.id} onClick={() => { invalidateNavigation(); setSessionId(s.id); setReadingId(null); setFresh(true); setTab('question') }}><span>{s.dateKey} · {spreadName(s.spread, language)}</span><strong>{s.context.question}</strong><small>{text(`已选 ${s.selected.length} / ${spreadPositions(s.spread, s.context).length} 张 · 继续选择`, `${s.selected.length} / ${spreadPositions(s.spread, s.context).length} selected · Continue`)}</small></button>)}</div>}{readings.length ? <div className="tarot-history">{readings.map(r => <button key={r.id} onClick={() => { invalidateNavigation(); setReadingId(r.id); setSessionId(null); setFresh(true); setTab(r.spread === 'daily' ? 'daily' : 'question') }}><span>{r.dateKey} · {spreadName(r.spread, language)}{r.contentVersion === '1' ? ' · V1' : ''}{r.archived ? text(' · 历史保留',' · Archived') : ''}</span><strong>{r.question || r.cards.map(c => c.revealed ? cardName(tarotById.get(c.id)!, language) : text('未翻开','Unrevealed')).join(' / ')}</strong><small>{r.timeZone} · {r.cards.filter(c => c.revealed).length}/{r.cards.length} {text('已翻开','revealed')}{r.reflection ? text(' · 有心得',' · Reflection saved') : ''}</small></button>)}</div> : <div className="symbolic-empty"><BookOpen size={30}/><p>{text('完成抽牌后，问题、牌阵与当时的解读会自动保存在这里。','Your question, cards and interpretation at the time are saved here automatically.')}</p><button className="symbolic-button" onClick={() => switchTab('question')}>{text('开始一个问题','Begin a question')}</button></div>}</section>}
  {tab === 'library' && <TarotLibrary/>}
 </>
}
function Reflection({ reading, busy, save }: { reading: TarotReading; busy: boolean; save: (value: string, base: string) => Promise<boolean> }) {
 const { text } = useSymbolicCopy()
 const [draft, setDraft] = useState<{ value: string; base: string } | null>(null), [saved, setSaved] = useState(false)
 const value = draft?.value ?? reading.reflection
 const conflict = draft !== null && draft.base !== reading.reflection
 return <form className="tarot-reflection" onSubmit={event => { event.preventDefault(); if (conflict) return; void save(value, draft?.base ?? reading.reflection).then(ok => { if (ok) { setDraft(null); setSaved(true) } }) }}><label>{text('写下自己的理解与后续心得','Your reflection and later observations')}<textarea value={value} maxLength={3000} rows={3} onChange={event => { setDraft({ value: event.target.value, base: draft?.base ?? reading.reflection }); setSaved(false) }} placeholder={text('这次解读中，哪些符合实际？行动后有什么变化？','What fits the actual situation? What changed after taking action?')}/></label>{conflict && <p role="alert">{text('这条心得已在其他位置更新，当前草稿仍保留。请核对后再保存。','This reflection changed elsewhere. Your draft is retained; review before saving.')} <button type="button" className="symbolic-text-button" onClick={() => setDraft(null)}>{text('使用最新内容','Use latest text')}</button></p>}<button className="symbolic-button" disabled={busy || conflict || value.trim() === reading.reflection}>{busy ? text('保存中…','Saving…') : text('保存心得','Save reflection')}</button>{saved && !draft && <span role="status">{text('已保存','Saved')}</span>}</form>
}
function TarotLibrary() {
 const { text, language } = useSymbolicCopy()
 const [query, setQuery] = useState(''), [reverse, setReverse] = useState(false)
 const [topic, setTopic] = useState<TarotContext['topic']>('general')
 const filtered = TAROT_DECK.filter(card => card.name.join(' ').toLowerCase().includes(query.toLowerCase()))
 return <section className="symbolic-panel"><div className="symbolic-section-head"><div><h2>{text('牌义手册','The card guide')}</h2><p className="symbolic-note">{text('22 张大阿尔卡那 · 56 张小阿尔卡那','22 Major Arcana · 56 Minor Arcana')}</p></div><label className="symbolic-check"><input type="checkbox" checked={reverse} onChange={event => setReverse(event.target.checked)}/>{text('阅读逆位','Read reversals')}</label></div><div className="tarot-library-controls"><input className="tarot-search" aria-label={text('搜索牌名','Search card names')} placeholder={text('搜索牌名…','Search cards…')} value={query} onChange={event => setQuery(event.target.value)}/><select aria-label={text('解读主题','Interpretation topic')} value={topic} onChange={event => setTopic(event.target.value as TarotContext['topic'])}>{(['general','career','money','love'] as const).map(item => <option key={item} value={item}>{tarotTopicName(item, language)}</option>)}</select></div><div className="tarot-library">{filtered.map(card => { const semantic = cardSemantics({ id: card.id, reversed: reverse }, { ...defaultTarotContext(), topic }, language); return <article key={card.id}><TarotArt card={card} reversed={reverse}/><div><small>{card.arcana === 'major' ? text('大阿尔卡那','Major Arcana') : text('小阿尔卡那','Minor Arcana')}</small><h3>{cardName(card, language)}</h3><p>{semantic.meaning}</p><p>{semantic.domain}</p></div></article> })}</div>{!filtered.length && <p>{text('没有找到匹配的牌名。','No matching cards.')}</p>}</section>
}
