import { useMemo, useState, type RefObject } from 'react'
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Lightbulb,
  Microscope,
  MoreHorizontal,
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
  onMoveTag: (tagId: string, parentId: string | null) => void
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
  onMoveTag,
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
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Focus&amp;Go</span>
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
              allTags={tags}
              activeTagId={activeTagId}
              onSelect={onSelectTag}
              onTogglePin={onTogglePinTag}
              onCreateTag={onCreateTag}
              onRenameTag={onRenameTag}
              onDeleteTag={onDeleteTag}
              onMoveTag={onMoveTag}
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
              const nextName = window.prompt('New tag name')
              if (nextName) onCreateTag(nextName, null)
            }}
          >
            <Plus size={13} />
          </button>
        </div>
        {tree.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            depth={0}
            allTags={tags}
            activeTagId={activeTagId}
            onSelect={onSelectTag}
            onTogglePin={onTogglePinTag}
            onCreateTag={onCreateTag}
            onRenameTag={onRenameTag}
            onDeleteTag={onDeleteTag}
            onMoveTag={onMoveTag}
          />
        ))}
      </div>
    </aside>
  )
}

function SectionTitle({ children, className }: { children: string; className?: string }) {
  return <div className={cn('mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8d867f] dark:text-slate-400', className)}>{children}</div>
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
      <span className="flex-1 text-[13px]" style={{ fontWeight: active ? 500 : 400 }}>
        {label}
      </span>
      <span className="text-[11px] text-[#8d867f] dark:text-slate-400">{count}</span>
    </button>
  )
}

function TagRow({
  tag,
  depth,
  allTags,
  activeTagId,
  onSelect,
  onTogglePin,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onMoveTag,
}: {
  tag: TreeTag
  depth: number
  allTags: NoteTag[]
  activeTagId: string | null
  onSelect: (id: string) => void
  onTogglePin: (id: string) => void
  onCreateTag: (name: string, parentId?: string | null) => void
  onRenameTag: (tagId: string, nextName: string) => void
  onDeleteTag: (tagId: string) => void
  onMoveTag: (tagId: string, parentId: string | null) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasChildren = tag.children.length > 0
  const isActive = activeTagId === tag.id
  const Icon = tag.icon ? iconMap[tag.icon as keyof typeof iconMap] ?? TagIcon : TagIcon

  return (
    <div>
      <div
        className={cn(
          'group relative flex cursor-pointer items-center gap-1.5 rounded-lg py-[6px] transition-colors',
          isActive ? 'bg-[#f0eeeb] text-[#3a3733] dark:bg-slate-700/40 dark:text-slate-100' : 'hover:bg-[#f0eeeb]/60 dark:hover:bg-slate-700/25',
        )}
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
        <span className="flex-1 truncate text-[13px]" style={{ fontWeight: isActive ? 500 : 400 }}>
          {tag.name}
        </span>
        <span className="text-[11px] text-[#8d867f] opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-400">{tag.noteCount}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setMenuOpen((current) => !current)
          }}
          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-[#3a3733]/5 group-hover:opacity-100 dark:hover:bg-white/10"
        >
          <MoreHorizontal size={12} />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                const nextName = window.prompt('Rename tag', tag.name)
                if (nextName) onRenameTag(tag.id, nextName)
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-accent"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                const childName = window.prompt('Child tag name')
                if (childName) onCreateTag(childName, tag.id)
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-accent"
            >
              Add child
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onMoveTag(tag.id, null)
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-accent"
            >
              Move to root
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                const parentChoices = allTags
                  .filter((candidate) => candidate.id !== tag.id)
                  .map((candidate) => candidate.name)
                  .join(', ')
                const parentName = window.prompt(`Move under which tag?\n${parentChoices}`)
                if (!parentName) {
                  setMenuOpen(false)
                  return
                }
                const parent = allTags.find((candidate) => candidate.name.toLowerCase() === parentName.trim().toLowerCase())
                if (parent) onMoveTag(tag.id, parent.id)
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-accent"
            >
              Move under...
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onTogglePin(tag.id)
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-accent"
            >
              {tag.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              {tag.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDeleteTag(tag.id)
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-destructive hover:bg-destructive/10"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
      {expanded
        ? tag.children.map((child) => (
            <TagRow
              key={child.id}
              tag={child}
              depth={depth + 1}
              allTags={allTags}
              activeTagId={activeTagId}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onCreateTag={onCreateTag}
              onRenameTag={onRenameTag}
              onDeleteTag={onDeleteTag}
              onMoveTag={onMoveTag}
            />
          ))
        : null}
    </div>
  )
}
