import { useState } from "react";
import {
  Info,
  Palette,
  Download,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Link,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Table,
  Image,
  Paperclip,
  AtSign,
  ChevronDown,
  ChevronRight,
  FileText,
  Type,
} from "lucide-react";
import type { Note, AppearanceSettings } from "./types";

interface EditorProps {
  note: Note | null;
  appearance: AppearanceSettings;
  onOpenInfo: () => void;
  onOpenAppearance: () => void;
  onOpenExport: () => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
}

const fontFamilyMap = {
  sans: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  serif: "'Georgia', 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', 'Consolas', monospace",
};

export function Editor({
  note,
  appearance,
  onOpenInfo,
  onOpenAppearance,
  onOpenExport,
  onUpdateNote,
}: EditorProps) {
  const [activeFormat, setActiveFormat] = useState<string | null>(null);
  const [blockType, setBlockType] = useState("paragraph");
  const [showBlockMenu, setShowBlockMenu] = useState(false);

  if (!note) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p style={{ fontSize: "14px" }}>Select a note to start writing</p>
          <p style={{ fontSize: "12px" }} className="mt-1 opacity-60">or create a new one</p>
        </div>
      </div>
    );
  }

  const contentWidthPx = 560 + (appearance.contentWidth / 100) * 240;

  const blockTypes = [
    { id: "paragraph", label: "Paragraph", icon: Pilcrow },
    { id: "h1", label: "Heading 1", icon: Heading1 },
    { id: "h2", label: "Heading 2", icon: Heading2 },
    { id: "h3", label: "Heading 3", icon: Heading3 },
    { id: "bullet", label: "Bullet List", icon: List },
    { id: "ordered", label: "Ordered List", icon: ListOrdered },
    { id: "task", label: "Task List", icon: CheckSquare },
  ];

  const currentBlock = blockTypes.find((b) => b.id === blockType);

  return (
    <div className="flex-1 h-full flex flex-col bg-background overflow-hidden">
      {/* Top actions */}
      <div className="flex items-center justify-end px-5 pt-3 pb-1 gap-1">
        <button
          onClick={onOpenInfo}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          style={{ fontSize: "12px" }}
        >
          <Info size={14} />
          <span>Info</span>
        </button>
        <button
          onClick={onOpenAppearance}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          style={{ fontSize: "12px" }}
        >
          <Palette size={14} />
          <span>Appearance</span>
        </button>
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          style={{ fontSize: "12px" }}
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="mx-auto px-8 py-6"
          style={{
            maxWidth: `${contentWidthPx}px`,
            fontFamily: fontFamilyMap[appearance.font],
          }}
        >
          {/* Title */}
          <input
            type="text"
            value={note.title}
            onChange={(e) => onUpdateNote(note.id, { title: e.target.value })}
            className="w-full bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/40 mb-1"
            style={{
              fontSize: `${Math.max(24, appearance.fontSize * 1.8)}px`,
              fontWeight: 600,
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
            }}
            placeholder="Untitled"
          />

          {/* Tags */}
          {note.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mb-6 mt-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-accent text-muted-foreground"
                  style={{ fontSize: "11px" }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Rich content area */}
          <div
            className="prose-area"
            style={{
              fontSize: `${appearance.fontSize}px`,
              lineHeight: appearance.lineHeight,
            }}
          >
            {/* Render note content as rich blocks */}
            <RichContent content={note.content} />
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center px-4 py-2 gap-0.5">
          {/* Block type selector */}
          <div className="relative mr-2">
            <button
              onClick={() => setShowBlockMenu(!showBlockMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent transition-colors text-muted-foreground"
              style={{ fontSize: "12px" }}
            >
              {currentBlock && <currentBlock.icon size={14} />}
              <span>{currentBlock?.label}</span>
              <ChevronDown size={10} />
            </button>
            {showBlockMenu && (
              <div className="absolute left-0 bottom-full z-50 mb-1 w-44 rounded-lg border bg-popover p-1 shadow-lg">
                {blockTypes.map((bt) => (
                  <button
                    key={bt.id}
                    onClick={() => { setBlockType(bt.id); setShowBlockMenu(false); }}
                    className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-md hover:bg-accent ${blockType === bt.id ? "bg-accent" : ""}`}
                    style={{ fontSize: "12px" }}
                  >
                    <bt.icon size={14} className="text-muted-foreground" />
                    {bt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Format buttons */}
          <ToolbarButton icon={Bold} label="Bold" active={activeFormat === "bold"} onClick={() => setActiveFormat(activeFormat === "bold" ? null : "bold")} />
          <ToolbarButton icon={Italic} label="Italic" active={activeFormat === "italic"} onClick={() => setActiveFormat(activeFormat === "italic" ? null : "italic")} />
          <ToolbarButton icon={Underline} label="Underline" active={activeFormat === "underline"} onClick={() => setActiveFormat(activeFormat === "underline" ? null : "underline")} />
          <ToolbarButton icon={Highlighter} label="Highlight" active={activeFormat === "highlight"} onClick={() => setActiveFormat(activeFormat === "highlight" ? null : "highlight")} />

          <div className="w-px h-5 bg-border mx-1" />

          <ToolbarButton icon={Link} label="Link" onClick={() => {}} />
          <ToolbarButton icon={Table} label="Table" onClick={() => {}} />
          <ToolbarButton icon={Image} label="Image" onClick={() => {}} />
          <ToolbarButton icon={Paperclip} label="Attachment" onClick={() => {}} />
          <ToolbarButton icon={AtSign} label="Note link" onClick={() => {}} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Stats pill */}
          <div
            className="flex items-center gap-3 px-3 py-1 rounded-full bg-accent/60 text-muted-foreground"
            style={{ fontSize: "11px" }}
          >
            <span>{note.wordCount} words</span>
            <span>{Math.ceil(note.wordCount / 200)} min read</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon size={15} />
    </button>
  );
}

function RichContent({ content }: { content: string }) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Parse content into blocks
  const lines = content.split("\n");
  const blocks: Array<{
    type: string;
    level?: number;
    text: string;
    id: string;
    items?: Array<{ text: string; checked?: boolean }>;
    rows?: string[][];
  }> = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push({ type: "heading", level, text: headingMatch[2], id: `block-${i}` });
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1]?.match(/^\|[\s-|]+\|$/)) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i].split("|").filter(Boolean).map((c) => c.trim());
        if (!lines[i].match(/^[\s|-]+$/)) {
          tableRows.push(row);
        }
        i++;
      }
      blocks.push({ type: "table", text: "", id: `block-${i}`, rows: tableRows });
      continue;
    }

    // Task list
    if (line.match(/^- \[[ x]\]/)) {
      const items: Array<{ text: string; checked: boolean }> = [];
      while (i < lines.length && lines[i].match(/^- \[[ x]\]/)) {
        const checked = lines[i].includes("[x]");
        const text = lines[i].replace(/^- \[[ x]\]\s*/, "");
        items.push({ text, checked });
        i++;
      }
      blocks.push({ type: "tasklist", text: "", id: `block-${blocks.length}`, items });
      continue;
    }

    // Bullet list
    if (line.match(/^- /)) {
      const items: Array<{ text: string }> = [];
      while (i < lines.length && lines[i].match(/^- /)) {
        items.push({ text: lines[i].replace(/^- /, "") });
        i++;
      }
      blocks.push({ type: "bulletlist", text: "", id: `block-${blocks.length}`, items });
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      const items: Array<{ text: string }> = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push({ text: lines[i].replace(/^\d+\.\s/, "") });
        i++;
      }
      blocks.push({ type: "orderedlist", text: "", id: `block-${blocks.length}`, items });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      blocks.push({ type: "blockquote", text: line.replace(/^> /, ""), id: `block-${i}` });
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    blocks.push({ type: "paragraph", text: line, id: `block-${i}` });
    i++;
  }

  const renderInline = (text: string) => {
    // Handle bold, italic, wiki links, inline code
    let result = text;
    // Simple render - return the text with inline formatting hints
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|\[\[(.+?)\]\]|`(.+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(result)) !== null) {
      if (match.index > lastIndex) {
        parts.push(result.slice(lastIndex, match.index));
      }
      if (match[2]) {
        // Bold
        parts.push(
          <strong key={match.index} style={{ fontWeight: 600 }}>
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        // Wiki link
        parts.push(
          <span
            key={match.index}
            className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40"
            style={{ fontSize: "0.9em" }}
          >
            <FileText size={11} />
            {match[3]}
          </span>
        );
      } else if (match[4]) {
        // Inline code
        parts.push(
          <code
            key={match.index}
            className="px-1 py-0.5 rounded bg-accent text-foreground"
            style={{ fontSize: "0.85em", fontFamily: "'SF Mono', 'Consolas', monospace" }}
          >
            {match[4]}
          </code>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < result.length) {
      parts.push(result.slice(lastIndex));
    }
    return parts.length > 0 ? parts : result;
  };

  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        if (block.type === "heading") {
          const isCollapsed = collapsedSections.has(block.id);
          const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
          const sizes = { 1: "1.6em", 2: "1.3em", 3: "1.1em" };
          return (
            <div key={block.id} className="group flex items-start gap-1">
              <button
                onClick={() => toggleCollapse(block.id)}
                className="mt-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground rounded"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              <Tag
                style={{
                  fontSize: sizes[block.level as 1 | 2 | 3],
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.4,
                  marginTop: block.level === 1 ? "0.8em" : "0.5em",
                }}
              >
                {renderInline(block.text)}
              </Tag>
            </div>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={block.id} className="text-foreground/90" style={{ lineHeight: "inherit" }}>
              {renderInline(block.text)}
            </p>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={block.id}
              className="border-l-3 border-muted-foreground/30 pl-4 text-muted-foreground italic"
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }

        if (block.type === "bulletlist" && block.items) {
          return (
            <ul key={block.id} className="space-y-1 pl-5">
              {block.items.map((item, idx) => (
                <li key={idx} className="list-disc text-foreground/90 marker:text-muted-foreground/50">
                  {renderInline(item.text)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "orderedlist" && block.items) {
          return (
            <ol key={block.id} className="space-y-1 pl-5">
              {block.items.map((item, idx) => (
                <li key={idx} className="list-decimal text-foreground/90 marker:text-muted-foreground/50">
                  {renderInline(item.text)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "tasklist" && block.items) {
          return (
            <div key={block.id} className="space-y-1.5">
              {block.items.map((item, idx) => (
                <label key={idx} className="flex items-start gap-2 cursor-pointer" style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    defaultChecked={item.checked}
                    className="mt-1 rounded border-muted-foreground/30 text-foreground accent-foreground"
                  />
                  <span className={item.checked ? "line-through text-muted-foreground" : "text-foreground/90"}>
                    {renderInline(item.text)}
                  </span>
                </label>
              ))}
            </div>
          );
        }

        if (block.type === "table" && block.rows) {
          return (
            <div key={block.id} className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-accent/50">
                    {block.rows[0]?.map((cell, ci) => (
                      <th
                        key={ci}
                        className="px-3 py-2 text-left border-b border-border text-foreground"
                        style={{ fontSize: "0.9em", fontWeight: 600 }}
                      >
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.slice(1).map((row, ri) => (
                    <tr key={ri} className="border-b border-border last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-foreground/80" style={{ fontSize: "0.9em" }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
