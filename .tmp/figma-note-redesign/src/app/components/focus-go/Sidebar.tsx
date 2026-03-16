import { useState } from "react";
import {
  FileText,
  Sun,
  Tag as TagIcon,
  Trash2,
  ChevronRight,
  ChevronDown,
  Pin,
  PinOff,
  Pencil,
  Smile,
  MoreHorizontal,
  FolderOpen,
  Microscope,
  User,
  BookOpen,
  Calendar,
  Lightbulb,
  X,
} from "lucide-react";
import type { Tag, SystemCollection } from "./types";

const iconMap: Record<string, React.ElementType> = {
  folder: FolderOpen,
  microscope: Microscope,
  user: User,
  "book-open": BookOpen,
  calendar: Calendar,
  lightbulb: Lightbulb,
};

interface SidebarProps {
  tags: Tag[];
  activeCollection: SystemCollection | null;
  activeTagId: string | null;
  noteCounts: { all: number; today: number; untagged: number; trash: number };
  onSelectCollection: (c: SystemCollection) => void;
  onSelectTag: (tagId: string) => void;
  onOpenTrash: () => void;
  onTogglePinTag: (tagId: string) => void;
}

export function Sidebar({
  tags,
  activeCollection,
  activeTagId,
  noteCounts,
  onSelectCollection,
  onSelectTag,
  onOpenTrash,
  onTogglePinTag,
}: SidebarProps) {
  const pinnedTags = tags.filter((t) => t.pinned);

  return (
    <div className="w-[240px] min-w-[240px] h-full flex flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)]">
      {/* Logo */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background text-[11px] tracking-tight" style={{ fontWeight: 700 }}>F</span>
          </div>
          <span className="tracking-tight text-foreground" style={{ fontSize: "15px", fontWeight: 600 }}>Focus&Go</span>
        </div>
      </div>

      {/* System Collections */}
      <div className="px-3 mt-2">
        <CollectionItem
          icon={FileText}
          label="Notes"
          count={noteCounts.all}
          active={activeCollection === "notes"}
          onClick={() => onSelectCollection("notes")}
        />
        <CollectionItem
          icon={Sun}
          label="Today"
          count={noteCounts.today}
          active={activeCollection === "today"}
          onClick={() => onSelectCollection("today")}
        />
        <CollectionItem
          icon={TagIcon}
          label="Untagged"
          count={noteCounts.untagged}
          active={activeCollection === "untagged"}
          onClick={() => onSelectCollection("untagged")}
        />
        <CollectionItem
          icon={Trash2}
          label="Trash"
          count={noteCounts.trash}
          active={activeCollection === "trash"}
          onClick={() => {
            onSelectCollection("trash");
            onOpenTrash();
          }}
        />
      </div>

      {/* Pinned Tags */}
      {pinnedTags.length > 0 && (
        <div className="px-3 mt-5">
          <div className="px-2 mb-1.5 text-muted-foreground uppercase tracking-widest" style={{ fontSize: "10px", fontWeight: 600 }}>
            Pinned
          </div>
          {pinnedTags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              depth={0}
              activeTagId={activeTagId}
              onSelect={onSelectTag}
              onTogglePin={onTogglePinTag}
            />
          ))}
        </div>
      )}

      {/* Tag Tree */}
      <div className="px-3 mt-5 flex-1 overflow-y-auto">
        <div className="px-2 mb-1.5 text-muted-foreground uppercase tracking-widest" style={{ fontSize: "10px", fontWeight: 600 }}>
          Tags
        </div>
        {tags.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            depth={0}
            activeTagId={activeTagId}
            onSelect={onSelectTag}
            onTogglePin={onTogglePinTag}
          />
        ))}
      </div>
    </div>
  );
}

function CollectionItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg transition-colors text-left group ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-accent/60"
      }`}
    >
      <Icon size={16} className={active ? "text-foreground" : "text-muted-foreground"} />
      <span className="flex-1" style={{ fontSize: "13px", fontWeight: active ? 500 : 400 }}>{label}</span>
      <span className="text-muted-foreground" style={{ fontSize: "11px" }}>{count}</span>
    </button>
  );
}

function TagRow({
  tag,
  depth,
  activeTagId,
  onSelect,
  onTogglePin,
}: {
  tag: Tag;
  depth: number;
  activeTagId: string | null;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const hasChildren = tag.children && tag.children.length > 0;
  const isActive = activeTagId === tag.id;
  const IconComponent = tag.icon ? iconMap[tag.icon] || TagIcon : TagIcon;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-[6px] rounded-lg transition-colors cursor-pointer group relative ${
          isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
        }`}
        style={{ paddingLeft: `${10 + depth * 16}px`, paddingRight: "8px" }}
        onClick={() => onSelect(tag.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
        {!hasChildren && <div className="w-[16px]" />}
        <IconComponent size={14} className="text-muted-foreground" />
        <span className="flex-1 truncate" style={{ fontSize: "13px", fontWeight: isActive ? 500 : 400 }}>{tag.name}</span>
        <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: "11px" }}>
          {tag.noteCount}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/5 rounded"
        >
          <MoreHorizontal size={12} />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border bg-popover p-1 shadow-lg">
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(tag.id); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent text-left"
              style={{ fontSize: "12px" }}
            >
              {tag.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              {tag.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent text-left"
              style={{ fontSize: "12px" }}
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
            >
              <Pencil size={12} /> Rename
            </button>
            <button
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent text-left"
              style={{ fontSize: "12px" }}
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
            >
              <Smile size={12} /> Change Icon
            </button>
            <button
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-destructive/10 text-destructive text-left"
              style={{ fontSize: "12px" }}
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
            >
              <X size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {tag.children!.map((child) => (
            <TagRow
              key={child.id}
              tag={child}
              depth={depth + 1}
              activeTagId={activeTagId}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
