import { useEffect, useMemo, useState } from 'react'
import type { LifePerson } from '../../../data/models/types'
import { peopleRepo } from '../../../data/repositories/peopleRepo'
import { PeopleCardSurface } from '../components/PeopleCardSurface'
import { buildPeoplePresentationModel } from './lifeDesignAdapters'

const deriveInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

const PeopleCard = () => {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<LifePerson[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId])
  const model = useMemo(() => buildPeoplePresentationModel(items), [items])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const rows = await peopleRepo.list()
      setItems(rows)
      setSelectedId((current) => current ?? rows[0]?.id ?? null)
      setLoading(false)
    }
    void load()
  }, [])

  const handleSave = async (
    draft: {
      name: string
      group: LifePerson['group']
      role: string
      city: string
      birthday: string
      lastInteraction: string
      notes: string
      avatarInitials: string
      avatarColor: string
    },
    id?: string | null,
  ) => {
    const payload = {
      name: draft.name.trim(),
      group: draft.group,
      role: draft.role.trim() || undefined,
      city: draft.city.trim() || undefined,
      birthday: draft.birthday || undefined,
      lastInteraction: draft.lastInteraction || undefined,
      notes: draft.notes || undefined,
      avatarInitials: (draft.avatarInitials.trim() || deriveInitials(draft.name) || 'NA').slice(0, 3),
      avatarColor: draft.avatarColor.trim() || undefined,
    }

    if (!payload.name) return

    if (id) {
      const updated = await peopleRepo.update(id, payload)
      if (!updated) return
      setItems((current) => [updated, ...current.filter((item) => item.id !== id)])
      setSelectedId(updated.id)
      return
    }

    const created = await peopleRepo.create(payload)
    setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
    setSelectedId(created.id)
  }

  const handleRemove = async (id: string) => {
    await peopleRepo.remove(id)
    const next = items.filter((item) => item.id !== id)
    setItems(next)
    setSelectedId(next[0]?.id ?? null)
  }

  return (
    <PeopleCardSurface
      model={model}
      items={items}
      selected={selected}
      selectedId={selectedId}
      open={open}
      loading={loading}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onSelectItem={setSelectedId}
      onSaveItem={(draft, id) => void handleSave(draft, id)}
      onRemoveItem={(id) => void handleRemove(id)}
    />
  )
}

export default PeopleCard
