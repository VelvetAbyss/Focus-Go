import { CheckSquare, ChevronDown, ChevronRight, ChevronUp, Flame, List, PenLine, Timer, Type, X } from 'lucide-react'
import { useState } from 'react'
import Dialog from '../../../shared/ui/Dialog'
import { AppNumber } from '../../../shared/ui/AppNumber'
import type { DailyReviewPresentationModel } from '../cards/lifeDesignAdapters'
import { iconButtonStyle, inter, modalHeaderStyle, modalLayoutStyle, mutedText, playfair, sectionBorder } from './lifeDesignPrimitives'

type RangeKey = 'week' | 'month'

type Props = {
  model: DailyReviewPresentationModel
  open: boolean
  activeRange: RangeKey
  onOpen: () => void
  onClose: () => void
  onRangeChange: (value: RangeKey) => void
}

const iconMap = {
  tasks: CheckSquare,
  subtasks: List,
  focus: Timer,
  diary: PenLine,
  notes: Type,
  stay: Flame,
} as const

export const DailyReviewCardSurface = ({ model, open, activeRange, onOpen, onClose, onRangeChange }: Props) => {
  const detail = model.detailRanges[activeRange]
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({})

  return (
    <>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: 24,
          cursor: 'pointer',
          background: '#ffffff',
          border: '1px solid transparent',
          boxShadow: '0 12px 28px rgba(58, 55, 51, 0.08)',
        }}
        onClick={onOpen}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid rgba(58,55,51,0.07)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <CheckSquare size={13} color="rgba(58,55,51,0.38)" />
              <span style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{model.header.eyebrow}</span>
            </div>
            <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>{model.header.title}</h3>
          </div>
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, color: 'rgba(58,55,51,0.38)', marginTop: 2 }}>
            <ChevronRight size={15} />
          </div>
        </div>

        <div style={{ padding: '20px 20px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: 12, rowGap: 20, marginBottom: 20 }}>
            {model.todayMetrics.map((item) => {
              const Icon = iconMap[item.key as keyof typeof iconMap]
              return (
                <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={11} color="rgba(58,55,51,0.32)" strokeWidth={2} />
                  </div>
                  <span style={{ ...inter(9, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{item.label}</span>
                  <div style={{ ...inter(20, 600, item.value === '—' ? 'rgba(58,55,51,0.22)' : '#3A3733'), letterSpacing: '-0.02em', lineHeight: 1 }} className="tabular-nums">
                    {typeof item.value === 'number' ? <AppNumber value={item.value} animated /> : item.value}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ height: 1, background: 'rgba(58,55,51,0.06)', marginBottom: 16 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.38)'), letterSpacing: '0.02em' }}>
              {activeRange === 'week' ? 'Last 7 days' : 'Last 30 days'}
            </p>
            <p style={{ ...inter(10, 500, 'rgba(58,55,51,0.28)'), letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              View review
            </p>
          </div>
        </div>
      </div>

      <Dialog open={open} onClose={onClose} panelClassName="life-modal__panel" contentClassName="life-modal__content">
        <div style={modalLayoutStyle}>
          <div style={modalHeaderStyle}>
            <div>
              <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.40)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>Review</p>
              <h2 style={playfair(26, 500)}>{model.header.title}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={iconButtonStyle}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '16px 24px 0' }}>
            <div style={{ display: 'inline-flex', padding: 4, borderRadius: 14, background: 'rgba(58,55,51,0.06)', border: '1px solid rgba(58,55,51,0.08)' }}>
              {(['week', 'month'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => onRangeChange(range)}
                  style={{
                    ...inter(12, activeRange === range ? 600 : 500, activeRange === range ? '#FDFAF7' : 'rgba(58,55,51,0.48)'),
                    border: 'none',
                    borderRadius: 10,
                    background: activeRange === range ? '#3A3733' : 'transparent',
                    padding: '8px 16px',
                    cursor: 'pointer',
                  }}
                >
                  {range === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', minHeight: 0, flex: 1, marginTop: 16, borderTop: `1px solid ${sectionBorder}` }}>
            <div style={{ borderRight: `1px solid ${sectionBorder}`, padding: 24, overflowY: 'auto' }}>
              <p style={{ ...inter(10, 500, 'rgba(58,55,51,0.30)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 16 }}>
                {activeRange === 'week' ? '7 days summary' : '30 days summary'}
              </p>
              <div style={{ display: 'grid' }}>
                {detail.summary.map((item) => {
                  const Icon = iconMap[item.key as keyof typeof iconMap]
                  return (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: item.key === detail.summary[detail.summary.length - 1]?.key ? 'none' : '1px solid rgba(58,55,51,0.09)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(58,55,51,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={14} color="rgba(58,55,51,0.55)" />
                        </div>
                        <div>
                          <p style={{ ...inter(12, 500) }}>{item.label}</p>
                          {item.sub ? <p style={{ ...inter(10, 400, mutedText), marginTop: 2 }}>{item.sub}</p> : null}
                        </div>
                      </div>
                      <div style={{ ...playfair(20, 600), letterSpacing: '-0.03em' }}>
                        {typeof item.value === 'number' ? <AppNumber value={item.value} animated /> : item.value}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 20px', borderBottom: `1px solid ${sectionBorder}` }}>
                <div>
                  <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.40)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>Completed</p>
                  <h3 style={playfair(20, 500)}>Completed Tasks</h3>
                </div>
                <span style={{ ...inter(11, 500, mutedText), background: 'rgba(58,55,51,0.07)', borderRadius: 999, padding: '4px 10px' }}>{detail.tasks.length}</span>
              </div>

              <div
                data-testid="daily-review-tasks-scroll"
                style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {detail.tasks.length === 0 ? (
                  <div style={{ display: 'flex', minHeight: 220, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 999, background: 'rgba(58,55,51,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckSquare size={18} color="rgba(58,55,51,0.22)" />
                    </div>
                    <p style={{ ...playfair(15, 500, 'rgba(58,55,51,0.45)'), marginBottom: 6 }}>No completed tasks</p>
                    <p style={inter(12, 400, 'rgba(58,55,51,0.35)')}>No completed tasks in this range.</p>
                  </div>
                ) : (
                  detail.tasks.map((task) => (
                    <article key={task.id} style={{ minHeight: 74, borderRadius: 18, background: '#FDFAF7', border: '1px solid rgba(58,55,51,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setExpandedTaskIds((current) => ({ ...current, [task.id]: !(current[task.id] ?? true) }))}
                        style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 12, padding: '16px 18px', border: 'none', background: 'transparent', cursor: task.subtasks.length > 0 ? 'pointer' : 'default', textAlign: 'left' }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, background: '#6EAB7A', border: '1px solid rgba(110,171,122,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckSquare size={9} color="white" strokeWidth={2.5} />
                            </div>
                            <p style={{ ...playfair(14, 500) }}>{task.title}</p>
                          </div>
                          <p style={inter(11, 400, mutedText)}>{task.completedLabel}{task.subtasks.length ? ` · ${task.subtasks.length} subtasks` : ''}</p>
                        </div>
                        {task.subtasks.length > 0 ? ((expandedTaskIds[task.id] ?? true) ? <ChevronUp size={14} color="rgba(58,55,51,0.30)" /> : <ChevronDown size={14} color="rgba(58,55,51,0.30)" />) : null}
                      </button>
                      {(expandedTaskIds[task.id] ?? true) ? <div style={{ padding: '14px 18px', display: 'grid', gap: 10, borderTop: `1px solid ${sectionBorder}` }}>
                        {task.subtasks.length === 0 ? <p style={inter(12, 400, mutedText)}>No subtasks</p> : task.subtasks.map((subtask) => (
                          <div key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 14, height: 14, borderRadius: 4, background: subtask.done ? 'rgba(110,171,122,0.15)' : 'rgba(58,55,51,0.06)', border: `1px solid ${subtask.done ? 'rgba(110,171,122,0.25)' : 'rgba(58,55,51,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {subtask.done ? <CheckSquare size={7} color="#6EAB7A" strokeWidth={2.5} /> : null}
                            </div>
                            <span style={inter(13, 400, subtask.done ? '#3A3733' : mutedText)}>{subtask.title}</span>
                          </div>
                        ))}
                      </div> : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}
