# Dashboard task project filter — local fix

Date: 2026-10-15 (Asia/Shanghai). Scope: dashboard task project filtering. Not deployed.

## Problem and behavior

TasksBoard restored tasks_project_filter_v1 in both the full page and dashboard, but hid the project filter UI when asCard=true. Dashboard users could inherit a filter without an exit.

The dashboard card now has a lightweight project selector beside the status toolbar, with an always-available All option. The initial isolated header dropdown was removed after user visual feedback. It lists active projects even when the current status has zero matching tasks. Existing cross-page filter persistence is preserved. Invalid saved filters clear after data loads, including when there are no active projects. The full board retains a selected project chip even at zero count.

Changed source: apps/web/src/features/tasks/TasksBoard.tsx and TasksBoard.test.tsx. Other existing work was preserved.

## Verification

- Four new regression cases failed before the fix; all 24 TasksBoard tests pass after it.
- Covered full board project selection, dashboard restoration, returning to All including unassigned tasks, switching projects, remount persistence, empty projects, archived/deleted saved projects.
- TypeScript build check: passed.
- ESLint for both edited files: passed.
- git diff --check: passed.
- Full suite initial run: 147 files passed / 4 failed; 733 tests passed / 6 failed / 4 skipped. Five failures were timeouts; the NewsDashboard source loader assertion also failed under this run.
- All four failing files rerun with --maxWorkers=1: 4 files passed; 66 tests passed / 1 skipped. No unrelated source was changed to resolve those results.
- Real local dashboard verified with sample data at 1440px and 390px. Switching projects and restoring All, including unassigned tasks, passed in the browser. Cross-page restoration is covered by component regression tests. See the visual correction section and screenshots below.

## Commands

```sh
npm exec -- vitest run src/features/tasks/TasksBoard.test.tsx
npm exec -- tsc -b --pretty false
npm exec -- eslint src/features/tasks/TasksBoard.tsx src/features/tasks/TasksBoard.test.tsx
npm exec -- vitest run
npm exec -- vitest run src/app/routes/SettingsRoute.theme-pack.test.tsx src/features/news/NewsDashboard.test.tsx src/features/calendar/pages/CalendarPage.test.tsx src/features/notes/pages/NotePage.test.tsx --maxWorkers=1
```

## Visual correction after user feedback

Moved the selector beside status filters; replaced the boxed field with a project color dot, name and chevron. Kept a native accessible select over the visible label. Counts sit alongside the selector; status tabs can wrap on narrow cards.

Verified actual local UI with sample tasks at 1440px and 390px. Browser checks passed for selecting another project and restoring All, including unassigned tasks. Final TasksBoard 24 tests and focused ESLint pass. Screenshots: polished-desktop.png, polished-mobile.png, polished-toolbar.png. Existing narrow-screen composer overflow is outside this correction.
