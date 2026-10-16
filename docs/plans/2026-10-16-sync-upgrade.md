# Sync reliability, realtime and CRDT implementation plan

**Goal:** Durable local changes across modules, prompt authenticated cross-device refresh, and mergeable note bodies.
**Architecture:** Keep Dexie/RxDB and the existing HTTP/SQLite backend. Capture local entity mutations with an atomic Dexie middleware outbox; exclude remote/reset writes explicitly. Wake short coalesced sync cycles after commits, notify clients with authenticated fetch-based SSE and retain checkpoint pull as authority/fallback. Bind note body to Yjs through the maintained TipTap collaboration extension, merge CRDT state on replication conflicts, retain metadata conflict recovery.
**Tech Stack:** Dexie DBCore, RxDB, Express/SQLite, Yjs, TipTap 3.

User authorized all three phases in order on 2026-10-16. No commit/push/deploy authorization in this request. Preserve existing dirty edits; baseline at work/sync-upgrade-2026-10-16/before and before.patch.

## 1. Reliable persistence
- Add failure-first tests for notes and other entities: abort rolls back entity and outbox; deletes survive close/reopen; remote writes do not echo; late pulls do not overwrite local edits.
- Implement shared capture at database mutation boundary, covering direct repositories, bulk mutations, and delete ranges in the original IndexedDB transaction.
- Make old enqueue calls wake-only after capture; include owner/account on durable changes. Serialize RxDB operations across browser tabs where Web Locks are available.
- Preserve existing queue replay contracts and compare remote applies to local cycle baseline, atomically with pending checks.
- Run targeted persistence/replication tests before phase 2.

## 2. Realtime
- Add coalescing local-write event scheduler, retain writes during active cycles and avoid bypassing error backoff.
- Add authenticated SSE invalidation endpoint; broadcast only after successful DB transaction, scope by account, heartbeat and bounded client lifetime. Events carry hints only; reconnect forces checkpoint catchup, periodic pull remains fallback.
- Parse stream with bearer headers using fetch/AbortController, cancel on logout/disable, test cross-account filtering and reconnect/cleanup.

## 3. CRDT
- Reuse Yjs + matching TipTap collaboration version; do not implement a new CRDT.
- Deterministically seed legacy notes, persist state with the note, bind local editor transactions, apply remote Yjs updates without replacing focused editor content, disable duplicate undo history.
- Merge CRDT state in client conflict resolver, project JSON/Markdown body from merged state, retain conflict copies for unsupported legacy or metadata conflicts.
- Test concurrent edits, replay/idempotence, legacy initialization and metadata/delete behavior; run note editor workflows, full lint/typecheck/build and relevant API suites.

## Sources checked before implementation
- https://github.com/pubkey/rxdb/blob/master/docs-src/docs/replication.md
- https://github.com/yjs/yjs
- https://github.com/yjs/docs/blob/main/ecosystem/editor-bindings/prosemirror.md
- https://github.com/ueberdosis/y-tiptap

Implementation and validation progress will be recorded in artifacts/sync-upgrade-2026-10-16/README.md. No production durability or latency claims without deployment/device evidence.

## Delivery status

All three implementation phases are complete locally. Web regression: 784 passed / 4 skipped; final sync-specific regression: 80 passed; API: 28 passed; contracts: 4 passed; browser sync: 3 flows; editor regression: 13 flows. Lint, TypeScript and production build passed. Explicit Yjs history boundaries and guarded action-selection restoration were added after real editor regression found the differences. Final evidence and scope limits are in the delivery report. No commit, push or deployment was performed.

## Release authorization and integration

On 2026-10-16 the user explicitly requested “提交上线吧”, authorizing commit, push, merge and production deployment. The task-only diff was integrated into an isolated worktree based on current origin/main 1e14e61, retaining the mainline calendar day notes and task trash. Legacy enqueue calls remain compatible with capture; durable entries are coalesced at handoff rather than removing those existing call sites.

Pre-landing review reproduced a late push-conflict response resurrecting a deleted note and fixed it with an absent-current guard. CRDT inclusion acknowledgement also now requires matching non-body metadata so unsent tags, collection, pinning and title cannot be settled by body inclusion alone. The conflict resolver checks the account/reset boundary. Fresh integration verification and final production status are recorded in artifacts/sync-release-2026-10-16/README.md.
