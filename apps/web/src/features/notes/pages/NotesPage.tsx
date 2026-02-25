import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Trash2 } from 'lucide-react'
import type { NoteEntity } from '../../../data/models/types'
import { notesRepo } from '../../../data/repositories/notesRepo'
import NoteEditor from '../components/NoteEditor'
import { collectTagSuggestions, extractHashTagsFromMarkdown, filterNotesByTagAndKeyword, mergeTags } from '../model/tags'
import '../notes.css'

const formatTime = (value: number) => new Date(value).toLocaleString()

const fallbackTitle = (title: string) => {
  const trimmed = title.trim()
  return trimmed.length > 0 ? trimmed : 'Untitled'
}

const buildPreview = (contentMd: string) => {
  const compact = contentMd.replace(/\s+/g, ' ').trim()
  if (!compact) return 'Empty note'
  return compact.length > 72 ? `${compact.slice(0, 72)}…` : compact
}

const NotesPage = () => {
  const [notes, setNotes] = useState<NoteEntity[]>([])
  const [trash, setTrash] = useState<NoteEntity[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [keyword, setKeyword] = useState('')
  const saveTimerRef = useRef<number | null>(null)

  const refreshNotes = async () => {
    await notesRepo.purgeExpiredTrash()
    const [active, deleted] = await Promise.all([notesRepo.listActive(), notesRepo.listTrash()])
    setNotes(active)
    setTrash(deleted)
    setActiveId((prev) => {
      if (prev && active.some((note) => note.id === prev)) return prev
      return active[0]?.id ?? null
    })
  }

  useEffect(() => {
    let cancelled = false
    void notesRepo
      .purgeExpiredTrash()
      .then(() => Promise.all([notesRepo.listActive(), notesRepo.listTrash()]))
      .then(([active, deleted]) => {
        if (cancelled) return
        setNotes(active)
        setTrash(deleted)
        setActiveId((prev) => {
          if (prev && active.some((note) => note.id === prev)) return prev
          return active[0]?.id ?? null
        })
      })

    return () => {
      cancelled = true
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [])

  const tagSuggestions = useMemo(() => collectTagSuggestions(notes), [notes])
  const filteredNotes = useMemo(
    () => filterNotesByTagAndKeyword(notes, { selectedTag: selectedTag || null, keyword }),
    [notes, selectedTag, keyword],
  )
  const resolvedActiveId = useMemo(() => {
    if (!filteredNotes.length) return null
    if (activeId && filteredNotes.some((note) => note.id === activeId)) return activeId
    return filteredNotes[0]?.id ?? null
  }, [filteredNotes, activeId])
  const activeNote = useMemo(() => filteredNotes.find((note) => note.id === resolvedActiveId) ?? null, [filteredNotes, resolvedActiveId])

  const openNote = (id: string) => {
    setActiveId(id)
  }

  const scheduleSave = (next: NoteEntity) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      void notesRepo.save(next).then(() => refreshNotes())
    }, 260)
  }

  const handleEditorChange = (patch: { title: string; contentMd: string; contentJson: Record<string, unknown> | null; manualTags: string[] }) => {
    if (!activeNote) return
    const autoTags = extractHashTagsFromMarkdown(patch.contentMd)
    const mergedTags = mergeTags(patch.manualTags, autoTags)
    const next = {
      ...activeNote,
      title: patch.title,
      contentMd: patch.contentMd,
      contentJson: patch.contentJson,
      manualTags: patch.manualTags,
      tags: mergedTags,
      updatedAt: Date.now(),
    }

    setNotes((prev) => prev.map((note) => (note.id === next.id ? next : note)).sort((a, b) => b.updatedAt - a.updatedAt))
    scheduleSave(next)
  }

  const handleCreate = async () => {
    const created = await notesRepo.create()
    await refreshNotes()
    openNote(created.id)
  }

  const handleDelete = async (id: string) => {
    await notesRepo.softDelete(id)
    await refreshNotes()
  }

  const handleRestore = async (id: string) => {
    await notesRepo.restore(id)
    await refreshNotes()
  }

  return (
    <section className="notes-page">
      <Card className="notes-panel notes-list" aria-label="Notes list">
        <CardHeader className="notes-list__header">
          <div className="notes-list__heading-row">
            <CardTitle className="notes-list__title">Notes</CardTitle>
            <Button type="button" onClick={handleCreate} className="notes-list__new-btn">
              New note
            </Button>
          </div>
          <div className="notes-list__filters">
            <Select value={selectedTag || '__all'} onValueChange={(value) => setSelectedTag(value === '__all' ? '' : value)}>
              <SelectTrigger className="notes-list__filter-select">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All tags</SelectItem>
                {tagSuggestions.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    #{tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search title, content, tags" className="notes-list__filter-input" />
          </div>
        </CardHeader>

        <CardContent className="notes-list__content">
          <ScrollArea className="notes-list__items">
            <div className="notes-list__stack">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className={`notes-note-item ${note.id === resolvedActiveId ? 'is-active' : ''}`}
                  onClick={() => openNote(note.id)}
                >
                  <div className="notes-note-item__actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="notes-note-item__delete"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void handleDelete(note.id)
                      }}
                      aria-label="Move note to trash"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="notes-note-item__content">
                    <p className="notes-note-item__title">{fallbackTitle(note.title)}</p>
                    <p className="notes-note-item__meta">Updated {formatTime(note.updatedAt)}</p>
                    <p className="notes-note-item__preview">{buildPreview(note.contentMd)}</p>
                    {note.tags.length > 0 ? (
                      <div className="notes-note-item__tags">
                        {note.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="notes-note-item__tag">
                            #{tag}
                          </span>
                        ))}
                        {note.tags.length > 2 ? <span className="notes-note-item__tag">+{note.tags.length - 2}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          <Separator className="my-3" />

          <div className="notes-list__trash" aria-label="Recently deleted notes">
            <div className="flex items-center gap-2">
              <p className="muted">Recently deleted</p>
              <Badge variant="secondary">{trash.length}</Badge>
            </div>
            {trash.map((note) => (
              <div key={note.id} className="notes-note-item">
                <p className="notes-note-item__title">{fallbackTitle(note.title)}</p>
                <p className="notes-note-item__meta">Auto remove in 7 days</p>
                <div className="notes-button-row">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleRestore(note.id)}>
                    Restore
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void notesRepo.hardDelete(note.id).then(() => refreshNotes())
                    }}
                  >
                    Delete now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="notes-panel notes-editor-shell" aria-label="Notes editor">
        <CardContent className="notes-editor-shell__content">
          {activeNote ? (
            <NoteEditor
              key={activeNote.id}
              noteId={activeNote.id}
              title={activeNote.title}
              contentMd={activeNote.contentMd}
              contentJson={activeNote.contentJson}
              manualTags={activeNote.manualTags}
              allTagSuggestions={tagSuggestions}
              onChange={handleEditorChange}
            />
          ) : (
            <div className="notes-editor-shell__empty-state">
              <p className="notes-editor-shell__empty">No note selected.</p>
              <Button type="button" onClick={handleCreate}>
                New note
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export default NotesPage
