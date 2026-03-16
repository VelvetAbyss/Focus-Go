# Focus&go Routing Dictionary

Use this file first. Match request words to a feature domain, then apply the bias to choose the first files.

## Output Rule

For each request:

1. Pick the primary feature domain
2. Pick one bias: UI, interaction, data, routing, persistence
3. Return Top 3 candidate files from the matching group
4. Add one bridge domain only if the request clearly spans modules

## Bias Guide

- UI: page layout, card look, text hierarchy, empty state, modal layout, animation
- Interaction: click flows, shortcuts, toggles, drag/drop, open/close behavior, transitions
- Data: state shape, derived values, validation, aggregation, sorting rules
- Routing: page entry, redirect, sidebar item, guarded access, URL params
- Persistence: repo, Dexie table, schema, migration, contract, storage-backed preferences

## Domain Keywords

### Dashboard

- Match words:
  - dashboard, home, widget, card, panel, launcher, overview
- Candidate groups:
  - UI: `DashboardPage.tsx`, `registry.tsx`, target card file
  - Interaction: `DashboardPage.tsx`, `DashboardHeader.tsx`, `layoutSyncAdapter.ts`
  - Data/Persistence: `dashboardRepo.ts`, `models.ts`, `schemas.ts`
- Common bridge domains:
  - tasks, focus, spend, diary, weather

### Tasks

- Match words:
  - task, todo, subtask, reminder, due date, progress, kanban, pinned, note in task
- Candidate groups:
  - UI: `TasksPage.tsx`, `TasksBoard.tsx`, `TaskDrawer.tsx`
  - Interaction: `TasksBoard.tsx`, `TaskDrawer.tsx`, `useTaskReminderEngine.ts`
  - Data/Persistence: `tasksRepo.ts`, `packages/db-contracts/src/schemas.ts`, `packages/core/src/models.ts`
- Common bridge domains:
  - calendar, focus, dashboard

### Focus

- Match words:
  - focus, pomodoro, timer, noise, white noise, session, break, ambient
- Candidate groups:
  - UI: `FocusPage.tsx`, `FocusCard.tsx`, `FocusSettingsDrawer.tsx`
  - Interaction: `useSharedFocusTimer.ts`, `SharedNoiseProvider.tsx`, `FocusCard.tsx`
  - Data/Persistence: `focusRepo.ts`, `models.ts`, `data/db/index.ts`
- Common bridge domains:
  - dashboard, tasks

### Diary

- Match words:
  - diary, review, journal, reflection, recap, restore diary, trash diary, snapshot
- Candidate groups:
  - UI: `DiaryPanel.tsx`, `ReviewPage.tsx`, `ReviewDeck.tsx`
  - Interaction: `DiaryPanel.tsx`, `ReviewHistoryPanel.tsx`, `reviewDiaryBridge.ts`
  - Data/Persistence: `diaryRepo.ts`, `schemas.ts`, `models.ts`
- Common bridge domains:
  - dashboard

### Calendar

- Match words:
  - calendar, schedule, date picker, month view, ICS, event, plan by date
- Candidate groups:
  - UI: `CalendarPage.tsx`, `TaskCalendarWidget.tsx`, `DatePicker.tsx`
  - Interaction: `CalendarPage.tsx`, `calendar.model.ts`, `TaskCalendarWidget.tsx`
  - Data/Persistence: `tasksRepo.ts`, `calendar.model.ts`, `schemas.ts`
- Common bridge domains:
  - tasks

### RSS

- Match words:
  - rss, feed, source, article, unread, reader, subscription feed, rsshub
- Candidate groups:
  - UI: `RssPage.tsx`, `AppRoutes.tsx`, `Sidebar.tsx`
  - Interaction: `RssPage.tsx`, `rssApi.ts`, `LabsContext.tsx`
  - Data/Persistence: `rssApi.ts`, `rssModel.ts`, `data/db/index.ts`
- Common bridge domains:
  - labs

### Weather

- Match words:
  - weather, forecast, city, temperature, climate, auto location
- Candidate groups:
  - UI: `WeatherWidgetCard.tsx`, `weatherIcons.tsx`, `registry.tsx`
  - Interaction: `WeatherWidgetCard.tsx`, `weatherRuntime.ts`, `preferences.ts`
  - Data/Persistence: `weatherRuntime.ts`, `weatherApi.ts`, `preferences.ts`
- Common bridge domains:
  - dashboard

### Spend

- Match words:
  - spend, expense, category, finance, chart, amount, budget widget
- Candidate groups:
  - UI: `SpendCard.tsx`, `SpendChart.tsx`, `registry.tsx`
  - Interaction: `SpendCard.tsx`, `SpendChart.tsx`, `spendRepo.ts`
  - Data/Persistence: `spendRepo.ts`, `schemas.ts`, `models.ts`
- Common bridge domains:
  - dashboard

### Notes

- Match words:
  - note, editor, export, tag, trash note, appearance, rich text, sidebar, note page
- Candidate groups:
  - UI: `NotePage.tsx`, `NoteEditor.tsx`, `NoteBrowser.tsx`
  - Interaction: `NotePage.tsx`, `NoteSidebar.tsx`, `ExportModal.tsx`
  - Data/Persistence: `notesRepo.ts`, `noteTagsRepo.ts`, `noteAppearanceRepo.ts`
- Common bridge domains:
  - app-shell, shared theme, shared i18n

### Labs

- Match words:
  - labs, premium, install feature, unlock, gating, subscription, feature access
- Candidate groups:
  - UI: `LabsPage.tsx`, `labsI18n.ts`, `Sidebar.tsx`
  - Interaction: `LabsContext.tsx`, `accessRules.ts`, `AppRoutes.tsx`
  - Data/Persistence: `labsApi.ts`, `data/db/index.ts`, `data/models/types.ts`
- Common bridge domains:
  - rss, habits, app routes

## Cross-Cutting Modifiers

### UI modifiers

- Match words:
  - card, modal, drawer, list, detail, spacing, typography, empty state, animation, visual polish
- Action:
  - prefer page/component files before repo files

### Interaction modifiers

- Match words:
  - click, tap, open, close, toggle, confirm, drag, sort, filter, jump, redirect
- Action:
  - prefer page/component + runtime/store files

### Data modifiers

- Match words:
  - state, aggregate, derive, count, sort rule, time rule, default state, validation
- Action:
  - prefer repo/model/utility files, then contracts

### Routing modifiers

- Match words:
  - route, page entry, sidebar, nav, redirect, guarded route, tab switch
- Action:
  - prefer `apps/web/src/app/routes/*` and `apps/web/src/app/layout/Sidebar.tsx`

### Persistence modifiers

- Match words:
  - repo, schema, contract, db, storage, migration, persist, restore, delete permanently
- Action:
  - prefer repositories, `apps/web/src/data/db/index.ts`, `packages/db-contracts/src/*`

## New Request Handling

If a request does not clearly match one domain:

1. Choose the closest product domain
2. Add one cross-cutting modifier
3. Return Top 3 candidates
4. Say that wider reading may be needed only after checking those files
