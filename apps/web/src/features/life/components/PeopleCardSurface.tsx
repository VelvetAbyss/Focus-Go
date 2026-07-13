import { ChevronRight, Plus, Trash2, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Dialog from '../../../shared/ui/Dialog'
import type { LifePerson } from '../../../data/models/types'
import type { PeoplePresentationModel } from '../cards/lifeDesignAdapters'
import {
  cardArrowStyle,
  cardHeaderStyle,
  cardShellStyle,
  dangerButtonStyle,
  detailPaneStyle,
  Field,
  iconButtonStyle,
  inputStyle,
  inter,
  LifeCardLoader,
  modalHeaderStyle,
  modalLayoutStyle,
  mutedText,
  paper,
  playfair,
  sidebarStyle,
  smallButtonStyle,
  textareaStyle,
} from './lifeDesignPrimitives'
import { useLifeI18n } from '../lifeI18n'

type PersonDraft = {
  name: string
  group: LifePerson['group']
  category: string
  role: string
  city: string
  email: string
  phone: string
  birthday: string
  lastInteraction: string
  notes: string
  avatarInitials: string
  avatarColor: string
}

type Props = {
  model: PeoplePresentationModel
  items: LifePerson[]
  selected: LifePerson | null
  selectedId: string | null
  open: boolean
  loading: boolean
  onOpen: () => void
  onClose: () => void
  onSelectItem: (id: string) => void
  onSaveItem: (draft: PersonDraft, id?: string | null) => void
  onRemoveItem: (id: string) => void
}

const groups: LifePerson['group'][] = ['Family', 'Friends', 'Work', 'Community', 'Other']

const groupColorMap: Record<LifePerson['group'], string> = {
  Family: '#F4D4BF',
  Friends: '#D7C6E0',
  Work: '#BDD3E4',
  Community: '#CBE0C3',
  Other: '#D8CFC7',
}

const avatarColorPalette = [
  '#F4D4BF', '#D7C6E0', '#BDD3E4', '#CBE0C3', '#D8CFC7',
  '#F2E2C4', '#C9E0D5', '#E8C9C9', '#D4DFB0', '#C5C9E4',
]

const primarySaveStyle = {
  ...smallButtonStyle,
  background: 'var(--text-primary)',
  color: 'var(--bg-elevated)',
  border: '1px solid var(--text-primary)',
  fontWeight: 600 as const,
  padding: '8px 16px',
}

const toDraft = (person?: LifePerson | null): PersonDraft => ({
  name: person?.name ?? '',
  group: person?.group ?? 'Friends',
  category: person?.category ?? '',
  role: person?.role ?? '',
  city: person?.city ?? '',
  email: person?.email ?? '',
  phone: person?.phone ?? '',
  birthday: person?.birthday ?? '',
  lastInteraction: person?.lastInteraction ?? '',
  notes: person?.notes ?? '',
  avatarInitials: person?.avatarInitials ?? '',
  avatarColor: person?.avatarColor ?? '#D8CFC7',
})

export const PeopleCardSurface = ({
  model,
  items,
  selected,
  selectedId,
  open,
  loading,
  onOpen,
  onClose,
  onSelectItem,
  onSaveItem,
  onRemoveItem,
}: Props) => {
  const { t } = useLifeI18n()
  const [draft, setDraft] = useState<PersonDraft>(toDraft(selected))
  const [editingId, setEditingId] = useState<string | null>(selectedId)
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [quickName, setQuickName] = useState('')
  const [quickGroup, setQuickGroup] = useState<LifePerson['group']>('Friends')
  const editingPerson = editingId ? items.find((item) => item.id === editingId) ?? null : null

  const categories = ['All', ...Array.from(new Set(items.map((item) => item.category?.trim()).filter(Boolean) as string[]))]
  const visibleRows = model.rows.filter((row) => categoryFilter === 'All' || row.category === categoryFilter)
  const visibleItems = items.filter((item) => categoryFilter === 'All' || item.category === categoryFilter)

  useEffect(() => {
    setDraft(toDraft(selected))
    setEditingId(selectedId)
  }, [selected, selectedId])

  return (
    <>
      <div onClick={onOpen} style={cardShellStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Users size={13} color="color-mix(in srgb, var(--text-primary) 38%, transparent)" />
              <span style={{ ...inter(10, 600, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{t('life.card.people')}</span>
            </div>
            <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>{t('life.card.people')}</h3>
          </div>
          <div style={cardArrowStyle}><ChevronRight size={15} /></div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '12px 16px' }}>
          {loading ? (
            <LifeCardLoader />
          ) : visibleRows.length ? (
            <div className="life-card-preview">
              {categories.length > 1 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 4px 10px' }}>
                  {categories.map((category) => (
                    <button key={category} type="button" onClick={(event) => { event.stopPropagation(); setCategoryFilter(category) }} style={{ ...smallButtonStyle, background: categoryFilter === category ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : 'color-mix(in srgb, var(--text-primary) 6%, transparent)', padding: '4px 10px' }}>
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}
              {visibleRows.slice(0, 3).map((person, index) => (
              <div key={person.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: person.avatarColor, border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...inter(13, 500, 'color-mix(in srgb, var(--text-primary) 70%, transparent)'), flexShrink: 0 }}>
                    {person.avatarInitials}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ ...inter(13, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</p>
                      <span style={{ ...inter(9, 500, 'var(--text-primary)'), background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', borderRadius: 999, padding: '2px 8px' }}>{person.group}</span>
                      {person.category ? <span style={{ ...inter(9, 500, 'var(--text-primary)'), background: 'rgba(212,136,43,0.10)', borderRadius: 999, padding: '2px 8px' }}>{person.category}</span> : null}
                    </div>
                    <p style={{ ...inter(11, 400, person.birthdaySoon ? '#8C7355' : mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.secondary}</p>
                  </div>
                </div>
                {index < Math.min(visibleRows.length, 3) - 1 ? <div style={{ height: 1, background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)', marginLeft: 50 }} /> : null}
              </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', minHeight: 180, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 999, background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color="color-mix(in srgb, var(--text-primary) 30%, transparent)" />
              </div>
              <p style={{ ...playfair(14, 500), marginBottom: 6 }}>{t('life.people.emptyTitle')}</p>
              <p style={{ ...inter(12, 400, mutedText), lineHeight: 1.6, marginBottom: 18 }}>{t('life.people.emptyDescription')}</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ ...smallButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={11} />
                <span>{t('life.people.addPerson')}</span>
              </button>
            </div>
          )}
        </div>
        <form
          className="life-quick-add life-quick-add--people"
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault()
            const name = quickName.trim()
            if (!name) return
            onSaveItem({
              ...toDraft(null),
              name,
              group: quickGroup,
              category: categoryFilter === 'All' ? '' : categoryFilter,
            })
            setQuickName('')
          }}
        >
          <div className="life-quick-add__bar">
            <span className="life-quick-add__label">{t('life.people.addPerson')}</span>
            <input
              className="life-quick-add__input"
              value={quickName}
              onChange={(event) => setQuickName(event.target.value)}
              placeholder={t('life.people.name')}
            />
            <button type="submit" className="life-quick-add__action">
              <Plus size={11} />
              <span>{t('life.people.addPerson')}</span>
            </button>
          </div>
          <div className="life-quick-add__meta-row">
            <div className="life-quick-add__segments" role="group" aria-label={t('life.people.group')}>
              {groups.slice(0, 4).map((group) => (
                <button
                  key={group}
                  type="button"
                  className={`life-quick-add__segment${quickGroup === group ? ' is-active' : ''}`}
                  onClick={() => setQuickGroup(group)}
                  style={{
                    background: quickGroup === group ? groupColorMap[group] : 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                  }}
                >
                  {group}
                </button>
              ))}
            </div>
            <p className="life-quick-add__stats">{model.statsLabel}</p>
          </div>
        </form>
      </div>

      {open ? <Dialog open={open} onClose={onClose} panelClassName="life-modal__panel" contentClassName="life-modal__content">
        <div style={modalLayoutStyle}>
          {/* Modal header */}
          <div style={modalHeaderStyle}>
            <div>
              <p style={{ ...inter(10, 600, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
                {items.length > 0 ? t('life.people.count', { count: items.length }) : t('life.people.title')}
              </p>
              <h2 style={{ ...playfair(22, 500) }}>{t('life.people.title')}</h2>
            </div>
            <button type="button" onClick={onClose} style={iconButtonStyle}><X size={18} /></button>
          </div>

          <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
            {/* Sidebar */}
            <aside style={sidebarStyle}>
              <button
                type="button"
                onClick={() => { setDraft({ ...toDraft(null), category: categoryFilter === 'All' ? '' : categoryFilter }); setEditingId(null) }}
                style={{ ...smallButtonStyle, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={11} />
                <span>{t('life.people.newPerson')}</span>
              </button>

              {categories.length > 1 ? (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                  {categories.map((category) => (
                    <button key={category} type="button" onClick={() => setCategoryFilter(category)}
                      style={{ ...smallButtonStyle, padding: '4px 10px', background: categoryFilter === category ? 'color-mix(in srgb, var(--text-primary) 12%, transparent)' : 'color-mix(in srgb, var(--text-primary) 5%, transparent)' }}>
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}

              <div style={{ display: 'grid', gap: 3 }}>
                {visibleItems.map((item) => {
                  const isActive = selectedId === item.id
                  return (
                    <div key={item.id} className="life-sidebar-item">
                      <button
                        type="button"
                        onClick={() => { setEditingId(item.id); onSelectItem(item.id) }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '9px 10px',
                          paddingRight: 36,
                          borderRadius: 14,
                          border: isActive ? '1px solid color-mix(in srgb, var(--text-primary) 13%, transparent)' : '1px solid transparent',
                          background: isActive ? 'var(--bg-elevated)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.07)' : 'none',
                        }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: item.avatarColor ?? '#D8CFC7',
                          border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...inter(12, 600, 'color-mix(in srgb, var(--text-primary) 65%, transparent)'),
                          flexShrink: 0,
                          letterSpacing: '0.02em',
                        }}>
                          {item.avatarInitials || item.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ ...inter(12, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                          <p style={{ ...inter(10, 400, mutedText), marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.category ?? item.group}{item.role ? ` · ${item.role}` : ''}
                          </p>
                        </div>
                        {item.group ? (
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: groupColorMap[item.group],
                            border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)',
                            flexShrink: 0,
                          }} />
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="life-sidebar-item__delete"
                        title="Remove"
                        onClick={(event) => { event.stopPropagation(); onRemoveItem(item.id) }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </aside>

            {/* Detail pane */}
            <div style={{ ...detailPaneStyle, background: paper, padding: '20px 24px', overflowY: 'auto' }}>
              {/* Avatar preview header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, paddingBottom: 20, borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)' }}>
                <div style={{
                  width: 58, height: 58, borderRadius: '50%',
                  background: draft.avatarColor,
                  border: '1.5px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...inter(20, 600, 'color-mix(in srgb, var(--text-primary) 65%, transparent)'),
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                  transition: 'background 200ms ease',
                }}>
                  {draft.avatarInitials || (draft.name ? draft.name.slice(0, 1).toUpperCase() : '?')}
                </div>
                <div>
                  <p style={{ ...playfair(18, 500), lineHeight: 1.2, marginBottom: 3 }}>
                    {draft.name || <span style={{ color: mutedText, fontStyle: 'italic' }}>{t('life.people.newPerson')}</span>}
                  </p>
                  <p style={{ ...inter(11, 400, mutedText) }}>
                    {draft.group}{draft.role ? ` · ${draft.role}` : ''}{draft.city ? ` · ${draft.city}` : ''}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <Field label={t('life.people.name')}>
                  <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} style={inputStyle} />
                </Field>
                <Field label={t('life.people.category')}>
                  <input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} style={inputStyle} disabled={Boolean(editingPerson?.sourceProjectPersonId)} />
                </Field>

                {/* Group selector with color accents */}
                <Field label={t('life.people.group')}>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {groups.map((group) => {
                      const isSelected = draft.group === group
                      return (
                        <button
                          key={group}
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, group }))}
                          style={{
                            ...smallButtonStyle,
                            background: isSelected ? groupColorMap[group] : 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                            border: isSelected ? '1px solid color-mix(in srgb, var(--text-primary) 18%, transparent)' : '1px solid color-mix(in srgb, var(--text-primary) 9%, transparent)',
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? 'color-mix(in srgb, var(--text-primary) 85%, transparent)' : 'color-mix(in srgb, var(--text-primary) 55%, transparent)',
                            transition: 'background 150ms ease, color 150ms ease',
                          }}
                        >
                          {group}
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <Field label={t('life.people.role')}>
                    <input value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label={t('life.people.city')}>
                    <input value={draft.city} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label={t('life.people.email')}>
                    <input value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label={t('life.people.phone')}>
                    <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label={t('life.people.birthday')}>
                    <input type="date" value={draft.birthday} onChange={(event) => setDraft((current) => ({ ...current, birthday: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label={t('life.people.lastInteraction')}>
                    <input type="date" value={draft.lastInteraction} onChange={(event) => setDraft((current) => ({ ...current, lastInteraction: event.target.value }))} style={inputStyle} />
                  </Field>

                  {/* Initials field */}
                  <Field label={t('life.people.initials')}>
                    <input
                      value={draft.avatarInitials}
                      onChange={(event) => setDraft((current) => ({ ...current, avatarInitials: event.target.value }))}
                      style={inputStyle}
                      maxLength={3}
                      placeholder="e.g. AB"
                    />
                  </Field>

                  {/* Avatar color — swatch picker replaces plain hex input */}
                  <Field label={t('life.people.avatarColor')}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                      {avatarColorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, avatarColor: color }))}
                          aria-label={color}
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: color,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            outline: draft.avatarColor === color ? `3px solid color-mix(in srgb, var(--text-primary) 45%, transparent)` : '2px solid transparent',
                            outlineOffset: 2,
                            transition: 'outline 120ms ease, transform 120ms ease',
                            transform: draft.avatarColor === color ? 'scale(1.15)' : 'scale(1)',
                          }}
                        />
                      ))}
                    </div>
                  </Field>
                </div>

                <Field label={t('life.people.notes')}>
                  <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} style={textareaStyle} />
                </Field>

                {/* Action row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                  <button type="button" onClick={() => onSaveItem(draft, editingId)} style={primarySaveStyle}>
                    {t('life.people.save')}
                  </button>
                  {editingId ? (
                    <button type="button" onClick={() => onRemoveItem(editingId)} style={dangerButtonStyle}>
                      {t('life.people.remove')}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog> : null}
    </>
  )
}
