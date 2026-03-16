# Focus&go Feature Map

Use this file after routing the request. Read only the matched section.

## Format

Each domain uses the same fields:

- Route/Page: user-visible entry
- UI Entry: first UI file to inspect
- State/Repo: state source, runtime, or repository
- Contracts/Data: shared types, schemas, or persistence files
- Common Bridges: nearby modules often touched together
- Top Files: first 3-8 files to open
- UI-first Read Path: minimal path for visual or interaction changes
- Data-first Read Path: minimal path for persistence or model changes

## Dashboard

- Route/Page: `apps/web/src/app/routes/AppRoutes.tsx`, `apps/web/src/features/dashboard/DashboardPage.tsx`
- UI Entry: `apps/web/src/features/dashboard/registry.tsx`, `apps/web/src/features/dashboard/DashboardHeader.tsx`
- State/Repo: `apps/web/src/data/repositories/dashboardRepo.ts`, `apps/web/src/features/dashboard/layoutSyncAdapter.ts`
- Contracts/Data: `packages/core/src/models.ts`, `packages/db-contracts/src/schemas.ts`
- Common Bridges: tasks card, focus card, spend card, diary launcher, weather widget, settings theme override
- Top Files:
  - `apps/web/src/features/dashboard/DashboardPage.tsx`
  - `apps/web/src/features/dashboard/registry.tsx`
  - `apps/web/src/data/repositories/dashboardRepo.ts`
  - `apps/web/src/app/routes/SettingsRoute.tsx`
  - `packages/core/src/models.ts`
- UI-first Read Path:
  - `apps/web/src/features/dashboard/DashboardPage.tsx`
  - `apps/web/src/features/dashboard/registry.tsx`
  - target widget card file
- Data-first Read Path:
  - `apps/web/src/data/repositories/dashboardRepo.ts`
  - `packages/core/src/models.ts`
  - `packages/db-contracts/src/schemas.ts`

## Tasks

- Route/Page: `apps/web/src/features/tasks/pages/TasksPage.tsx`
- UI Entry: `apps/web/src/features/tasks/TasksBoard.tsx`, `apps/web/src/features/tasks/TaskDrawer.tsx`
- State/Repo: `apps/web/src/data/repositories/tasksRepo.ts`, `apps/web/src/features/tasks/useTaskReminderEngine.ts`, `apps/web/src/features/tasks/taskSync.ts`
- Contracts/Data: `packages/core/src/models.ts`, `packages/db-contracts/src/schemas.ts`, `packages/db-contracts/src/channels.ts`
- Common Bridges: dashboard tasks card, calendar task creation, focus autostart jump, task note editor
- Top Files:
  - `apps/web/src/features/tasks/pages/TasksPage.tsx`
  - `apps/web/src/features/tasks/TasksBoard.tsx`
  - `apps/web/src/features/tasks/TaskDrawer.tsx`
  - `apps/web/src/data/repositories/tasksRepo.ts`
  - `packages/db-contracts/src/schemas.ts`
  - `packages/core/src/models.ts`
- UI-first Read Path:
  - `apps/web/src/features/tasks/pages/TasksPage.tsx`
  - `apps/web/src/features/tasks/TasksBoard.tsx`
  - `apps/web/src/features/tasks/TaskDrawer.tsx`
- Data-first Read Path:
  - `apps/web/src/data/repositories/tasksRepo.ts`
  - `packages/db-contracts/src/schemas.ts`
  - `packages/core/src/models.ts`

## Focus

- Route/Page: `apps/web/src/features/focus/pages/FocusPage.tsx`
- UI Entry: `apps/web/src/features/focus/FocusCard.tsx`, `apps/web/src/features/focus/FocusSettingsDrawer.tsx`
- State/Repo: `apps/web/src/features/focus/useSharedFocusTimer.ts`, `apps/web/src/data/repositories/focusRepo.ts`, `apps/web/src/features/focus/SharedNoiseProvider.tsx`
- Contracts/Data: `packages/core/src/models.ts`, `apps/web/src/data/db/index.ts`
- Common Bridges: dashboard focus card, note-to-focus deep links, noise controls, background visuals
- Top Files:
  - `apps/web/src/features/focus/pages/FocusPage.tsx`
  - `apps/web/src/features/focus/FocusCard.tsx`
  - `apps/web/src/features/focus/useSharedFocusTimer.ts`
  - `apps/web/src/data/repositories/focusRepo.ts`
  - `packages/core/src/models.ts`
- UI-first Read Path:
  - `apps/web/src/features/focus/pages/FocusPage.tsx`
  - `apps/web/src/features/focus/FocusCard.tsx`
  - `apps/web/src/features/focus/FocusSettingsDrawer.tsx`
- Data-first Read Path:
  - `apps/web/src/features/focus/useSharedFocusTimer.ts`
  - `apps/web/src/data/repositories/focusRepo.ts`
  - `packages/core/src/models.ts`

## Diary

- Route/Page: `apps/web/src/features/diary/pages/ReviewPage.tsx`, `apps/web/src/features/diary/DiaryPanel.tsx`
- UI Entry: `apps/web/src/features/diary/review/ReviewDeck.tsx`, `apps/web/src/features/dashboard/cards/DiaryLauncherCard.tsx`
- State/Repo: `apps/web/src/data/repositories/diaryRepo.ts`, `apps/web/src/features/diary/review/reviewSessionStore.ts`
- Contracts/Data: `packages/core/src/models.ts`, `packages/db-contracts/src/schemas.ts`
- Common Bridges: dashboard diary card, review snapshot bridge, deletion and restore flows
- Top Files:
  - `apps/web/src/features/diary/DiaryPanel.tsx`
  - `apps/web/src/features/diary/pages/ReviewPage.tsx`
  - `apps/web/src/data/repositories/diaryRepo.ts`
  - `apps/web/src/features/diary/review/reviewDiaryBridge.ts`
  - `packages/db-contracts/src/schemas.ts`
- UI-first Read Path:
  - `apps/web/src/features/diary/DiaryPanel.tsx`
  - `apps/web/src/features/diary/pages/ReviewPage.tsx`
  - `apps/web/src/features/diary/review/ReviewDeck.tsx`
- Data-first Read Path:
  - `apps/web/src/data/repositories/diaryRepo.ts`
  - `packages/db-contracts/src/schemas.ts`
  - `packages/core/src/models.ts`

## Calendar

- Route/Page: `apps/web/src/features/calendar/pages/CalendarPage.tsx`
- UI Entry: `apps/web/src/features/tasks/components/TaskCalendarWidget.tsx`, `apps/web/src/shared/ui/DatePicker.tsx`
- State/Repo: `apps/web/src/features/calendar/calendar.model.ts`, `apps/web/src/data/repositories/tasksRepo.ts`
- Contracts/Data: `packages/core/src/models.ts`, `packages/db-contracts/src/schemas.ts`
- Common Bridges: task creation/update/delete, ICS export, shared date pickers
- Top Files:
  - `apps/web/src/features/calendar/pages/CalendarPage.tsx`
  - `apps/web/src/features/calendar/calendar.model.ts`
  - `apps/web/src/data/repositories/tasksRepo.ts`
  - `apps/web/src/features/tasks/components/TaskCalendarWidget.tsx`
  - `apps/web/src/shared/ui/DatePicker.tsx`
- UI-first Read Path:
  - `apps/web/src/features/calendar/pages/CalendarPage.tsx`
  - `apps/web/src/features/tasks/components/TaskCalendarWidget.tsx`
  - `apps/web/src/shared/ui/DatePicker.tsx`
- Data-first Read Path:
  - `apps/web/src/features/calendar/calendar.model.ts`
  - `apps/web/src/data/repositories/tasksRepo.ts`
  - `packages/db-contracts/src/schemas.ts`

## RSS

- Route/Page: `apps/web/src/features/rss/pages/RssPage.tsx`
- UI Entry: `apps/web/src/features/rss/pages/RssPage.tsx`
- State/Repo: `apps/web/src/features/rss/rssApi.ts`, `apps/web/src/features/rss/rssModel.ts`, `apps/web/src/features/labs/LabsContext.tsx`
- Contracts/Data: `apps/web/src/data/db/index.ts`, `apps/web/src/data/models/types.ts`
- Common Bridges: labs install flow, guarded routes, sidebar insertion, feed seeding
- Top Files:
  - `apps/web/src/features/rss/pages/RssPage.tsx`
  - `apps/web/src/features/rss/rssApi.ts`
  - `apps/web/src/features/rss/rssModel.ts`
  - `apps/web/src/features/labs/labsApi.ts`
  - `apps/web/src/app/routes/AppRoutes.tsx`
- UI-first Read Path:
  - `apps/web/src/features/rss/pages/RssPage.tsx`
  - `apps/web/src/app/routes/AppRoutes.tsx`
  - `apps/web/src/app/layout/Sidebar.tsx`
- Data-first Read Path:
  - `apps/web/src/features/rss/rssApi.ts`
  - `apps/web/src/features/rss/rssModel.ts`
  - `apps/web/src/data/db/index.ts`

## Weather

- Route/Page: dashboard widget only, via `apps/web/src/features/dashboard/registry.tsx`
- UI Entry: `apps/web/src/features/dashboard/cards/WeatherWidgetCard.tsx`
- State/Repo: `apps/web/src/features/weather/weatherRuntime.ts`, `apps/web/src/features/weather/weatherApi.ts`
- Contracts/Data: `apps/web/src/shared/prefs/preferences.ts`, `apps/web/src/shared/prefs/PreferencesContext.ts`
- Common Bridges: dashboard card registry, preferences, icons, location handling
- Top Files:
  - `apps/web/src/features/dashboard/cards/WeatherWidgetCard.tsx`
  - `apps/web/src/features/weather/weatherRuntime.ts`
  - `apps/web/src/features/weather/weatherApi.ts`
  - `apps/web/src/features/weather/weatherIcons.tsx`
  - `apps/web/src/shared/prefs/preferences.ts`
- UI-first Read Path:
  - `apps/web/src/features/dashboard/cards/WeatherWidgetCard.tsx`
  - `apps/web/src/features/weather/weatherIcons.tsx`
  - `apps/web/src/features/dashboard/registry.tsx`
- Data-first Read Path:
  - `apps/web/src/features/weather/weatherRuntime.ts`
  - `apps/web/src/features/weather/weatherApi.ts`
  - `apps/web/src/shared/prefs/preferences.ts`

## Spend

- Route/Page: dashboard widget only, via `apps/web/src/features/dashboard/registry.tsx`
- UI Entry: `apps/web/src/features/spend/SpendCard.tsx`, `apps/web/src/features/spend/SpendChart.tsx`
- State/Repo: `apps/web/src/data/repositories/spendRepo.ts`
- Contracts/Data: `packages/core/src/models.ts`, `packages/db-contracts/src/schemas.ts`
- Common Bridges: dashboard card registry, icon mapping, category editing
- Top Files:
  - `apps/web/src/features/spend/SpendCard.tsx`
  - `apps/web/src/features/spend/SpendChart.tsx`
  - `apps/web/src/data/repositories/spendRepo.ts`
  - `apps/web/src/features/dashboard/registry.tsx`
  - `packages/db-contracts/src/schemas.ts`
- UI-first Read Path:
  - `apps/web/src/features/spend/SpendCard.tsx`
  - `apps/web/src/features/spend/SpendChart.tsx`
  - `apps/web/src/features/dashboard/registry.tsx`
- Data-first Read Path:
  - `apps/web/src/data/repositories/spendRepo.ts`
  - `packages/db-contracts/src/schemas.ts`
  - `packages/core/src/models.ts`

## Notes

- Route/Page: `apps/web/src/features/notes/pages/NotePage.tsx`
- UI Entry: `apps/web/src/features/notes/components/NoteEditor.tsx`, `apps/web/src/features/notes/components/NoteBrowser.tsx`, `apps/web/src/features/notes/components/NoteSidebar.tsx`
- State/Repo: `apps/web/src/data/repositories/notesRepo.ts`, `apps/web/src/data/repositories/noteTagsRepo.ts`, `apps/web/src/data/repositories/noteAppearanceRepo.ts`
- Contracts/Data: `packages/core/src/models.ts`, `apps/web/src/features/notes/model/richTextCodec.ts`
- Common Bridges: appearance modal, export modal, trash flows, tags, note route full-bleed layout
- Top Files:
  - `apps/web/src/features/notes/pages/NotePage.tsx`
  - `apps/web/src/features/notes/components/NoteEditor.tsx`
  - `apps/web/src/features/notes/components/NoteBrowser.tsx`
  - `apps/web/src/data/repositories/notesRepo.ts`
  - `apps/web/src/data/repositories/noteTagsRepo.ts`
  - `apps/web/src/data/repositories/noteAppearanceRepo.ts`
- UI-first Read Path:
  - `apps/web/src/features/notes/pages/NotePage.tsx`
  - `apps/web/src/features/notes/components/NoteEditor.tsx`
  - `apps/web/src/features/notes/components/NoteBrowser.tsx`
- Data-first Read Path:
  - `apps/web/src/data/repositories/notesRepo.ts`
  - `apps/web/src/data/repositories/noteTagsRepo.ts`
  - `packages/core/src/models.ts`

## Labs

- Route/Page: `apps/web/src/features/labs/pages/LabsPage.tsx`
- UI Entry: `apps/web/src/features/labs/pages/LabsPage.tsx`
- State/Repo: `apps/web/src/features/labs/LabsContext.tsx`, `apps/web/src/features/labs/labsApi.ts`, `apps/web/src/features/labs/accessRules.ts`
- Contracts/Data: `apps/web/src/data/db/index.ts`, `apps/web/src/data/models/types.ts`
- Common Bridges: guarded routes, sidebar feature entries, RSS and habits install state, subscription tier
- Top Files:
  - `apps/web/src/features/labs/pages/LabsPage.tsx`
  - `apps/web/src/features/labs/LabsContext.tsx`
  - `apps/web/src/features/labs/labsApi.ts`
  - `apps/web/src/features/labs/accessRules.ts`
  - `apps/web/src/app/routes/AppRoutes.tsx`
  - `apps/web/src/app/layout/Sidebar.tsx`
- UI-first Read Path:
  - `apps/web/src/features/labs/pages/LabsPage.tsx`
  - `apps/web/src/features/labs/labsI18n.ts`
  - `apps/web/src/app/layout/Sidebar.tsx`
- Data-first Read Path:
  - `apps/web/src/features/labs/labsApi.ts`
  - `apps/web/src/features/labs/LabsContext.tsx`
  - `apps/web/src/features/labs/accessRules.ts`
