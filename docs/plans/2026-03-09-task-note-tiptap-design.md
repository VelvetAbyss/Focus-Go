# Task Note Tiptap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace block-based Task Note editing with a single Tiptap editor that supports inline atomic Note references and migrates legacy `taskNoteBlocks`.

**Architecture:** Keep `taskNoteContentJson` plus `taskNoteContentMd` as the canonical task-note storage, treat `taskNoteBlocks` as legacy input only, and migrate old block data into a Tiptap doc during task reads. Reuse the existing Notes Tiptap extension stack, add a custom inline `noteReference` node with suggestion support, and move Task Note saving to a debounced autosave path in `TaskDrawer`.

**Tech Stack:** React 19, Tiptap 3, Vitest, Dexie, TypeScript

---

### Task 1: Data Model And Migration

**Files:**
- Modify: `packages/core/src/models.ts`
- Modify: `apps/web/src/data/models/types.ts`
- Modify: `packages/db-contracts/src/schemas.ts`
- Modify: `apps/web/src/data/services/DexieDatabaseService.ts`
- Modify: `apps/web/src/data/db/index.ts`
- Modify: `apps/web/src/data/repositories/tasksRepo.ts`
- Modify: `packages/core/src/database/IDatabaseService.ts`
- Test: `packages/core/tests/idatabase-service.test.ts`
- Test: `packages/db-contracts/tests/schemas.test.ts`

**Step 1:** Write failing tests for legacy `taskNoteBlocks` migration and new rich text field persistence.

**Step 2:** Run the targeted tests and confirm the failures are due to missing migration behavior.

**Step 3:** Implement the minimal data-layer changes to read/write `taskNoteContentJson` and `taskNoteContentMd` as the primary format and clear legacy blocks on save.

**Step 4:** Re-run the targeted data tests until they pass.

### Task 2: Task Note Rich Text Editor

**Files:**
- Create: `apps/web/src/features/tasks/model/taskNoteRichText.ts`
- Create: `apps/web/src/features/tasks/model/taskNoteRichText.test.ts`
- Create: `apps/web/src/features/tasks/components/task-note-rich-text.css`
- Modify: `apps/web/src/features/notes/model/richTextExtensions.ts`
- Modify: `apps/web/src/features/tasks/components/TaskNoteEditor.tsx`
- Test: `apps/web/src/features/tasks/components/TaskNoteEditor.test.tsx`

**Step 1:** Write failing tests for inline reference insertion, deletion, empty-state create flow, and markdown serialization.

**Step 2:** Run the targeted editor tests and confirm they fail for the expected reasons.

**Step 3:** Implement the custom inline `noteReference` Tiptap node, suggestion flow, and Task Note editor UI on top of the existing Notes editor foundation.

**Step 4:** Re-run the targeted editor tests until they pass.

### Task 3: TaskDrawer Autosave And Regression Coverage

**Files:**
- Modify: `apps/web/src/features/tasks/TaskDrawer.tsx`
- Modify: `apps/web/src/features/tasks/TaskDrawer.test.tsx`
- Modify: `apps/web/src/features/tasks/TasksBoard.test.tsx`
- Modify: `apps/web/src/features/calendar/pages/CalendarPage.test.tsx`

**Step 1:** Write failing tests for debounced Task Note autosave and drawer-close save flush behavior.

**Step 2:** Run the targeted TaskDrawer tests and confirm they fail correctly.

**Step 3:** Implement Task Note autosave integration without folding it into the existing dirty-confirmation path.

**Step 4:** Run targeted regression tests for tasks and calendar until they pass.
