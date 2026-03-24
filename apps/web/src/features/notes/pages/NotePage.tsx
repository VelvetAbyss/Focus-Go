import { useEffect, useMemo, useRef, useState } from 'react'
import type { NoteAppearanceSettings, NoteEditorMode, NoteItem, NoteMindMapDocument, NoteTag } from '../../../data/models/types'
import { ROUTES } from '../../../app/routes/routes'
import { noteAppearanceRepo } from '../../../data/repositories/noteAppearanceRepo'
import { noteTagsRepo } from '../../../data/repositories/noteTagsRepo'
import { notesRepo } from '../../../data/repositories/notesRepo'
import { useLabs } from '../../labs/LabsContext'
import AppearanceModal from '../components/AppearanceModal'
import ExportModal from '../components/ExportModal'
import InfoPopover from '../components/InfoPopover'
import NoteBrowser, { type NoteSortOption } from '../components/NoteBrowser'
import NoteEditor from '../components/NoteEditor'
import NoteSidebar, { type NoteSystemCollection } from '../components/NoteSidebar'
import { createInitialMindMap, getMindMapPrimaryLabel, mindMapToPlainText } from '../model/mindMap'
import { countCharactersInMarkdown, countWordsInMarkdown } from '../model/noteStats'
import '../notes.css'

const DEFAULT_APPEARANCE: NoteAppearanceSettings = {
  id: 'note_appearance',
  createdAt: 0,
  updatedAt: 0,
  theme: 'paper',
  font: 'serif',
  fontSize: 16,
  lineHeight: 1.8,
  contentWidth: 60,
  focusMode: false,
}

const DEFAULT_TAGS: Array<Pick<NoteTag, 'name' | 'icon' | 'pinned' | 'sortOrder'> & { parentName?: string }> = [
  { name: 'Projects', icon: 'folder', pinned: true, sortOrder: 1 },
  { name: 'Research', icon: 'microscope', pinned: false, sortOrder: 2 },
  { name: 'Personal', icon: 'user', pinned: false, sortOrder: 3 },
  { name: 'Reading Notes', icon: 'book-open', pinned: false, sortOrder: 4 },
  { name: 'Ideas', icon: 'lightbulb', pinned: false, sortOrder: 5 },
]

type NotePanel = 'info' | 'appearance' | 'export' | null

const buildPreview = (content: string) => {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > 140 ? `${compact.slice(0, 140)}…` : compact
}

const slugifyHeading = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')

const countMatches = (content: string, pattern: RegExp) => (content.match(pattern) ?? []).length

const buildNoteStats = (contentMd: string) => {
  const content = typeof contentMd === 'string' ? contentMd : ''
  const paragraphs = content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  const headings = content
    .split('\n')
    .map((line) => line.match(/^(#{1,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      level: Math.min(3, match[1].length) as 1 | 2 | 3,
      text: match[2].trim(),
      id: slugifyHeading(match[2]),
    }))

  return {
    wordCount: countWordsInMarkdown(content),
    charCount: countCharactersInMarkdown(content),
    paragraphCount: paragraphs.length,
    imageCount: countMatches(content, /!\[[^\]]*\]\([^)]+\)/g),
    fileCount: countMatches(content, /\battachment:\b/gi),
    headings,
  }
}

const dateKey = (value: number) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
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
  notes: '所有笔记',
  today: '今天',
  untagged: '未标记',
  trash: '回收站',
}

const recomputeTagCounts = (tags: NoteTag[], activeNotes: NoteItem[]) => {
  const counts = new Map<string, number>()
  for (const note of activeNotes) {
    for (const tagName of note.tags) {
      counts.set(tagName, (counts.get(tagName) ?? 0) + 1)
    }
  }
  return tags.map((tag) => ({ ...tag, noteCount: counts.get(tag.name) ?? 0 }))
}

const containsTagName = (tags: string[], name: string) => tags.some((tag) => tag.toLowerCase() === name.toLowerCase())
const FREE_MIND_MAP_LIMIT = 1

const buildNoteTextForStats = (editorMode: NoteEditorMode, contentMd: string, mindMap?: NoteMindMapDocument | null) =>
  editorMode === 'mindmap' ? mindMapToPlainText(mindMap) : contentMd

export default function NotePage() {
  const { subscription, canAccessMindMapFeature } = useLabs()
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [trash, setTrash] = useState<NoteItem[]>([])
  const [tags, setTags] = useState<NoteTag[]>([])
  const [appearance, setAppearance] = useState<NoteAppearanceSettings>(DEFAULT_APPEARANCE)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [activeCollection, setActiveCollection] = useState<NoteSystemCollection>('notes')
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<NoteSortOption>('edited')
  const [openPanel, setOpenPanel] = useState<NotePanel>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMindMapUpgrade, setShowMindMapUpgrade] = useState(false)
  const [todayKey, setTodayKey] = useState(() => dateKey(Date.now()))
  const [isAppDark, setIsAppDark] = useState(() => document.documentElement.classList.contains('dark'))
  const pendingSaveRef = useRef<{ id: string; patch: Partial<NoteItem> } | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null)
  const browserScrollRef = useRef<HTMLDivElement | null>(null)
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null)
  const creatingFromBlankRef = useRef(false)

  const refresh = async () => {
    const [activeNotes, trashedNotes, storedTags, storedAppearance] = await Promise.all([
      notesRepo.list(),
      notesRepo.listTrash(),
      noteTagsRepo.list(),
      noteAppearanceRepo.get(),
    ])

    let resolvedTags: NoteTag[] = storedTags

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
      resolvedTags = createdTags
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
        resolvedTags = Array.from(byName.values()).sort((a, b) => a.sortOrder - b.sortOrder)
      } else {
        resolvedTags = storedTags
      }
    }

    if (!storedAppearance) {
      const createdAppearance = await noteAppearanceRepo.upsert({ id: 'note_appearance' })
      setAppearance(createdAppearance)
    } else {
      setAppearance({ ...DEFAULT_APPEARANCE, ...storedAppearance })
    }

    const visibleNotes = activeNotes.filter((note) => !note.deletedAt)
    const trashedOnly = trashedNotes.filter((note) => Boolean(note.deletedAt))

    setTags(recomputeTagCounts(resolvedTags, visibleNotes))
    setNotes(visibleNotes)
    setTrash(trashedOnly)

    setSelectedNoteId((current) => {
      const source = activeCollection === 'trash' ? trashedOnly : visibleNotes
      if (current && [...visibleNotes, ...trashedOnly].some((note) => note.id === current)) return current
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
    const updated = await notesRepo.update(pending.id, pending.patch)
    if (updated) {
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
      setTrash((current) => current.map((note) => (note.id === updated.id ? updated : note)))
    }
  }

  useEffect(() => {
    const bootTimer = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => {
      window.clearTimeout(bootTimer)
      void flushPendingSave()
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTodayKey(dateKey(Date.now()))
    }, 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsAppDark(root.classList.contains('dark') || root.dataset.theme === 'dark')
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => observer.disconnect()
  }, [])

  const hasMindMapFullAccess = canAccessMindMapFeature
  const visibleNotes = useMemo(
    () => (hasMindMapFullAccess ? notes : notes.filter((note) => note.editorMode !== 'mindmap')),
    [hasMindMapFullAccess, notes],
  )
  const visibleTrash = useMemo(
    () => (hasMindMapFullAccess ? trash : trash.filter((note) => note.editorMode !== 'mindmap')),
    [hasMindMapFullAccess, trash],
  )
  const sourceNotes = activeCollection === 'trash' ? visibleTrash : visibleNotes
  const tagNameById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags])
  const filteredNotes = useMemo(() => {
    const next = sourceNotes.filter((note) => {
      if (activeCollection === 'today' && dateKey(note.updatedAt) !== todayKey) return false
      if (activeCollection === 'untagged' && note.tags.length > 0) return false
      if (activeTagId && !note.tags.includes(tagNameById.get(activeTagId) ?? '')) return false
      return true
    })
    return sortNotes(next, sortBy)
  }, [activeCollection, activeTagId, tagNameById, sortBy, sourceNotes, todayKey])

  const activeNote = useMemo(() => filteredNotes.find((note) => note.id === selectedNoteId) ?? filteredNotes[0] ?? null, [filteredNotes, selectedNoteId])
  const activeMindMapCount = useMemo(() => notes.filter((note) => note.editorMode === 'mindmap').length, [notes])
  const mindMapLimitReached = !hasMindMapFullAccess && activeMindMapCount >= FREE_MIND_MAP_LIMIT
  const activeNoteValue = activeNote
    ? {
        title: activeNote.title,
        contentMd: activeNote.contentMd,
        contentJson: activeNote.contentJson ?? null,
        editorMode: activeNote.editorMode,
        mindMap: activeNote.mindMap ?? null,
        tags: activeNote.tags,
      }
    : { title: '', contentMd: '', contentJson: null, editorMode: 'document' as const, mindMap: null, tags: [] }

  const noteCounts = useMemo(
    () => ({
      all: visibleNotes.length,
      today: visibleNotes.filter((note) => dateKey(note.updatedAt) === todayKey).length,
      untagged: visibleNotes.filter((note) => note.tags.length === 0).length,
      trash: visibleTrash.length,
    }),
    [todayKey, visibleNotes, visibleTrash],
  )
  const tagsWithCounts = useMemo(() => recomputeTagCounts(tags, visibleNotes), [tags, visibleNotes])

  const effectiveTheme: 'paper' | 'graphite' = appearance.theme === 'graphite' || isAppDark ? 'graphite' : 'paper'

  const scheduleSave = (id: string, patch: Partial<NoteItem>) => {
    pendingSaveRef.current = { id, patch }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
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

  const handleCreateMindMap = async () => {
    await flushPendingSave()
    if (!canPersistMindMap(null, 'mindmap')) {
      setShowMindMapUpgrade(true)
      return
    }
    const created = await notesRepo.create({
      title: 'New Mind Map',
      contentMd: '',
      contentJson: null,
      editorMode: 'mindmap',
      mindMap: createInitialMindMap(),
      tags: [],
    })
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

  const handleDeletePermanently = async (id: string) => {
    await notesRepo.hardDelete(id)
    setTrash((current) => {
      const next = current.filter((note) => note.id !== id)
      if (selectedNoteId === id) setSelectedNoteId(next[0]?.id ?? null)
      return next
    })
  }

  const handleRestoreNote = async (id: string) => {
    await flushPendingSave()
    const restored = await notesRepo.restore(id)
    if (!restored) return
    setTrash((current) => current.filter((note) => note.id !== id))
    setNotes((current) => [restored, ...current.filter((note) => note.id !== id)])
    if (selectedNoteId === id) setSelectedNoteId(restored.id)
  }

  const canPersistMindMap = (target?: NoteItem | null, nextMode?: NoteEditorMode) => {
    if (nextMode !== 'mindmap') return true
    if (hasMindMapFullAccess) return true
    if (target?.editorMode === 'mindmap') return true
    return activeMindMapCount < FREE_MIND_MAP_LIMIT
  }

  const handleUpdateNote = (next: {
    title: string
    contentMd: string
    contentJson?: Record<string, unknown> | null
    editorMode: NoteEditorMode
    mindMap?: NoteMindMapDocument | null
    tags: string[]
  }) => {
    if (!canPersistMindMap(activeNote, next.editorMode)) {
      setShowMindMapUpgrade(true)
      return
    }
    if (!activeNote) {
      if (activeCollection === 'trash') return
      const hasContent =
        next.title.trim().length > 0 ||
        next.contentMd.trim().length > 0 ||
        next.tags.length > 0 ||
        next.editorMode === 'mindmap'
      if (!hasContent || creatingFromBlankRef.current) return
      creatingFromBlankRef.current = true
      void (async () => {
        try {
          const derivedTitle = next.title.trim() || getMindMapPrimaryLabel(next.mindMap)
          const created = await notesRepo.create({
            title: derivedTitle,
            contentMd: next.contentMd,
            contentJson: next.contentJson ?? null,
            editorMode: next.editorMode,
            mindMap: next.mindMap ?? (next.editorMode === 'mindmap' ? createInitialMindMap() : null),
            tags: next.tags,
          })
          setNotes((current) => [created, ...current])
          setActiveCollection('notes')
          setSelectedNoteId(created.id)
          setSearch('')
        } finally {
          creatingFromBlankRef.current = false
        }
      })()
      return
    }
    const statsSource = buildNoteTextForStats(next.editorMode, next.contentMd, next.mindMap)
    const stats = buildNoteStats(statsSource)
    const nextTitle = next.title.trim() || (next.editorMode === 'mindmap' ? getMindMapPrimaryLabel(next.mindMap) : next.title)
    const patch: Partial<NoteItem> = {
      title: nextTitle,
      contentMd: next.contentMd,
      contentJson: next.contentJson ?? null,
      editorMode: next.editorMode,
      mindMap: next.mindMap ?? null,
      tags: next.tags,
      excerpt: buildPreview(statsSource),
      wordCount: stats.wordCount,
      charCount: stats.charCount,
      paragraphCount: stats.paragraphCount,
      imageCount: stats.imageCount,
      fileCount: stats.fileCount,
      headings: next.editorMode === 'mindmap' ? [] : stats.headings,
    }
    setNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id
          ? {
              ...note,
              ...patch,
              excerpt: buildPreview(statsSource),
            }
          : note,
      ),
    )
    scheduleSave(activeNote.id, patch)
  }

  const handleNavigateToHeading = (headingId: string, headingText: string) => {
    const surface = editorSurfaceRef.current
    if (!surface) return
    const headings = Array.from(surface.querySelectorAll('h1, h2, h3')) as HTMLElement[]
    const target =
      headings.find((heading) => heading.id === headingId) ??
      headings.find((heading) => slugifyHeading(heading.textContent ?? '') === headingId) ??
      headings.find((heading) => (heading.textContent ?? '').trim() === headingText.trim())
    if (!target) return
    target.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const handleTogglePinTag = async (tagId: string) => {
    const target = tags.find((tag) => tag.id === tagId)
    if (!target) return
    const updated = await noteTagsRepo.update(tagId, { pinned: !target.pinned })
    if (!updated) return
    setTags((current) => current.map((tag) => (tag.id === tagId ? updated : tag)))
  }

  const handleCreateTag = async (name: string, parentId?: string | null) => {
    const cleanName = name.trim()
    if (!cleanName) return
    if (tags.some((tag) => tag.name.toLowerCase() === cleanName.toLowerCase())) return
    const nextSortOrder = tags.reduce((max, tag) => Math.max(max, tag.sortOrder), 0) + 1
    const created = await noteTagsRepo.create({
      name: cleanName,
      icon: undefined,
      pinned: false,
      parentId: parentId ?? null,
      sortOrder: nextSortOrder,
    })
    setTags((current) => recomputeTagCounts([...current, created], notes))
  }

  const handleRenameTag = async (tagId: string, nextName: string) => {
    const cleanName = nextName.trim()
    if (!cleanName) return
    const target = tags.find((tag) => tag.id === tagId)
    if (!target) return
    if (tags.some((tag) => tag.id !== tagId && tag.name.toLowerCase() === cleanName.toLowerCase())) return
    const updated = await noteTagsRepo.update(tagId, { name: cleanName })
    if (!updated) return
    const changedNotes = notes.filter((note) => note.tags.includes(target.name))
    if (changedNotes.length > 0) {
      const updates = changedNotes.map((note) => {
        const nextTags = note.tags.map((name) => (name === target.name ? cleanName : name))
        return { id: note.id, nextTags }
      })
      await Promise.all(updates.map((entry) => notesRepo.update(entry.id, { tags: entry.nextTags })))
      setNotes((current) =>
        current.map((note) => {
          const match = updates.find((entry) => entry.id === note.id)
          return match ? { ...note, tags: match.nextTags } : note
        }),
      )
    }
    setTags((current) => recomputeTagCounts(current.map((tag) => (tag.id === tagId ? updated : tag)), notes))
  }

  const handleDeleteTag = async (tagId: string) => {
    const target = tags.find((tag) => tag.id === tagId)
    if (!target) return
    await flushPendingSave()
    const affectedChildren = tags.filter((tag) => tag.parentId === tagId)
    await Promise.all(affectedChildren.map((tag) => noteTagsRepo.update(tag.id, { parentId: null })))
    await noteTagsRepo.remove(tagId)
    const updates = notes
      .filter((note) => note.tags.includes(target.name))
      .map((note) => ({ id: note.id, nextTags: note.tags.filter((tagName) => tagName !== target.name) }))
    if (updates.length > 0) {
      await Promise.all(updates.map((entry) => notesRepo.update(entry.id, { tags: entry.nextTags })))
    }
    const nextNotes = notes.map((note) => {
      const hit = updates.find((entry) => entry.id === note.id)
      return hit ? { ...note, tags: hit.nextTags } : note
    })
    setNotes(nextNotes)
    setTags((current) =>
      recomputeTagCounts(
        current
          .filter((tag) => tag.id !== tagId)
          .map((tag) => (tag.parentId === tagId ? { ...tag, parentId: null } : tag)),
        nextNotes,
      ),
    )
    if (activeTagId === tagId) setActiveTagId(null)
  }

  const handleDropNoteOnTag = async (noteId: string, tagId: string) => {
    void flushPendingSave()
    const targetTag = tags.find((tag) => tag.id === tagId)
    if (!targetTag) return
    const targetNote = notes.find((note) => note.id === noteId)
    if (!targetNote) return
    setActiveCollection('notes')
    setActiveTagId(tagId)
    setSelectedNoteId(noteId)
    const alreadyOnlyTarget = targetNote.tags.length === 1 && containsTagName(targetNote.tags, targetTag.name)
    if (!alreadyOnlyTarget) {
      const nextTags = [targetTag.name]
      const optimistic = { ...targetNote, tags: nextTags }
      const optimisticNotes = notes.map((note) => (note.id === noteId ? optimistic : note))
      setNotes(optimisticNotes)
      setTags((current) => recomputeTagCounts(current, optimisticNotes))
      void notesRepo.update(noteId, { tags: nextTags }).then((updated) => {
        if (!updated) return
        setNotes((current) => {
          const next = current.map((note) => (note.id === noteId ? updated : note))
          setTags((tagCurrent) => recomputeTagCounts(tagCurrent, next))
          return next
        })
      })
    }
  }

  const handleDropTag = async (dragTagId: string, targetTagId: string | null, mode: 'before' | 'after' | 'inside' | 'root') => {
    if (!dragTagId) return
    if (targetTagId === dragTagId) return
    const byId = new Map(tags.map((tag) => [tag.id, tag]))
    const dragTag = byId.get(dragTagId)
    if (!dragTag) return
    if (targetTagId) {
      const targetTag = byId.get(targetTagId)
      if (!targetTag) return
      if (mode === 'inside') {
        let cursor: string | null | undefined = targetTagId
        while (cursor) {
          if (cursor === dragTagId) return
          cursor = byId.get(cursor)?.parentId ?? null
        }
      }
    }

    const siblingParentId =
      mode === 'root' ? null : mode === 'inside' ? targetTagId : byId.get(targetTagId ?? '')?.parentId ?? null
    const originalParentId = dragTag.parentId ?? null
    const siblings = tags
      .filter((tag) => tag.id !== dragTagId && tag.parentId === siblingParentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    let insertIndex = siblings.length
    if (targetTagId && mode !== 'inside') {
      const targetIndex = siblings.findIndex((tag) => tag.id === targetTagId)
      if (targetIndex >= 0) insertIndex = mode === 'before' ? targetIndex : targetIndex + 1
    }
    const reorderedSiblings = [...siblings]
    reorderedSiblings.splice(insertIndex, 0, { ...dragTag, parentId: siblingParentId })
    const siblingSortMap = new Map(reorderedSiblings.map((tag, index) => [tag.id, index + 1]))

    const nextTags = tags.map((tag) => {
      if (tag.id === dragTagId) {
        return {
          ...tag,
          parentId: siblingParentId,
          sortOrder: siblingSortMap.get(tag.id) ?? tag.sortOrder,
        }
      }
      if (tag.parentId === siblingParentId) {
        const nextSortOrder = siblingSortMap.get(tag.id)
        if (nextSortOrder) return { ...tag, sortOrder: nextSortOrder }
      }
      return tag
    })

    const normalizeGroup = (input: NoteTag[], parentId: string | null) => {
      const siblingsInGroup = input.filter((tag) => tag.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder)
      const orderMap = new Map(siblingsInGroup.map((tag, index) => [tag.id, index + 1]))
      return input.map((tag) => {
        if (tag.parentId !== parentId) return tag
        const normalizedOrder = orderMap.get(tag.id)
        return normalizedOrder ? { ...tag, sortOrder: normalizedOrder } : tag
      })
    }
    const normalizedTags = normalizeGroup(normalizeGroup(nextTags, siblingParentId), originalParentId)

    const changed = normalizedTags.filter((tag) => {
      const prev = byId.get(tag.id)
      if (!prev) return false
      return prev.parentId !== tag.parentId || prev.sortOrder !== tag.sortOrder
    })
    if (changed.length === 0) return
    await Promise.all(changed.map((tag) => noteTagsRepo.update(tag.id, { parentId: tag.parentId, sortOrder: tag.sortOrder })))
    setTags(recomputeTagCounts(normalizedTags, notes))
  }

  const handleSelectCollection = (collection: NoteSystemCollection) => {
    setActiveCollection(collection)
    setActiveTagId(null)
    setSelectedNoteId(null)
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

  useEffect(() => {
    if (!openPanel) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-note-floating-panel]')) return
      if (target.closest('[data-note-panel-trigger]')) return
      setOpenPanel(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openPanel])

  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  return (
    <section className="note-page-shell flex h-full max-h-full min-h-0" data-note-theme={effectiveTheme}>
      <div className="note-page-shell__content note-page" data-fullscreen={isFullscreen ? 'true' : 'false'}>
        <NoteSidebar
          className="note-page-column note-page-column--sidebar"
          scrollContainerRef={sidebarScrollRef}
          tags={tagsWithCounts}
          activeCollection={activeCollection}
          activeTagId={activeTagId}
          noteCounts={noteCounts}
          onSelectCollection={handleSelectCollection}
          onSelectTag={handleSelectTag}
          onTogglePinTag={handleTogglePinTag}
          onCreateTag={handleCreateTag}
          onRenameTag={handleRenameTag}
          onDeleteTag={handleDeleteTag}
          onDropNoteOnTag={handleDropNoteOnTag}
          onDropTag={handleDropTag}
        />
        <NoteBrowser
          className="note-page-column note-page-column--browser"
          scrollContainerRef={browserScrollRef}
          notes={filteredNotes}
          selectedNoteId={activeNote?.id ?? null}
          collectionLabel={collectionLabelMap[activeCollection]}
          mode={activeCollection === 'trash' ? 'trash' : 'notes'}
          onSelectNote={async (id) => {
            await flushPendingSave()
            setSelectedNoteId(id)
          }}
          onNewNote={handleCreate}
          onTogglePin={handleTogglePinNote}
          onTrashNote={handleTrashNote}
          onRestoreNote={handleRestoreNote}
          onDeleteNote={handleDeletePermanently}
          sortBy={sortBy}
          onSortChange={setSortBy}
          search={search}
          onSearchChange={setSearch}
        />
        <div className="note-page-column note-page-column--editor relative flex min-w-0 flex-1">
          <>
            <NoteEditor
              noteId={activeNote?.id ?? null}
              surfaceRef={editorSurfaceRef}
              value={activeNoteValue}
              appearance={appearance}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((current) => !current)}
              onOpenInfo={() => setOpenPanel((current) => (current === 'info' ? null : 'info'))}
              onOpenAppearance={() => setOpenPanel((current) => (current === 'appearance' ? null : 'appearance'))}
              onExport={() => setOpenPanel((current) => (current === 'export' ? null : 'export'))}
              hasMindMapFullAccess={hasMindMapFullAccess}
              mindMapCount={activeMindMapCount}
              mindMapLimitReached={mindMapLimitReached}
              onUpgradeMindMap={() => setShowMindMapUpgrade(true)}
              onCreateMindMap={handleCreateMindMap}
              onChange={handleUpdateNote}
            />
            <InfoPopover
              open={openPanel === 'info'}
              note={activeNote}
              onClose={() => setOpenPanel(null)}
              onNavigateToHeading={handleNavigateToHeading}
              onNavigateToNote={(id) => setSelectedNoteId(id)}
            />
            <AppearanceModal open={openPanel === 'appearance'} settings={appearance} onClose={() => setOpenPanel(null)} onUpdate={handleUpdateAppearance} />
            <ExportModal
              open={openPanel === 'export'}
              noteTitle={activeNote?.title.trim() || 'Untitled'}
              onClose={() => setOpenPanel(null)}
              onExportMarkdown={handleExportMarkdown}
            />
          </>
        </div>
      </div>
      {showMindMapUpgrade ? (
        <div className="note-premium-modal" role="dialog" aria-modal="true" aria-label="Mind Map Access">
          <div className="note-premium-modal__card">
            <p className="note-premium-modal__eyebrow">Mind Map</p>
            <h2>{subscription?.role === 'admin' ? 'Mind Map is still marked as in development in Labs.' : 'Mind Map is only visible to admin accounts right now.'}</h2>
            <p>
              {subscription?.role === 'admin'
                ? 'You can continue using it directly in Notes while the Labs entry stays on development status.'
                : 'Switch to an admin account if you need access to visual note mapping.'}
            </p>
            <div className="note-premium-modal__actions">
              <button type="button" className="note-premium-modal__button note-premium-modal__button--ghost" onClick={() => setShowMindMapUpgrade(false)}>
                Close
              </button>
              <a className="note-premium-modal__button" href={ROUTES.LABS} onClick={() => setShowMindMapUpgrade(false)}>
                Open Labs
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
