import { SlidersHorizontal } from 'lucide-react'
import { useI18n } from '../../shared/i18n/useI18n'

export const SalarySettingsButton = ({ onClick }: { onClick: () => void }) => {
  const { t } = useI18n()
  return (
    <button type="button" className="salary-icon-btn" onClick={onClick} aria-label={t('salary.settings.open')} title={t('salary.settings.open')}>
      <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden="true" />
    </button>
  )
}

/** Shown until pay and hours are filled in: one line, one sentence, one action. */
export const SalarySetup = ({ body, onSetup }: { body: string; onSetup: () => void }) => {
  const { t } = useI18n()
  return (
    <div className="salary-setup">
      <p className="salary-setup__title">{t('salary.setup.title')}</p>
      <p className="salary-setup__body">{body}</p>
      <button type="button" className="salary-btn salary-btn--outline" onClick={onSetup}>
        {t('salary.setup.action')}
      </button>
    </div>
  )
}

/** A duration with set-type numerals and small units: 21 小时 27 分钟. */
export const DurationFigure = ({ seconds, className }: { seconds: number; className?: string }) => {
  const { t } = useI18n()
  const total = Math.floor(seconds / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return (
    <span className={`salary-figure ${className ?? ''}`}>
      {h > 0 ? (
        <>
          <span className="salary-figure__num">{h}</span>
          <span className="salary-figure__unit">{t('salary.unit.h')}</span>
        </>
      ) : null}
      {m > 0 || h === 0 ? (
        <>
          <span className="salary-figure__num">{m}</span>
          <span className="salary-figure__unit">{t('salary.unit.m')}</span>
        </>
      ) : null}
    </span>
  )
}
