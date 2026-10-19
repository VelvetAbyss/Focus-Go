import { Temporal } from '@js-temporal/polyfill'
import type { InterpretationReport } from './report'
import { TOPICS, topicName } from './report'
import { useSymbolicCopy } from './useSymbolic'

export function ScoreStrip({ report, compact = false }: { report: InterpretationReport; compact?: boolean }) {
  const { language, text } = useSymbolicCopy()
  if (!report.scores) return null
  return <div className={compact ? 'symbolic-widget__scores' : 'reading-scores'} aria-label={text('今日分项评分', 'Daily theme scores')}>
    {TOPICS.map(topic => {
      const score = report.scores?.[topic]
      return <div key={topic}><span>{topicName(topic, language)}</span><strong>{score ?? '—'}</strong>{!compact && <><div className="reading-score-track"><i style={{ width: (score ?? 0) + '%' }}/></div><small>{score === null ? text('资料或依据待补', 'More evidence needed') : text('规则倾向 / 100', 'Rule scale / 100')}</small></>}</div>
    })}
  </div>
}

function periodBoundary(value: string, zone?: string) {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const offset = value.match(/([+-]\d{2}:\d{2})$/)?.[1]
    return Temporal.Instant.from(value).toZonedDateTimeISO(zone ?? offset ?? 'UTC').toPlainDateTime().toString({ smallestUnit: 'second' }).replace('T', ' ')
  } catch { return value }
}

export function ReportView({ report, daily = false }: { report: InterpretationReport; daily?: boolean }) {
  const { text } = useSymbolicCopy()
  return <div className={'reading-report ' + (daily ? 'reading-report--daily' : '')}>
    <header className="reading-lead">
      {report.period && <span className="symbolic-eyebrow">{report.period.label}</span>}
      <h2>{report.title}</h2>
      <p>{report.summary}</p>
      {report.period && <p className="reading-period">{periodBoundary(report.period.start,report.period.timeZone)} → {periodBoundary(report.period.end,report.period.timeZone)}{report.period.timeZone?' · '+report.period.timeZone:''} · {text('截至结束时刻前','Ends just before the final time')}</p>}
    </header>
    <ScoreStrip report={report}/>
    {(report.dos.length > 0 || report.donts.length > 0) && <div className="reading-actions">
      <div><h3>{text('宜 · 可以着手', 'Try · A place to begin')}</h3><ul>{report.dos.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
      <div><h3>{text('忌 · 留意分寸', 'Watch · Keep perspective')}</h3><ul>{report.donts.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
    </div>}
    {report.limitations.length > 0 && <details className="reading-limits"><summary>{text('本次结果的适用范围', 'Scope of this reading')}</summary><ul>{report.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}
    <div className="reading-chapters">
      {report.sections.map((section, index) => <article key={section.id} className="reading-chapter">
        <span className="reading-chapter-number">{String(index + 1).padStart(2, '0')}</span>
        <div><h3>{section.title}</h3><p className="reading-chapter-summary">{section.summary}</p>
          {section.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          {section.suggestions.length > 0 && <ul className="reading-suggestions">{section.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>}
          {section.evidence.length > 0 && <details><summary>{text('查看解读依据', 'Reading evidence')}</summary><ul>{section.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></details>}
        </div>
      </article>)}
    </div>
    <details className="symbolic-panel symbolic-prose"><summary>{text('方法与版本', 'Method and version')}</summary><p>{report.version}</p><ul>{report.method.map((item, i) => <li key={i}>{item}</li>)}</ul>{report.scores && <p>{text('分数表示本页规则下的相对倾向，不是事件发生概率。', 'Scores express relative tendencies within this rule set, not probabilities of events.')}</p>}</details>
  </div>
}

export function WidgetReport({ report }: { report: InterpretationReport }) {
  const { text } = useSymbolicCopy()
  return <><ScoreStrip report={report} compact/><p className="symbolic-widget__summary">{report.summary}</p><div className="symbolic-widget__advice">{report.dos[0] && <p><b>{text('宜', 'Try')}</b>{report.dos[0]}</p>}{report.donts[0] && <p><b>{text('忌', 'Watch')}</b>{report.donts[0]}</p>}</div></>
}
