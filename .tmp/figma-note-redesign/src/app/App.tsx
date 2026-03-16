import { useState, useCallback, useMemo } from "react";
import { Sidebar } from "./components/focus-go/Sidebar";
import { NoteBrowser } from "./components/focus-go/NoteBrowser";
import { Editor } from "./components/focus-go/Editor";
import { TrashModal } from "./components/focus-go/TrashModal";
import { AppearanceModal } from "./components/focus-go/AppearanceModal";
import { ExportModal } from "./components/focus-go/ExportModal";
import { InfoPopover } from "./components/focus-go/InfoPopover";
import { mockTags, mockNotes, trashedNotes as initialTrashedNotes } from "./components/focus-go/mock-data";
import type { Note, Tag, SystemCollection, AppearanceSettings } from "./components/focus-go/types";

export default function App() {
  // Core state
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [tags, setTags] = useState<Tag[]>(mockTags);
  const [trashedNotes, setTrashedNotes] = useState<Note[]>(initialTrashedNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>("n1");
  const [activeCollection, setActiveCollection] = useState<SystemCollection | null>("notes");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  // Modal state
  const [showTrash, setShowTrash] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Appearance settings
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme: "paper",
    font: "sans",
    fontSize: 15,
    lineHeight: 1.7,
    contentWidth: 50,
    focusMode: false,
  });

  // Derived data
  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  const collectionLabel = useMemo(() => {
    if (activeTagId) {
      const findTag = (tags: Tag[]): Tag | undefined => {
        for (const t of tags) {
          if (t.id === activeTagId) return t;
          if (t.children) {
            const found = findTag(t.children);
            if (found) return found;
          }
        }
      };
      return findTag(tags)?.name || "Notes";
    }
    if (activeCollection === "notes") return "All Notes";
    if (activeCollection === "today") return "Today";
    if (activeCollection === "untagged") return "Untagged";
    return "Notes";
  }, [activeCollection, activeTagId, tags]);

  const filteredNotes = useMemo(() => {
    if (activeTagId) {
      const findTagName = (tags: Tag[]): string | undefined => {
        for (const t of tags) {
          if (t.id === activeTagId) return t.name;
          if (t.children) {
            const found = findTagName(t.children);
            if (found) return found;
          }
        }
      };
      const tagName = findTagName(tags);
      if (tagName) return notes.filter((n) => n.tags.includes(tagName));
    }
    if (activeCollection === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return notes.filter((n) => n.updatedAt >= today);
    }
    if (activeCollection === "untagged") {
      return notes.filter((n) => n.tags.length === 0);
    }
    return notes;
  }, [notes, activeCollection, activeTagId, tags]);

  const todayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return notes.filter((n) => n.updatedAt >= today).length;
  }, [notes]);

  const noteCounts = {
    all: notes.length,
    today: todayCount,
    untagged: notes.filter((n) => n.tags.length === 0).length,
    trash: trashedNotes.length,
  };

  // Handlers
  const handleSelectCollection = useCallback((c: SystemCollection) => {
    setActiveCollection(c);
    setActiveTagId(null);
  }, []);

  const handleSelectTag = useCallback((tagId: string) => {
    setActiveTagId(tagId);
    setActiveCollection(null);
  }, []);

  const handleTogglePinTag = useCallback((tagId: string) => {
    const toggleInList = (tags: Tag[]): Tag[] =>
      tags.map((t) =>
        t.id === tagId
          ? { ...t, pinned: !t.pinned }
          : t.children
          ? { ...t, children: toggleInList(t.children) }
          : t
      );
    setTags(toggleInList);
  }, []);

  const handleTogglePinNote = useCallback((noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n))
    );
  }, []);

  const handleTrashNote = useCallback((noteId: string) => {
    setNotes((prev) => {
      const note = prev.find((n) => n.id === noteId);
      if (note) {
        setTrashedNotes((t) => [{ ...note, trashedAt: new Date() }, ...t]);
      }
      return prev.filter((n) => n.id !== noteId);
    });
    if (selectedNoteId === noteId) {
      setSelectedNoteId(null);
    }
  }, [selectedNoteId]);

  const handleRestoreNote = useCallback((noteId: string) => {
    setTrashedNotes((prev) => {
      const note = prev.find((n) => n.id === noteId);
      if (note) {
        const { trashedAt, ...restored } = note;
        setNotes((n) => [restored as Note, ...n]);
      }
      return prev.filter((n) => n.id !== noteId);
    });
  }, []);

  const handleDeletePermanently = useCallback((noteId: string) => {
    setTrashedNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const handleNewNote = useCallback(() => {
    const newNote: Note = {
      id: `n${Date.now()}`,
      title: "Untitled",
      content: "",
      preview: "",
      tags: activeTagId
        ? (() => {
            const findTagName = (tags: Tag[]): string | undefined => {
              for (const t of tags) {
                if (t.id === activeTagId) return t.name;
                if (t.children) {
                  const found = findTagName(t.children);
                  if (found) return found;
                }
              }
            };
            const name = findTagName(tags);
            return name ? [name] : [];
          })()
        : [],
      pinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      wordCount: 0,
      charCount: 0,
      paragraphCount: 0,
      imageCount: 0,
      fileCount: 0,
      headings: [],
      backlinks: [],
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
  }, [activeTagId, tags]);

  const handleUpdateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date() } : n))
    );
  }, []);

  const handleNavigateToNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
    setActiveCollection("notes");
    setActiveTagId(null);
    setShowInfo(false);
  }, []);

  const handleUpdateAppearance = useCallback((updates: Partial<AppearanceSettings>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...updates };
      // Apply theme
      if (updates.theme !== undefined) {
        if (updates.theme === "graphite") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
      return next;
    });
  }, []);

  const showSidebar = !appearance.focusMode;
  const showBrowser = !appearance.focusMode;

  return (
    <div className="size-full flex bg-background overflow-hidden">
      {/* Sidebar */}
      {showSidebar && (
        <Sidebar
          tags={tags}
          activeCollection={activeCollection}
          activeTagId={activeTagId}
          noteCounts={noteCounts}
          onSelectCollection={handleSelectCollection}
          onSelectTag={handleSelectTag}
          onOpenTrash={() => setShowTrash(true)}
          onTogglePinTag={handleTogglePinTag}
        />
      )}

      {/* Note Browser */}
      {showBrowser && (
        <NoteBrowser
          notes={filteredNotes}
          selectedNoteId={selectedNoteId}
          collectionLabel={collectionLabel}
          onSelectNote={setSelectedNoteId}
          onNewNote={handleNewNote}
          onTogglePin={handleTogglePinNote}
          onTrashNote={handleTrashNote}
        />
      )}

      {/* Editor */}
      <div className="flex-1 relative">
        <Editor
          note={selectedNote}
          appearance={appearance}
          onOpenInfo={() => setShowInfo(!showInfo)}
          onOpenAppearance={() => setShowAppearance(true)}
          onOpenExport={() => setShowExport(true)}
          onUpdateNote={handleUpdateNote}
        />

        {/* Info Popover */}
        {selectedNote && (
          <InfoPopover
            open={showInfo}
            onClose={() => setShowInfo(false)}
            note={selectedNote}
            onNavigateToNote={handleNavigateToNote}
          />
        )}
      </div>

      {/* Modals */}
      <TrashModal
        open={showTrash}
        onClose={() => setShowTrash(false)}
        trashedNotes={trashedNotes}
        onRestore={handleRestoreNote}
        onDeletePermanently={handleDeletePermanently}
      />
      <AppearanceModal
        open={showAppearance}
        onClose={() => setShowAppearance(false)}
        settings={appearance}
        onUpdate={handleUpdateAppearance}
      />
      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        noteTitle={selectedNote?.title || ""}
      />
    </div>
  );
}
