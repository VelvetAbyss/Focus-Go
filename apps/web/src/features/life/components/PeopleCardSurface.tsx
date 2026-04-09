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

type PersonDraft = {
  name: string
  group: LifePerson['group']
  role: string
  city: string
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
  role: person?.role ?? '',
  city: person?.city ?? '',
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
  const [draft, setDraft] = useState<PersonDraft>(toDraft(selected))
  const [editingId, setEditingId] = useState<string | null>(selectedId)

  useEffect(() => {
    setDraft(toDraft(selected))
    setEditingId(selectedId)
  }, [selected])

  return (
    <>
      <div onClick={onOpen} style={cardShellStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Users size={13} color="rgba(58,55,51,0.38)" />
              <span style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>People</span>
            </div>
            <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>People</h3>
          </div>
          <div style={cardArrowStyle}><ChevronRight size={15} /></div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px' }}>
          {loading ? (
            <LifeCardLoader />
          ) : model.preview.length ? (
            model.preview.map((person, index) => (
              <div key={person.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: person.avatarColor, border: '1px solid rgba(58,55,51,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...inter(13, 500, 'rgba(58,55,51,0.70)'), flexShrink: 0 }}>
                    {person.avatarInitials}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ ...inter(13, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</p>
                      <span style={{ ...inter(9, 500, '#3A3733'), background: 'rgba(58,55,51,0.08)', borderRadius: 999, padding: '2px 8px' }}>{person.group}</span>
                    </div>
                    <p style={{ ...inter(11, 400, person.birthdaySoon ? '#8C7355' : mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.secondary}</p>
                  </div>
                </div>
                {index < model.preview.length - 1 ? <div style={{ height: 1, background: 'rgba(58,55,51,0.05)', marginLeft: 50 }} /> : null}
              </div>
            ))
          ) : (
            <div style={{ display: 'flex', minHeight: 180, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 999, background: 'rgba(58,55,51,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color="rgba(58,55,51,0.30)" />
              </div>
              <p style={{ ...playfair(14, 500), marginBottom: 6 }}>Keep your people close</p>
              <p style={{ ...inter(12, 400, mutedText), lineHeight: 1.6, marginBottom: 18 }}>Add important people and track birthdays or recent contact.</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ ...smallButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={11} />
                <span>Add person</span>
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: `1px solid ${sectionBorder}` }}>
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ ...inter(12, 400, mutedText), display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <Plus size={12} />
            <span>Add person</span>
          </button>
          <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.38)') }}>{model.statsLabel}</p>
        </div>
      </div>

      <Dialog open={open} onClose={onClose} panelClassName="life-modal__panel" contentClassName="life-modal__content">
        <div style={modalLayoutStyle}>
          <div style={modalHeaderStyle}>
            <div>
              <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>People</p>
              <h2 style={{ ...playfair(22, 500) }}>People</h2>
            </div>
            <button type="button" onClick={onClose} style={iconButtonStyle}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
            <aside style={sidebarStyle}>
              <button type="button" onClick={() => { setDraft(toDraft(null)); setEditingId(null) }} style={{ ...smallButtonStyle, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={11} />
                <span>New person</span>
              </button>
              <div style={{ display: 'grid', gap: 6 }}>
                {items.map((item) => (
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
                    <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.group}{item.role ? ` · ${item.role}` : ''}</p>
                  </button>
                ))}
              </div>
            </aside>
            <div style={{ ...detailPaneStyle, background: paper, padding: 20, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <Field label="Name">
                  <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Group">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {groups.map((group) => (
                      <button key={group} type="button" onClick={() => setDraft((current) => ({ ...current, group }))} style={{ ...smallButtonStyle, background: draft.group === group ? 'rgba(58,55,51,0.10)' : 'rgba(58,55,51,0.06)' }}>
                        {group}
                      </button>
                    ))}
                  </div>
                </Field>
                <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <Field label="Role">
                    <input value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="City">
                    <input value={draft.city} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="Birthday">
                    <input type="date" value={draft.birthday} onChange={(event) => setDraft((current) => ({ ...current, birthday: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="Last Interaction">
                    <input type="date" value={draft.lastInteraction} onChange={(event) => setDraft((current) => ({ ...current, lastInteraction: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="Initials">
                    <input value={draft.avatarInitials} onChange={(event) => setDraft((current) => ({ ...current, avatarInitials: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="Avatar Color">
                    <input value={draft.avatarColor} onChange={(event) => setDraft((current) => ({ ...current, avatarColor: event.target.value }))} style={inputStyle} />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} style={textareaStyle} />
                </Field>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <button type="button" onClick={() => onSaveItem(draft, editingId)} style={smallButtonStyle}>Save</button>
                  {editingId ? <button type="button" onClick={() => onRemoveItem(editingId)} style={{ ...smallButtonStyle, color: '#9D4C4C' }}>Remove</button> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}
