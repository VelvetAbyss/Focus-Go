# TODOs

## Evaluate Tiptap official Markdown conversion

What: Evaluate migrating Note Markdown conversion from the current `richTextCodec` chain to Tiptap official `@tiptap/markdown`.

Why: Note import V1 reuses the existing Markdown pipeline to keep the feature small. Official Tiptap Markdown support may reduce conversion drift later, especially now import/export/editing all depend on Markdown fidelity.

Context: Start from `apps/web/src/features/notes/model/richTextCodec.ts` after Note import V1 has shipped and its parser tests are stable. Compare output for headings, task lists, tables, links, images, code blocks, and highlights before changing the editor pipeline.

Depends on: Note import V1 parser and component tests.

## Explore a full notes migration center

What: Explore a future migration center for folders, Notion/Obsidian exports, PDF, legacy `.doc`, import history, and undo batch.

Why: If file import becomes a real growth lever, users will want source-specific migration rather than a simple file queue.

Context: V1 intentionally supports only `.md`, `.markdown`, `.txt`, and `.docx` as new notes with an `Imported` tag. Do not build a larger migration surface until real users show import demand or bring source-specific files that V1 cannot handle.

Depends on: Evidence from real users importing study material.
