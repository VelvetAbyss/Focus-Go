import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Lightbulb,
  Microscope,
  Plus,
  Pin,
  PinOff,
  Sun,
  Tag as TagIcon,
  Trash2,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NoteTag } from '../../../data/models/types'

export type NoteSystemCollection = 'notes' | 'today' | 'untagged' | 'trash'

const iconMap = {
  folder: FolderOpen,
  microscope: Microscope,
  user: User,
  'book-open': BookOpen,
  calendar: Calendar,
  lightbulb: Lightbulb,
} as const

type SidebarProps = {
  tags: NoteTag[]
  activeCollection: NoteSystemCollection | null
  activeTagId: string | null
  noteCounts: { all: number; today: number; untagged: number; trash: number }
  onSelectCollection: (collection: NoteSystemCollection) => void
  onSelectTag: (tagId: string) => void
  onTogglePinTag: (tagId: string) => void
  onCreateTag: (name: string, parentId?: string | null) => void
  onRenameTag: (tagId: string, nextName: string) => void
  onDeleteTag: (tagId: string) => void
  onDropNoteOnTag: (noteId: string, tagId: string) => void
  onDropTag: (dragTagId: string, targetTagId: string | null, mode: 'before' | 'after' | 'inside' | 'root') => void
  className?: string
  scrollContainerRef?: RefObject<HTMLElement | null>
}

type TreeTag = NoteTag & { children: TreeTag[] }

const buildTree = (tags: NoteTag[]) => {
  const map = new Map<string, TreeTag>()
  for (const tag of tags) map.set(tag.id, { ...tag, children: [] })
  const roots: TreeTag[] = []
  for (const tag of map.values()) {
    if (tag.parentId && map.has(tag.parentId)) {
      map.get(tag.parentId)?.children.push(tag)
    } else {
      roots.push(tag)
    }
  }
  return roots.sort((a, b) => a.sortOrder - b.sortOrder)
}

export default function NoteSidebar({
  tags,
  activeCollection,
  activeTagId,
  noteCounts,
  onSelectCollection,
  onSelectTag,
  onTogglePinTag,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onDropNoteOnTag,
  onDropTag,
  className,
  scrollContainerRef,
}: SidebarProps) {
  const tree = useMemo(() => buildTree(tags), [tags])
  const pinned = useMemo(() => tags.filter((tag) => tag.pinned).sort((a, b) => a.sortOrder - b.sortOrder), [tags])

  return (
    <aside
      ref={scrollContainerRef}
      className={cn(
        'flex h-full w-[240px] min-w-[240px] flex-col overflow-y-auto overscroll-contain border-r border-[#e5e2dd] bg-[#f5f3f0] dark:border-slate-700/40 dark:bg-[#3a3733]',
        className,
      )}
    >
      <div className="px-5 pb-3 pt-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
            <span className="text-[11px] font-bold tracking-tight text-background">F</span>
          </div>
          <span className="text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">Focus&amp;Go</span>
        </div>
      </div>

      <div className="mt-2 px-3">
        <CollectionButton icon={FileText} label="Notes" count={noteCounts.all} active={activeCollection === 'notes'} onClick={() => onSelectCollection('notes')} />
        <CollectionButton icon={Sun} label="Today" count={noteCounts.today} active={activeCollection === 'today'} onClick={() => onSelectCollection('today')} />
        <CollectionButton icon={TagIcon} label="Untagged" count={noteCounts.untagged} active={activeCollection === 'untagged'} onClick={() => onSelectCollection('untagged')} />
        <CollectionButton icon={Trash2} label="Trash" count={noteCounts.trash} active={activeCollection === 'trash'} onClick={() => onSelectCollection('trash')} />
      </div>

      {pinned.length > 0 ? (
        <div className="mt-5 px-3">
          <SectionTitle>Pinned</SectionTitle>
          {pinned.map((tag) => (
            <TagRow
              key={`pin-${tag.id}`}
              tag={{ ...tag, children: [] }}
              depth={0}
              activeTagId={activeTagId}
              onSelect={onSelectTag}
              onTogglePin={onTogglePinTag}
              onRenameTag={onRenameTag}
              onDeleteTag={onDeleteTag}
              onDropNoteOnTag={onDropNoteOnTag}
              onDropTag={onDropTag}
              enableTagDnd={false}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex-1 px-3 pb-5">
        <div className="mb-1.5 flex items-center justify-between px-2">
          <SectionTitle className="mb-0 px-0">Tags</SectionTitle>
          <button
            type="button"
            className="rounded p-1 text-[#8d867f] transition-colors hover:bg-[#f0eeeb] dark:text-slate-300 dark:hover:bg-slate-700/30"
            title="New tag"
            onClick={() => {
              const parentId = activeTagId && tags.some((tag) => tag.id === activeTagId) ? activeTagId : null
              onCreateTag('New tag', parentId)
            }}
          >
            <Plus size={13} />
          </button>
        </div>
        <div
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('application/x-focus-tag-id')) event.preventDefault()
          }}
          onDrop={(event) => {
            const dragTagId = event.dataTransfer.getData('application/x-focus-tag-id')
            if (!dragTagId) return
            event.preventDefault()
            onDropTag(dragTagId, null, 'root')
          }}
        >
          {tree.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              depth={0}
              activeTagId={activeTagId}
              onSelect={onSelectTag}
              onTogglePin={onTogglePinTag}
              onRenameTag={onRenameTag}
              onDeleteTag={onDeleteTag}
              onDropNoteOnTag={onDropNoteOnTag}
              onDropTag={onDropTag}
              enableTagDnd
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

function SectionTitle({ children, className }: { children: string; className?: string }) {
  return <div className={cn('mb-1.5 px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#8d867f] dark:text-slate-400', className)}>{children}</div>
}

function CollectionButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-colors',
        active ? 'bg-[#f0eeeb] text-[#3a3733] dark:bg-slate-700/40 dark:text-slate-100' : 'text-[#66615b] hover:bg-[#f0eeeb]/70 dark:text-slate-300 dark:hover:bg-slate-700/25',
      )}
    >
      <Icon size={16} className={active ? 'text-[#3a3733] dark:text-slate-100' : 'text-[#8d867f] dark:text-slate-400'} />
      <span className="flex-1 text-[0.875rem]" style={{ fontWeight: active ? 500 : 400 }}>
        {label}
      </span>
      <span className="text-[0.75rem] tabular-nums text-[#8d867f] dark:text-slate-400">{count}</span>
    </button>
  )
}

function TagRow({
  tag,
  depth,
  activeTagId,
  onSelect,
  onTogglePin,
  onRenameTag,
  onDeleteTag,
  onDropNoteOnTag,
  onDropTag,
  enableTagDnd,
}: {
  tag: TreeTag
  depth: number
  activeTagId: string | null
  onSelect: (id: string) => void
  onTogglePin: (id: string) => void
  onRenameTag: (tagId: string, nextName: string) => void
  onDeleteTag: (tagId: string) => void
  onDropNoteOnTag: (noteId: string, tagId: string) => void
  onDropTag: (dragTagId: string, targetTagId: string, mode: 'before' | 'after' | 'inside') => void
  enableTagDnd: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(tag.name)
  const [dragPlacement, setDragPlacement] = useState<'before' | 'inside' | 'after' | null>(null)
  const [isNoteHover, setIsNoteHover] = useState(false)
  const dragImageRef = useRef<HTMLElement | null>(null)
  const hasChildren = tag.children.length > 0
  const isActive = activeTagId === tag.id
  const Icon = tag.icon ? iconMap[tag.icon as keyof typeof iconMap] ?? TagIcon : TagIcon
  useEffect(() => {
    if (!isRenaming) setDraftName(tag.name)
  }, [isRenaming, tag.name])

  const commitRename = () => {
    const next = draftName.trim()
    if (next && next !== tag.name) onRenameTag(tag.id, next)
    setIsRenaming(false)
  }

  return (
    <div>
      <div
        className={cn(
          'group relative flex cursor-pointer items-center gap-1.5 rounded-lg py-[6px] transition-[background-color,color,transform,box-shadow,opacity] duration-200 ease-out',
          isActive ? 'bg-[#f0eeeb] text-[#3a3733] dark:bg-slate-700/40 dark:text-slate-100' : 'hover:bg-[#f0eeeb]/60 dark:hover:bg-slate-700/25',
          dragPlacement === 'inside' && 'ring-1 ring-[#3a3733]/25 bg-[#f0eeeb]/70',
          isNoteHover && 'ring-1 ring-[#3a3733]/30 bg-[#f0eeeb]/70',
        )}
        draggable={enableTagDnd}
        onDragStart={(event) => {
          if (!enableTagDnd) return
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('application/x-focus-tag-id', tag.id)
          const source = event.currentTarget as HTMLDivElement
          const rect = source.getBoundingClientRect()
          const clone = source.cloneNode(true) as HTMLDivElement
          clone.style.position = 'fixed'
          clone.style.top = '-10000px'
          clone.style.left = '-10000px'
          clone.style.width = `${rect.width}px`
          clone.style.height = `${rect.height}px`
          clone.style.maxWidth = `${rect.width}px`
          clone.style.boxSizing = 'border-box'
          clone.style.opacity = '0.4'
          clone.style.pointerEvents = 'none'
          clone.style.margin = '0'
          document.body.appendChild(clone)
          dragImageRef.current = clone
          event.dataTransfer.setDragImage(clone, 16, 12)
        }}
        onDragEnd={() => {
          setDragPlacement(null)
          setIsNoteHover(false)
          const node = dragImageRef.current
          if (node) {
            node.remove()
            dragImageRef.current = null
          }
        }}
        onDragOver={(event) => {
          const types = Array.from(event.dataTransfer.types)
          const incomingTag = types.includes('application/x-focus-tag-id')
          const incomingNote = types.includes('application/x-focus-note-id') || types.includes('text/plain')
          if (!incomingTag && !incomingNote) return
          event.preventDefault()
          if (incomingNote && !incomingTag) {
            setIsNoteHover(true)
            setDragPlacement(null)
            return
          }
          setIsNoteHover(false)
          if (!incomingTag || !enableTagDnd) return
          const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect()
          const ratio = (event.clientY - rect.top) / Math.max(1, rect.height)
          const beforeLimit = dragPlacement === 'before' ? 0.42 : 0.3
          const afterLimit = dragPlacement === 'after' ? 0.58 : 0.7
          if (ratio < beforeLimit) setDragPlacement('before')
          else if (ratio > afterLimit) setDragPlacement('after')
          else setDragPlacement('inside')
        }}
        onDragLeave={(event) => {
          // Ignore internal child transitions to avoid flicker.
          // dragleave fires frequently when crossing descendants.
          const nextTarget = event.relatedTarget as Node | null
          if (nextTarget && (event.currentTarget as HTMLDivElement).contains(nextTarget)) return
          setDragPlacement(null)
          setIsNoteHover(false)
        }}
        onDrop={(event) => {
          event.stopPropagation()
          const dragTagId = event.dataTransfer.getData('application/x-focus-tag-id')
          const dragNoteId = event.dataTransfer.getData('application/x-focus-note-id') || event.dataTransfer.getData('text/plain')
          if (!dragTagId && !dragNoteId) return
          event.preventDefault()
          if (dragNoteId && !dragTagId) {
            onDropNoteOnTag(dragNoteId, tag.id)
            setDragPlacement(null)
            setIsNoteHover(false)
            return
          }
          if (dragTagId && enableTagDnd && dragTagId !== tag.id) {
            onDropTag(dragTagId, tag.id, dragPlacement ?? 'inside')
          }
          setDragPlacement(null)
          setIsNoteHover(false)
        }}
        style={{ paddingLeft: `${10 + depth * 16}px`, paddingRight: '8px' }}
        role="button"
        tabIndex={0}
        aria-label={tag.name}
        onClick={() => onSelect(tag.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setExpanded((current) => !current)
            }}
            className="rounded p-0.5 hover:bg-[#3a3733]/5 dark:hover:bg-white/10"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <div className="w-4" />
        )}
        <Icon size={14} className="text-[#8d867f] dark:text-slate-400" />
        {isRenaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') {
                event.preventDefault()
                commitRename()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setDraftName(tag.name)
                setIsRenaming(false)
              }
            }}
            className="h-6 flex-1 rounded border border-[#3a3733]/20 bg-transparent px-1 text-[0.875rem] outline-none"
          />
        ) : (
          <span
            className="flex-1 truncate text-[0.875rem]"
            style={{ fontWeight: isActive ? 500 : 400 }}
            onDoubleClick={(event) => {
              event.stopPropagation()
              setIsRenaming(true)
            }}
          >
            {tag.name}
          </span>
        )}
        {dragPlacement === 'before' ? <span className="pointer-events-none absolute left-2 right-2 top-0 h-[2px] rounded-full bg-[#3a3733]/45" /> : null}
        {dragPlacement === 'after' ? <span className="pointer-events-none absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#3a3733]/45" /> : null}
        {dragPlacement === 'inside' || isNoteHover ? (
          <span className="mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#3a3733] px-1 text-[10px] font-semibold leading-none text-white">+</span>
        ) : null}
        <span className="text-[0.75rem] tabular-nums text-[#8d867f] transition-opacity group-hover:opacity-0 dark:text-slate-400">{tag.noteCount}</span>
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onTogglePin(tag.id)
            }}
            className="rounded p-1 hover:bg-[#3a3733]/5 dark:hover:bg-white/10"
            title={tag.pinned ? 'Unpin' : 'Pin'}
          >
            {tag.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDeleteTag(tag.id)
            }}
            className="rounded p-1 text-destructive hover:bg-destructive/10"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {expanded
        ? tag.children.map((child) => (
            <TagRow
              key={child.id}
              tag={child}
              depth={depth + 1}
              activeTagId={activeTagId}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onRenameTag={onRenameTag}
              onDeleteTag={onDeleteTag}
              onDropNoteOnTag={onDropNoteOnTag}
              onDropTag={onDropTag}
              enableTagDnd={enableTagDnd}
            />
          ))
        : null}
    </div>
  )
}
