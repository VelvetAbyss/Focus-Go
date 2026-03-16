# Focus&go Change Hotspots

Use this file when the request spans multiple domains or the first domain candidates are not enough.

## App Routes And Shell

- Files:
  - `apps/web/src/app/routes/routes.ts`
  - `apps/web/src/app/routes/AppRoutes.tsx`
  - `apps/web/src/app/layout/AppShell.tsx`
  - `apps/web/src/app/layout/Sidebar.tsx`
- Use when:
  - adding or renaming a page
  - changing redirects or guarded access
  - changing sidebar order or nav visibility
  - fixing route-layer background, full-bleed, or shell framing issues
- Typical bridge domains:
  - notes, labs, rss, dashboard

## Dashboard Widget Registration

- Files:
  - `apps/web/src/features/dashboard/registry.tsx`
  - `apps/web/src/features/dashboard/DashboardPage.tsx`
  - `apps/web/src/data/repositories/dashboardRepo.ts`
- Use when:
  - adding a dashboard card
  - changing widget defaults or visibility
  - changing layout persistence or widget theme overrides
- Typical bridge domains:
  - tasks, focus, spend, weather, diary

## Shared Preferences, Theme, I18n

- Files:
  - `apps/web/src/shared/prefs/preferences.ts`
  - `apps/web/src/shared/prefs/PreferencesContext.ts`
  - `apps/web/src/shared/theme/theme.ts`
  - `apps/web/src/shared/theme/themePack.ts`
  - `apps/web/src/shared/theme/tokens.css`
  - `apps/web/src/shared/i18n/messages/en.ts`
  - `apps/web/src/shared/i18n/messages/zh.ts`
- Use when:
  - a feature stores user-configurable settings
  - labels, copy, locale rules, or theme tokens change
  - the request says “global”, “workspace”, “language”, or “appearance”
- Typical bridge domains:
  - weather, notes, settings, focus

## Repositories And Contracts Alignment

- Files:
  - `apps/web/src/data/repositories/tasksRepo.ts`
  - `apps/web/src/data/repositories/diaryRepo.ts`
  - `apps/web/src/data/repositories/focusRepo.ts`
  - `apps/web/src/data/repositories/spendRepo.ts`
  - `apps/web/src/data/repositories/notesRepo.ts`
  - `apps/web/src/data/db/index.ts`
  - `packages/core/src/models.ts`
  - `packages/db-contracts/src/schemas.ts`
  - `packages/db-contracts/src/channels.ts`
- Use when:
  - a request changes stored shape or shared model meaning
  - a UI bug is actually caused by persistence or validation
  - repo output and contract shape might drift
- Typical bridge domains:
  - tasks, diary, focus, spend, notes

## Labs Gating And Feature Access

- Files:
  - `apps/web/src/features/labs/LabsContext.tsx`
  - `apps/web/src/features/labs/labsApi.ts`
  - `apps/web/src/features/labs/accessRules.ts`
  - `apps/web/src/app/routes/AppRoutes.tsx`
  - `apps/web/src/app/layout/Sidebar.tsx`
- Use when:
  - premium-only access changes
  - install/remove/restore behavior changes
  - a feature should appear or disappear based on tier or install state
- Typical bridge domains:
  - rss, habits, dashboard

## Shared Date And Time Controls

- Files:
  - `apps/web/src/shared/ui/DatePicker.tsx`
  - `apps/web/src/shared/ui/DateRangePicker.tsx`
  - `apps/web/src/shared/ui/DateTimePicker.tsx`
  - `apps/web/src/shared/ui/datePicker/dateKey.ts`
  - `apps/web/src/features/calendar/pages/CalendarPage.tsx`
- Use when:
  - a request mentions due date, time selection, range picking, or date formatting
  - calendar and task editing behaviors disagree
- Typical bridge domains:
  - calendar, tasks

## Common Bridge Patterns

- Tasks -> Focus:
  - task start, autostart, active task handoff
- Tasks -> Calendar:
  - due date editing, calendar creation, deletion from schedule
- Diary -> Dashboard:
  - launcher card status, review snapshot preview
- Labs -> RSS:
  - install flow, guarded route, sidebar entry
- Notes -> AppShell:
  - route bleed, full-page layout, sidebar framing

## Manual Update Triggers

Update this file after large changes when:

- a new bridge becomes common
- a page or route stops being the real first entry
- a repo/contract pair is renamed or moved
- a shared layer becomes the new default hotspot for a request category
