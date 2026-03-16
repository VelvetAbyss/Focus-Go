import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { NoteAppearanceSettings, NoteItem, NoteTag } from '../../../data/models/types'
import { noteAppearanceRepo } from '../../../data/repositories/noteAppearanceRepo'
import { noteTagsRepo } from '../../../data/repositories/noteTagsRepo'
import { notesRepo } from '../../../data/repositories/notesRepo'
import AppearanceModal from '../components/AppearanceModal'
import ExportModal from '../components/ExportModal'
import InfoPopover from '../components/InfoPopover'
import NoteBrowser, { type NoteSortOption } from '../components/NoteBrowser'
import NoteEditor from '../components/NoteEditor'
import NoteSidebar, { type NoteSystemCollection } from '../components/NoteSidebar'
import TrashModal from '../components/TrashModal'
import '../notes.css'

const DEFAULT_APPEARANCE: NoteAppearanceSettings = {
  id: 'note_appearance',
  createdAt: 0,
  updatedAt: 0,
  theme: 'paper',
  font: 'sans',
  fontSize: 16,
  lineHeight: 1.7,
  contentWidth: 56,
  focusMode: false,
}

const DEFAULT_TAGS: Array<Pick<NoteTag, 'name' | 'icon' | 'pinned' | 'sortOrder'> & { parentName?: string }> = [
  { name: 'Projects', icon: 'folder', pinned: true, sortOrder: 1 },
  { name: 'Focus&Go', pinned: false, parentName: 'Projects', sortOrder: 2 },
  { name: 'Website Redesign', pinned: false, parentName: 'Projects', sortOrder: 3 },
  { name: 'Research', icon: 'microscope', pinned: true, sortOrder: 4 },
  { name: 'AI/ML', pinned: false, parentName: 'Research', sortOrder: 5 },
  { name: 'Design Systems', pinned: false, parentName: 'Research', sortOrder: 6 },
  { name: 'Personal', icon: 'user', pinned: false, sortOrder: 7 },
  { name: 'Reading Notes', icon: 'book-open', pinned: false, sortOrder: 8 },
  { name: 'Books', pinned: false, parentName: 'Reading Notes', sortOrder: 9 },
  { name: 'Articles', pinned: false, parentName: 'Reading Notes', sortOrder: 10 },
  { name: 'Meetings', icon: 'calendar', pinned: false, sortOrder: 11 },
  { name: 'Ideas', icon: 'lightbulb', pinned: false, sortOrder: 12 },
]

type SaveState = 'idle' | 'saving' | 'saved'

const buildPreview = (content: string) => {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > 140 ? `${compact.slice(0, 140)}…` : compact
}

const isSameDay = (left: number, right: number) => {
  const a = new Date(left)
  const b = new Date(right)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const sortNotes = (notes: NoteItem[], sortBy: NoteSortOption) => {
  const next = [...notes]
  next.sort((left, right) => {
    if (sortBy === 'created') return right.createdAt - left.createdAt
    if (sortBy === 'title') return (left.title.trim() || 'Untitled').localeCompare(right.title.trim() || 'Untitled')
    return right.updatedAt - left.updatedAt
  })
  return next
}

const collectionLabelMap: Record<NoteSystemCollection, string> = {
  notes: 'All Notes',
  today: 'Today',
  untagged: 'Untagged',
  trash: 'Trash',
}

export default function NotePage() {
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [trash, setTrash] = useState<NoteItem[]>([])
  const [tags, setTags] = useState<NoteTag[]>([])
  const [appearance, setAppearance] = useState<NoteAppearanceSettings>(DEFAULT_APPEARANCE)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [activeCollection, setActiveCollection] = useState<NoteSystemCollection>('notes')
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<NoteSortOption>('edited')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [trashOpen, setTrashOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const pendingSaveRef = useRef<{ id: string; patch: Partial<NoteItem> } | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const sidebarScrollRef = useRef<HTMLElement | null>(null)
  const browserScrollRef = useRef<HTMLElement | null>(null)
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null)

  const refresh = async () => {
    const [activeNotes, trashedNotes, storedTags, storedAppearance] = await Promise.all([
      notesRepo.list(),
      notesRepo.listTrash(),
      noteTagsRepo.list(),
      noteAppearanceRepo.get(),
    ])

    if (storedTags.length === 0) {
      const createdTags: NoteTag[] = []
      const byName = new Map<string, NoteTag>()
      for (const tag of DEFAULT_TAGS) {
        const created = await noteTagsRepo.create({
          name: tag.name,
          icon: tag.icon,
          pinned: tag.pinned,
          parentId: tag.parentName ? byName.get(tag.parentName)?.id ?? null : null,
          sortOrder: tag.sortOrder,
        })
        createdTags.push(created)
        byName.set(created.name, created)
      }
      setTags(createdTags)
    } else {
      const shouldRelinkDefaults = storedTags.every((tag) => DEFAULT_TAGS.some((seed) => seed.name === tag.name)) && storedTags.every((tag) => !tag.parentId)
      if (shouldRelinkDefaults) {
        const nextTags = [...storedTags]
        const byName = new Map(nextTags.map((tag) => [tag.name, tag]))
        for (const seed of DEFAULT_TAGS) {
          const current = byName.get(seed.name)
          if (!current) continue
          const desiredParentId = seed.parentName ? byName.get(seed.parentName)?.id ?? null : null
          if (current.parentId !== desiredParentId) {
            const updated = await noteTagsRepo.update(current.id, { parentId: desiredParentId })
            if (updated) byName.set(updated.name, updated)
          }
        }
        setTags(Array.from(byName.values()).sort((a, b) => a.sortOrder - b.sortOrder))
      } else {
        setTags(storedTags)
      }
    }

    if (!storedAppearance) {
      const createdAppearance = await noteAppearanceRepo.upsert({ id: 'note_appearance' })
      setAppearance(createdAppearance)
    } else {
      setAppearance({ ...DEFAULT_APPEARANCE, ...storedAppearance })
    }

    setNotes(activeNotes)
    setTrash(trashedNotes)

    if (activeNotes.length === 0 && trashedNotes.length === 0) {
      const created = await notesRepo.create()
      setNotes([created])
      setSelectedNoteId(created.id)
      return
    }

    setSelectedNoteId((current) => {
      const source = activeCollection === 'trash' ? trashedNotes : activeNotes
      if (current && [...activeNotes, ...trashedNotes].some((note) => note.id === current)) return current
      return source[0]?.id ?? null
    })
  }

  const flushPendingSave = async () => {
    const pending = pendingSaveRef.current
    if (!pending) return
    pendingSaveRef.current = null
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setSaveState('saving')
    const updated = await notesRepo.update(pending.id, pending.patch)
    if (updated) {
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
      setTrash((current) => current.map((note) => (note.id === updated.id ? updated : note)))
    }
    setSaveState('saved')
  }

  useEffect(() => {
    void refresh()
    return () => {
      void flushPendingSave()
    }
  }, [])

  const sourceNotes = activeCollection === 'trash' ? trash : notes
  const filteredNotes = useMemo(() => {
    const next = sourceNotes.filter((note) => {
      if (activeCollection === 'today' && !isSameDay(note.updatedAt, Date.now())) return false
      if (activeCollection === 'untagged' && note.tags.length > 0) return false
      if (activeTagId && !note.tags.includes(tags.find((tag) => tag.id === activeTagId)?.name ?? '')) return false
      return true
    })
    return sortNotes(next, sortBy)
  }, [activeCollection, activeTagId, notes, sortBy, sourceNotes, tags])

  const activeNote = useMemo(() => filteredNotes.find((note) => note.id === selectedNoteId) ?? filteredNotes[0] ?? null, [filteredNotes, selectedNoteId])
  const activeNoteValue = activeNote
    ? {
        title: activeNote.title,
        contentMd: activeNote.contentMd,
        contentJson: activeNote.contentJson ?? null,
        tags: activeNote.tags,
      }
    : { title: '', contentMd: '', contentJson: null, tags: [] }

  const noteCounts = useMemo(
    () => ({
      all: notes.length,
      today: notes.filter((note) => isSameDay(note.updatedAt, Date.now())).length,
      untagged: notes.filter((note) => note.tags.length === 0).length,
      trash: trash.length,
    }),
    [notes, trash],
  )

  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Auto save'

  const scheduleSave = (id: string, patch: Partial<NoteItem>) => {
    pendingSaveRef.current = { id, patch }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    setSaveState('saving')
    saveTimerRef.current = window.setTimeout(() => {
      void flushPendingSave()
    }, 280)
  }

  const handleCreate = async () => {
    await flushPendingSave()
    const created = await notesRepo.create()
    setNotes((current) => [created, ...current])
    setActiveCollection('notes')
    setActiveTagId(null)
    setSelectedNoteId(created.id)
    setSearch('')
  }

  const handleTogglePinNote = async (id: string) => {
    const target = notes.find((note) => note.id === id)
    if (!target) return
    const updated = await notesRepo.update(id, { pinned: !target.pinned })
    if (!updated) return
    setNotes((current) => current.map((note) => (note.id === id ? updated : note)))
  }

  const handleTrashNote = async (id: string) => {
    await flushPendingSave()
    const removed = await notesRepo.softDelete(id)
    if (!removed) return
    setNotes((current) => current.filter((note) => note.id !== id))
    setTrash((current) => [removed, ...current])
    if (selectedNoteId === id) setSelectedNoteId(null)
  }

  const handleRestore = async (id: string) => {
    const restored = await notesRepo.restore(id)
    if (!restored) return
    setTrash((current) => current.filter((note) => note.id !== id))
    setNotes((current) => [restored, ...current])
    setActiveCollection('notes')
    setSelectedNoteId(restored.id)
  }

  const handleDeletePermanently = async (id: string) => {
    await notesRepo.hardDelete(id)
    setTrash((current) => current.filter((note) => note.id !== id))
  }

  const handleUpdateNote = (next: { title: string; contentMd: string; contentJson?: Record<string, unknown> | null; tags: string[] }) => {
    if (!activeNote) return
    const patch: Partial<NoteItem> = {
      title: next.title,
      contentMd: next.contentMd,
      contentJson: next.contentJson ?? null,
      tags: next.tags,
      excerpt: buildPreview(next.contentMd),
    }
    setNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id
          ? {
              ...note,
              ...patch,
              excerpt: buildPreview(next.contentMd),
            }
          : note,
      ),
    )
    scheduleSave(activeNote.id, patch)
  }

  const handleTogglePinTag = async (tagId: string) => {
    const target = tags.find((tag) => tag.id === tagId)
    if (!target) return
    const updated = await noteTagsRepo.update(tagId, { pinned: !target.pinned })
    if (!updated) return
    setTags((current) => current.map((tag) => (tag.id === tagId ? updated : tag)))
  }

  const handleSelectCollection = (collection: NoteSystemCollection) => {
    setActiveCollection(collection)
    setActiveTagId(null)
    setSelectedNoteId(null)
    if (collection === 'trash') setTrashOpen(true)
  }

  const handleSelectTag = (tagId: string) => {
    setActiveTagId(tagId)
    setActiveCollection('notes')
    setSelectedNoteId(null)
  }

  const handleUpdateAppearance = async (patch: Partial<NoteAppearanceSettings>) => {
    const next = await noteAppearanceRepo.upsert({ id: 'note_appearance', ...patch })
    setAppearance(next)
  }

  const handleExportMarkdown = async () => {
    await flushPendingSave()
    if (!activeNote) return
    const blob = new Blob([`# ${activeNote.title.trim() || 'Untitled'}\n\n${activeNote.contentMd}`], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(activeNote.title.trim() || 'untitled').replace(/\s+/g, '-').toLowerCase()}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (sidebarScrollRef.current) sidebarScrollRef.current.scrollTop = 0
    if (browserScrollRef.current) browserScrollRef.current.scrollTop = 0
    if (editorSurfaceRef.current) editorSurfaceRef.current.scrollTop = 0
  }, [selectedNoteId])

  return (
    <section
      className="note-page-shell flex h-full max-h-full min-h-0"
      data-note-theme={appearance.theme}
      style={
        ({
          ...(appearance.theme === 'graphite'
            ? {
              backgroundColor: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            }
            : {}),
        } as CSSProperties)
      }
    >
      <div className="note-page-shell__content note-page">
        <NoteSidebar
          className="note-page-column note-page-column--sidebar"
          scrollContainerRef={sidebarScrollRef}
          tags={tags}
          activeCollection={activeCollection}
          activeTagId={activeTagId}
          noteCounts={noteCounts}
          onSelectCollection={handleSelectCollection}
          onSelectTag={handleSelectTag}
          onTogglePinTag={handleTogglePinTag}
        />
        <NoteBrowser
          className="note-page-column note-page-column--browser"
          scrollContainerRef={browserScrollRef}
          notes={filteredNotes}
          selectedNoteId={activeNote?.id ?? null}
          collectionLabel={collectionLabelMap[activeCollection]}
          onSelectNote={async (id) => {
            await flushPendingSave()
            setSelectedNoteId(id)
          }}
          onNewNote={handleCreate}
          onTogglePin={handleTogglePinNote}
          onTrashNote={handleTrashNote}
          sortBy={sortBy}
          onSortChange={setSortBy}
          search={search}
          onSearchChange={setSearch}
        />
        <div className="note-page-column note-page-column--editor relative flex min-w-0 flex-1">
          <NoteEditor
            surfaceRef={editorSurfaceRef}
            value={activeNoteValue}
            appearance={appearance}
            saveStateLabel={saveLabel}
            onOpenInfo={() => setInfoOpen(true)}
            onOpenAppearance={() => setAppearanceOpen(true)}
            onExport={() => setExportOpen(true)}
            onChange={handleUpdateNote}
          />
          <InfoPopover open={infoOpen} note={activeNote} onClose={() => setInfoOpen(false)} onNavigateToNote={(id) => setSelectedNoteId(id)} />
        </div>
      </div>
      <TrashModal open={trashOpen} trashedNotes={trash} onClose={() => setTrashOpen(false)} onRestore={handleRestore} onDeletePermanently={handleDeletePermanently} />
      <AppearanceModal open={appearanceOpen} settings={appearance} onClose={() => setAppearanceOpen(false)} onUpdate={handleUpdateAppearance} />
      <ExportModal open={exportOpen} noteTitle={activeNote?.title.trim() || 'Untitled'} onClose={() => setExportOpen(false)} onExportMarkdown={handleExportMarkdown} />
    </section>
  )
}
