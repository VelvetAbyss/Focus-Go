# Focus & Go ⇄ Obsidian

Two-way sync between your Focus & Go tasks and an Obsidian vault. Create a task in
the app and a note appears in your vault; tick a checkbox in Obsidian and the app
follows.

The plugin is a replication client of the same `/sync/rxdb/pull|push` API the web
and desktop apps use — it is not a separate export. Your vault, the web app and
the desktop app are three peers over one dataset.

```
  Web app       ─┐
  Desktop       ─┼─→  /sync/rxdb/{pull,push}  ←→  sync_tasks
  This plugin   ─┘
       ↕
  <vault>/Focus & Go/Tasks/*.md
```

## Setup

1. In Focus & Go, go to **Settings → Data → Obsidian & integrations** and generate
   an access token. It is shown once — copy it then.
2. In Obsidian, open this plugin's settings and paste the token and the server URL
   shown next to it.
3. Tasks appear in `Focus & Go/Tasks` within about 15 seconds.

## The note format

```markdown
---
focusgo-id: 0f8a…          # identity — do not edit
status: doing              # todo | doing | done
priority: high             # high | medium | low, or empty for none
due: 2026-09-10
start: 2026-09-04
tags: [work, deep]
pinned: false
today: true
project: prj_abc           # shown for reference; edits are not sent back
updated: 2026-09-04T10:22:31Z
---

The description — everything before the first section heading.

## Subtasks
- [x] Design the schema
- [ ] Write the push path

## Notes
The task note body. Any markdown, including further headings.
```

**The file name is the task title.** Renaming the note renames the task, and
renaming the task in the app renames the note. Titles containing characters a
file name cannot hold (`/`, `:`, `#`, …) keep their real value in a
`focusgo-title` property.

### What round-trips, and what does not

Editable from Obsidian: title, description, status, priority, due/start/end
dates, tags, pinned, today, subtasks, and the note body.

Not represented in the file: attachments, activity log, progress history, task
dependencies, collaborators and reminders. **These are preserved, not dropped** —
a push patches the mapped fields onto the task the server already has rather than
rebuilding it from the markdown. You cannot edit them from the vault; editing the
note never destroys them.

One caveat worth knowing: editing `## Notes` replaces the task note's rich-text
representation with your markdown. Formatting the app's editor supports but
markdown does not will be flattened by such an edit.

## Deleting

**Deleting a note deletes the task**, and deleting a task removes the note.

Two safety valves, both configurable:

- Deleting a note shows a notice with an **Undo** link and waits (10s by default)
  before sending the delete.
- Deleting **more than 5 notes at once** asks for confirmation instead of
  deleting anything. A burst of deletions is more often an iCloud/Dropbox
  conflict or a mis-dragged folder than an intention.

Moving a note **out of** the sync folder is not a delete — it stops syncing that
note and leaves the task alone.

## Conflicts

Edits are merged field by field against the last state the plugin pulled. If you
changed a field only in the vault, your change is kept. If both sides changed the
*same* field, the app wins and a notice tells you which fields were overridden —
the app is the primary surface, and reverting deliberate work done there is worse
than losing a stray vault edit.

A note with unpushed edits is never overwritten by an incoming pull.

## Commands

- **Sync now** — force a cycle and report what moved.
- **Re-sync from scratch** — forget local sync state and rebuild every note.

## Development

```bash
npm install
npm run dev        # esbuild watch -> main.js
npm run build      # production bundle
npm test           # unit + integration tests
npm run typecheck
```

To try it in a real vault, symlink this folder into
`<vault>/.obsidian/plugins/focus-and-go/` (it needs `manifest.json` and the built
`main.js`).

### Tests

`src/__tests__/protocol.parity.test.ts` imports the API's own
`sync/protocol.js` and asserts this plugin produces byte-identical wire
payloads and blob hashes. This matters more than it looks: the server compares a
pushed `assumedMasterState` against its stored payload with a stable stringify,
so a divergence would not raise an error — every update would quietly dead-end in
the conflict path.

`src/__tests__/replicator.test.ts` runs the full sync loop against the API's real
`sync/store.js` on in-memory SQLite, so the optimistic concurrency and tombstone
rules under test are the shipping ones.
