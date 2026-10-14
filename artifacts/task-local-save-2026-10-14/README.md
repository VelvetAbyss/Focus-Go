# Task local-save latency fix — 2026-10-14

## User requirement

Task actions should respond and save locally immediately; cloud uploads run silently in the background.

## Confirmed cause

`DexieDatabaseService.tasks.update/remove/updateStatus/clearAllTags` awaited `enqueueSyncOperation`, which awaited `enqueueRxdbSyncChange`. Both local RxDB enqueues and complete cloud cycles used the same `runQueued` chain. An in-flight network cycle therefore delayed task method completion and UI feedback/reenabling. `TaskDrawer` additionally delayed draft writes by 180 ms.

## Implementation

- Schema 47 (preserving the existing schema 46 task recycle bin) adds a durable IndexedDB `pending_sync_changes` handoff log.
- `enqueueSyncOperation` acknowledges local persistence and schedules RxDB handoff in the background. This shared correction also removes cloud-queue waits from task-linked note saves.
- Task records and pending sync entries commit in one local transaction, including deletion tombstones. Domain-event projections no longer hold task completion open.
- Each cloud cycle drains durable pending changes before replication. Failed handoffs retain entries; exact operation IDs prevent acknowledgement of a newer edit. Reset/restore removes obsolete pending entries.
- In-flight remote task applies check for pending local changes in a transaction shared with local task writes, preventing stale cloud responses from undoing edits or resurrecting deleted tasks.
- TaskDrawer starts local writes immediately, serializes subsequent drafts, and flushes the latest draft on unmount.

## Validation

Regression test first reproduced stalled-sync blocking. Fixed version passed stalled queue, immediate draft/queued latest edit, durable delete after reopen, retry, concurrent newer edit, transaction rollback, and real RxDB in-flight stale pull/edit/delete/push tests. Existing task board, repository, service, sync, conflict, and offline tests are run with the fix. Release baseline run: 12 test files / 91 tests passed, including preservation of the v46 task recycle bin and queued direct metadata edits; `npm run lint:web` and `npm run build:web` passed. Build emitted the existing large-chunk advisory.

## Scope and limits

Release prepared from origin/main 1cf311f in an isolated checkout; full production pipeline verification pending. The web hotfix retains the existing beta product version; no desktop release/tag is created. No protected auth or desktop source changes. Existing unrelated dashboard/Three.js/i18n changes were preserved. Tests use local IndexedDB/RxDB and mocked HTTP; authenticated production browser latency has not been measured. Local persistence still depends on the browser successfully committing IndexedDB; cloud completion depends on connectivity and background sync.
