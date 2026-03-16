Redesign a desktop-first note-taking workspace for a productivity app called Focus&Go.

This is a rich note system, not a simple text editor. The current page has three major regions and must preserve all existing functionality while rebuilding the UI with stronger visual quality, cleaner hierarchy, better spacing, and more intentional interaction design.

Product direction:
Create a calm, premium, editorial note workspace that feels like a hybrid of Bear, Craft, and Apple Notes, but still distinct. The tone is focused, structured, and knowledge-oriented. Avoid generic dashboard styling. Prioritize reading comfort, writing flow, and fast scanning of notes and tags.

Layout:
Use a 3-column desktop layout.

Column 1: Navigation sidebar
- Fixed-width left sidebar.
- Contains system collections and tag navigation.
- System collections:
  - Notes
  - Today
  - Untagged
  - Trash
- Each collection shows a count badge.
- Below system collections, show a “Pinned tags” section when pinned tags exist.
- Below that, show a hierarchical tag tree.
- Each tag can have:
  - optional icon
  - pin/unpin action
  - rename action
  - delete action
  - edit icon action
- Tag rows can show nested structure with indentation.
- Current selected collection or tag should have a clear active state.
- Trash is an entry point that opens a modal, not an inline section.

Column 2: Note browser
- Medium-width center column.
- Top browser bar contains:
  - current collection chip
  - new note button
  - focus search button
- Below that, a filter row:
  - sort select: Edited / Created / Title
  - search input with placeholder like “Search notes, @todo, #tag”
- Main content is a scrollable note list.
- Each note card shows:
  - title
  - updated time
  - short preview text
  - up to 2 tags, overflow shown as +N
  - pinned state
- Hover actions on note card:
  - pin/unpin
  - move to trash
- Selected note card needs a clear but elegant active state.
- New note creation should visually support contextual creation:
  - under a tag
  - under Today
- The list must feel lightweight and fast to scan.

Column 3: Editor canvas
- Main writing surface for the selected note.
- Large title input at top.
- Below it, rich-text writing canvas.
- Writing canvas should feel spacious, premium, and optimized for long-form writing.
- Keep fixed container height with internal scrolling.
- Toolbar must stay fixed at the bottom of the editor container.
- The toolbar should feel like part of the writing surface, not a generic app footer.

Editor top actions:
Place compact chrome actions in the top-right area:
- Info
- Appearance
- Export

Editor features that must be represented in the UI:
- Rich text editor
- Paragraph / H1 / H2 / H3
- Bullet list
- Ordered list
- Task list with checkbox aligned inline with text
- Bold
- Italic
- Underline
- Highlight
- Link insertion
- Table insertion and table editing
- Image insertion
- File attachment insertion
- Internal note references using [[wiki link]] style suggestions
- Collapsible headings
- Bottom stats/status pill

Rich text behavior to preserve:
- Images can be pasted directly from clipboard.
- Images can be uploaded locally or inserted by URL.
- Images can be resized using a drag handle.
- Tables support row/column insertion and deletion, and delete-table action.
- Internal note references should render as inline chips.
- File attachments should render as inline attachment chips.
- Heading blocks support collapse/expand controls.
- Long content scrolls inside the editor body while the outer editor frame stays fixed.

Inspector behavior:
The Info action opens a compact inspector popover with 3 tabs:
- Statistics
- Table of Contents
- Backlinks

Statistics tab should visually support:
- words
- characters
- paragraphs
- read time
- modified time
- created time
- characters without spaces
- image count
- file count

TOC tab:
- shows heading hierarchy
- supports jump to heading
- supports collapse/expand from the TOC

Backlinks tab:
- lists notes that link to the current note
- clicking a backlink opens that note

Appearance dialog:
Need a polished settings modal for:
- theme: Paper / Graphite
- font: UI Sans / Serif / Mono
- font size slider
- line height slider
- content width slider
- focus mode toggle

Export dialog:
Need a compact export modal with:
- Markdown
- HTML
- PDF

Trash dialog:
Trash should open as a centered modal.
- title: Recently deleted
- subtitle: items auto-remove after 7 days
- list deleted notes in reverse chronological order
- each row supports Restore and Delete now
- Delete now has a second confirmation state

Visual language:
- premium, calm, editorial
- warm neutrals for light theme
- graphite, ink, and muted blue-gray for dark theme
- avoid generic purple SaaS aesthetics
- use stronger typography hierarchy
- make writing surface feel like a real document workspace
- navigation and note browser should feel tactile but understated
- support subtle shadows, layered surfaces, and refined separators
- no clutter, no loud gradients, no oversized cards
- use shadcn-style component logic and proportions

Interaction goals:
- everything should feel fast and focused
- support scanning, sorting, tagging, and writing equally well
- emphasize note structure and knowledge workflows, not just plain text editing
- the UI should clearly communicate that this app supports tags, backlinks, structured headings, assets, and note relationships

Responsive behavior:
- Desktop is the priority.
- On smaller widths, preserve functionality while stacking or collapsing intelligently.
- Toolbar should remain usable on narrow screens with horizontal scrolling if needed.
- Focus mode should hide supporting columns and leave only the writing surface.

Deliverable:
Create a full-page application UI design for this Notes workspace, including:
- the 3-column main screen
- trash modal
- appearance modal
- export modal
- info inspector popover
- realistic note cards, tags, heading structure, attachments, backlinks, and writing content
- both Paper and Graphite theme directions if possible