import type { ComponentType } from 'react'
import { BookOpen, Coffee, CupSoda, Disc3, Flame, Keyboard, Laptop, Plus, Sprout, StickyNote, Timer, X, PanelsTopLeft, Frame } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslationKey } from '../../../shared/i18n/types'
import { DESK_PROPS, type DeskItem, type DeskPropId } from './deskTypes'

const ICONS: Record<DeskPropId, ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  book: BookOpen,
  laptop: Laptop,
  typewriter: Keyboard,
  record: Disc3,
  coffee: Coffee,
  cola: CupSoda,
  plant: Sprout,
  timer: Timer,
  candle: Flame,
  window: PanelsTopLeft,
  frame: Frame,
}

type Props = {
  items: DeskItem[]
  note: boolean
  onAdd: (kind: DeskPropId) => void
  onRemove: (id: string) => void
  onClear: () => void
  onNote: (on: boolean) => void
  /** The prop whose chip is pointed at, so the desk can show which one it is. */
  onHighlight: (id: string | null) => void
}

/**
 * What stands on the desk: every prop can be added, as many times as you
 * like (each drops in at the free spot nearest the middle); what's already
 * there is listed left to right, each with a way to take it off. Plus the
 * sticky note on the lamp, and how to move things on the desk itself.
 */
const DeskPicker = ({ items, note, onAdd, onRemove, onClear, onNote, onHighlight }: Props) => {
  const { t } = useI18n()
  const label = (kind: DeskPropId) => t(`dashboard.desk.prop.${kind}` as TranslationKey)
  const standing = [...items].sort((a, b) => a.x - b.x)
  return (
    <div className="desk-picker">
      <div className="desk-picker__row">
        <span className="desk-picker__label" id="desk-picker-add">{t('dashboard.desk.add')}</span>
        <div className="desk-picker__options" role="group" aria-labelledby="desk-picker-add">
          {DESK_PROPS.map((kind) => {
            const Icon = ICONS[kind]
            return (
              <button key={kind} type="button" className="desk-picker__option" onClick={() => onAdd(kind)}>
                <Icon size={14} aria-hidden />
                <span>{label(kind)}</span>
                <Plus size={12} aria-hidden className="desk-picker__mark" />
              </button>
            )
          })}
        </div>
      </div>
      <div className="desk-picker__row">
        <span className="desk-picker__label" id="desk-picker-on">{t('dashboard.desk.onDesk')}</span>
        <div className="desk-picker__options" role="group" aria-labelledby="desk-picker-on" onPointerLeave={() => onHighlight(null)}>
          {standing.length === 0 ? <span className="desk-picker__empty">{t('dashboard.desk.empty')}</span> : null}
          {standing.map((item) => {
            const Icon = ICONS[item.kind]
            const name = label(item.kind)
            return (
              <button
                key={item.id}
                type="button"
                className="desk-picker__option desk-picker__option--placed"
                aria-label={t('dashboard.desk.remove', { name })}
                title={t('dashboard.desk.remove', { name })}
                onClick={() => {
                  onHighlight(null)
                  onRemove(item.id)
                }}
                onPointerEnter={() => onHighlight(item.id)}
                onFocus={() => onHighlight(item.id)}
                onBlur={() => onHighlight(null)}
              >
                <Icon size={14} aria-hidden />
                <span>{name}</span>
                <X size={12} aria-hidden className="desk-picker__mark" />
              </button>
            )
          })}
          {standing.length > 1 ? (
            <button type="button" className="desk-picker__clear" onClick={onClear}>
              {t('dashboard.desk.clear')}
            </button>
          ) : null}
        </div>
      </div>
      <div className="desk-picker__row">
        <span className="desk-picker__label">{t('dashboard.desk.lamp')}</span>
        <div className="desk-picker__options">
          <button type="button" className="desk-picker__option" aria-pressed={note} onClick={() => onNote(!note)}>
            <StickyNote size={14} aria-hidden />
            <span>{t('dashboard.desk.prop.note')}</span>
          </button>
        </div>
      </div>
      <p className="desk-picker__hint">{t('dashboard.desk.hint')}</p>
      <a className="desk-picker__hint" href="/licenses/desk-models.txt" target="_blank" rel="noreferrer">{t('dashboard.desk.credits')}</a>
    </div>
  )
}

export default DeskPicker
