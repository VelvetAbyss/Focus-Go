# AI Screenshot Tool Integration Plan (Locked)

Date: 2026-02-19  
Workspace: `/Users/apple/Projects/Focus&go`

## 1) Locked Decisions

The following decisions are confirmed and must not change unless explicitly re-approved:

1. Architecture: create a standalone Tauri app at `apps/ai-screenshot-tool`.
2. Scope: deliver through Wave 4 in the first release.
3. Hotkey: use a new dedicated shortcut (`Cmd/Ctrl+Shift+X`).
4. Ecosystem integration: Auth + Storage + Theme are real integrations in v1.
5. Interaction form: full screenshot workflow runs in overlay.
6. Output: clipboard + local save + cloud upload + pin-to-screen.
7. Plugin strategy: no plugin system in v1.
8. Data logic: local persistence with trash and restore flow.

## 2) Integration Target in Focus&Go Monorepo

### New App
- `apps/ai-screenshot-tool` (Tauri v2 + React + Rust)

### Shared Integration Boundary
- Reuse and extend shared contracts in:
  - `packages/core`
  - `packages/db-contracts`
- Keep integration through adapters, not direct coupling to existing Electron internals.

### Existing Apps Remain Stable
- `apps/web` and `apps/desktop` must continue to build and run unchanged during integration.

## 3) Repository-Level Changes

1. Add the new app workspace with isolated build toolchain:
   - frontend: Vite + React + TypeScript
   - native: Tauri v2 + Rust
2. Add root scripts for operational consistency:
   - `dev:screenshot`
   - `build:screenshot`
   - `test:screenshot`
3. Add environment template for screenshot app:
   - `apps/ai-screenshot-tool/.env.example`
4. Add CI matrix entries for screenshot app (macOS + Windows builds).

## 4) Domain and Data Model (with Trash/Restore)

Add screenshot domain contracts in `packages/core` and schema contracts in `packages/db-contracts`:

- `CaptureRecord`
- `AnnotationDocument`
- `AiConversation`
- `OutputArtifact`
- `TrashRecord`

Required states:

- `active`
- `deleted` (soft-delete)
- `restored`
- `purged` (hard delete)

Required operations:

1. soft delete
2. restore
3. list trash
4. purge
5. retention cleanup task (configurable days)

## 5) Wave Execution Plan (Adjusted)

## Wave 1: Foundation + Native Capture

1. scaffold Tauri app in `apps/ai-screenshot-tool`
2. implement Rust capture commands (monitor/window)
3. implement smart window detection
4. implement fast Rust->WebView image transfer
5. implement real Auth/Storage/Theme adapters (contract-first)

Gate:
- app builds on macOS
- mocked unit tests pass for capture and window detection

## Wave 2: Overlay + Annotation

1. transparent fullscreen overlay window manager
2. selection/crop with smart snap
3. annotation tools (shape, arrow, text, mosaic)
4. floating toolbar + complete/cancel + undo/redo

Gate:
- overlay interaction works on single and multi-monitor setups
- annotation flows pass Playwright scenarios

## Wave 3: AI + OCR + Shortcut

1. streaming AI client with retry/error handling
2. AI chat panel in overlay
3. OCR extraction + copy text
4. dedicated global shortcut registration and conflict handling

Gate:
- stream reconstruction test passes
- hotkey triggers capture entry reliably

## Wave 4: Output + Settings + Onboarding + Performance + CI

1. output pipeline: local file, clipboard, cloud upload, pin-to-screen
2. settings UI (hotkey/theme/save-path/AI prompt policy)
3. first-run permission flow and onboarding
4. performance optimization and leak checks
5. cross-platform build pipeline in GitHub Actions

Gate:
- complete output chain validated
- memory trend stable after repeated capture cycles

## 6) API Contracts Required Before Coding

The screenshot app depends on three real integration contracts:

1. Auth contract
   - get access token
   - refresh token
   - current user context
2. Storage contract
   - upload image/blob
   - return canonical URL + metadata
3. Theme contract
   - fetch theme tokens
   - react to theme updates

If any of the above is unavailable, implementation must stop at adapter boundary with explicit error states, not hidden fallback behavior.

## 7) Testing and Verification Baseline

Mandatory commands per phase:

```bash
# workspace-level safety checks
npm run lint:web
npm run build:web
npm run build:desktop

# screenshot app checks (after workspace is created)
npm run test:screenshot
npm run build:screenshot
```

Required test layers:

1. Rust unit tests (`cargo test`)
2. Frontend unit/integration tests (Vitest)
3. Overlay and interaction scenarios (Playwright)
4. End-to-end scenario for capture -> annotate -> AI -> output

## 8) Non-Goals (Locked)

Do not implement in v1:

1. plugin loader and plugin sandbox
2. video recording
3. Linux support
4. local/offline LLM runtime

## 9) Immediate Execution Order

Start from this order:

1. create app skeleton at `apps/ai-screenshot-tool`
2. define Auth/Storage/Theme TypeScript contracts and Rust command boundaries
3. complete capture + overlay MVP flow
4. wire AI/OCR and full output chain
5. add trash/restore persistence and settings/onboarding
6. finish CI + cross-platform packaging

