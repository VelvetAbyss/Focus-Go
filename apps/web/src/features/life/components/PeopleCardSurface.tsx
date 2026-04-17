import { ChevronRight, Plus, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Dialog from '../../../shared/ui/Dialog'
import type { LifePerson } from '../../../data/models/types'
import type { PeoplePresentationModel } from '../cards/lifeDesignAdapters'
import {
  cardArrowStyle,
  cardHeaderStyle,
  cardShellStyle,
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
  sectionBorder,
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
              <Users size={13} color="rgba(58,55,51,0.38)" />
              <span style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{t('life.card.people')}</span>
            </div>
            <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>{t('life.card.people')}</h3>
          </div>
          <div style={cardArrowStyle}><ChevronRight size={15} /></div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px' }}>
          {loading ? (
            <LifeCardLoader />
          ) : visibleRows.length ? (
            <>
              {categories.length > 1 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 4px 10px' }}>
                  {categories.map((category) => (
                    <button key={category} type="button" onClick={(event) => { event.stopPropagation(); setCategoryFilter(category) }} style={{ ...smallButtonStyle, background: categoryFilter === category ? 'rgba(58,55,51,0.10)' : 'rgba(58,55,51,0.06)', padding: '4px 10px' }}>
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}
              {visibleRows.slice(0, 3).map((person, index) => (
              <div key={person.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: person.avatarColor, border: '1px solid rgba(58,55,51,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...inter(13, 500, 'rgba(58,55,51,0.70)'), flexShrink: 0 }}>
                    {person.avatarInitials}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ ...inter(13, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</p>
                      <span style={{ ...inter(9, 500, '#3A3733'), background: 'rgba(58,55,51,0.08)', borderRadius: 999, padding: '2px 8px' }}>{person.group}</span>
                      {person.category ? <span style={{ ...inter(9, 500, '#3A3733'), background: 'rgba(212,136,43,0.10)', borderRadius: 999, padding: '2px 8px' }}>{person.category}</span> : null}
                    </div>
                    <p style={{ ...inter(11, 400, person.birthdaySoon ? '#8C7355' : mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.secondary}</p>
                  </div>
                </div>
                {index < Math.min(visibleRows.length, 3) - 1 ? <div style={{ height: 1, background: 'rgba(58,55,51,0.05)', marginLeft: 50 }} /> : null}
              </div>
              ))}
            </>
          ) : (
            <div style={{ display: 'flex', minHeight: 180, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 999, background: 'rgba(58,55,51,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color="rgba(58,55,51,0.30)" />
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: `1px solid ${sectionBorder}` }}>
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ ...inter(12, 400, mutedText), display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <Plus size={12} />
            <span>{t('life.people.addPerson')}</span>
          </button>
          <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.38)') }}>{model.statsLabel}</p>
        </div>
      </div>

      {open ? <Dialog open={open} onClose={onClose} panelClassName="life-modal__panel" contentClassName="life-modal__content">
        <div style={modalLayoutStyle}>
          <div style={modalHeaderStyle}>
            <div>
              <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>{t('life.people.title')}</p>
              <h2 style={{ ...playfair(22, 500) }}>{t('life.people.title')}</h2>
            </div>
            <button type="button" onClick={onClose} style={iconButtonStyle}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
            <aside style={sidebarStyle}>
              <button type="button" onClick={() => { setDraft({ ...toDraft(null), category: categoryFilter === 'All' ? '' : categoryFilter }); setEditingId(null) }} style={{ ...smallButtonStyle, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={11} />
                <span>{t('life.people.newPerson')}</span>
              </button>
              {categories.length > 1 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {categories.map((category) => (
                    <button key={category} type="button" onClick={() => setCategoryFilter(category)} style={{ ...smallButtonStyle, background: categoryFilter === category ? 'rgba(58,55,51,0.10)' : 'rgba(58,55,51,0.06)' }}>
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'grid', gap: 6 }}>
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                      onClick={() => {
                        setEditingId(item.id)
                        onSelectItem(item.id)
                      }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 16,
                      border: selectedId === item.id ? '1px solid rgba(58,55,51,0.12)' : '1px solid transparent',
                      background: selectedId === item.id ? 'rgba(58,55,51,0.06)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <p style={{ ...inter(12, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                    <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category ?? item.group}{item.role ? ` · ${item.role}` : ''}</p>
                  </button>
                ))}
              </div>
            </aside>
            <div style={{ ...detailPaneStyle, background: paper, padding: 20, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <Field label={t('life.people.name')}>
                  <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} style={inputStyle} />
                </Field>
                <Field label={t('life.people.category')}>
                  <input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} style={inputStyle} disabled={Boolean(editingPerson?.sourceProjectPersonId)} />
                </Field>
                <Field label={t('life.people.group')}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {groups.map((group) => (
                      <button key={group} type="button" onClick={() => setDraft((current) => ({ ...current, group }))} style={{ ...smallButtonStyle, background: draft.group === group ? 'rgba(58,55,51,0.10)' : 'rgba(58,55,51,0.06)' }}>
                        {group}
                      </button>
                    ))}
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
                  <Field label={t('life.people.initials')}>
                    <input value={draft.avatarInitials} onChange={(event) => setDraft((current) => ({ ...current, avatarInitials: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label={t('life.people.avatarColor')}>
                    <input value={draft.avatarColor} onChange={(event) => setDraft((current) => ({ ...current, avatarColor: event.target.value }))} style={inputStyle} />
                  </Field>
                </div>
                <Field label={t('life.people.notes')}>
                  <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} style={textareaStyle} />
                </Field>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <button type="button" onClick={() => onSaveItem(draft, editingId)} style={smallButtonStyle}>{t('life.people.save')}</button>
                  {editingId ? <button type="button" onClick={() => onRemoveItem(editingId)} style={{ ...smallButtonStyle, color: '#9D4C4C' }}>{t('life.people.remove')}</button> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog> : null}
    </>
  )
}
