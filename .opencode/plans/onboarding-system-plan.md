# Onboarding System Implementation Plan

> Phase 1 + Phase 2 + Phase 3 complete plan
> Based on system architecture: Entry Layer → Flow Layer → State System → Progressive Layer

---

## System Architecture

```
Onboarding System =
  Onboarding Runtime (Layer 1)
  + Dashboard Entry Control (Layer 2)
  + Flow Controller (Layer 3)
  + Tasks Execution Engine (Layer 4)
  + Completion Logic (Layer 5)
  + Progressive System (Layer 6)
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| localStorage only, no Dexie | Onboarding is ephemeral user state, not data |
| No new complex state management | Reuse existing patterns (read/write functions + React Context) |
| Reuse existing components | TaskDrawer, Dashboard, Dialog — no new UI chrome |
| One-time flow, long-term system | Welcome is one-shot; empty states + tooltips persist |

---

## File Structure

```
src/features/onboarding/
  ├── onboarding.types.ts          ← types + localStorage constants
  ├── onboarding.runtime.ts        ← read/write functions (localStorage layer)
  ├── useOnboarding.ts             ← React hook (context consumer)
  ├── OnboardingProvider.tsx       ← React context provider
  ├── OnboardingWelcomeModal.tsx   ← Welcome modal (reuses shadcn Dialog)
  └── index.ts                     ← barrel export

src/shared/ui/
  └── EmptyState.tsx               ← Reusable empty state component

src/shared/i18n/messages/
  ├── en.ts                        ← + onboarding strings
  └── zh.ts                        ← + onboarding strings
```

### Modified Files

```
src/App.tsx                        ← wrap with OnboardingProvider
src/features/dashboard/DashboardPage.tsx  ← entry gate logic
src/features/tasks/pages/TasksPage.tsx    ← onboarding mode detection
src/features/tasks/TasksBoard.tsx         ← expose onTaskCreated callback
src/shared/i18n/messages/en.ts            ← new i18n keys
src/shared/i18n/messages/zh.ts            ← new i18n keys
src/shared/i18n/types.ts                  ← new TranslationKey entries
```

---

## Phase 1: Core Runtime + Welcome + Task Flow + Completion

### Step 1: `onboarding.types.ts`

Define types and localStorage constants.

```typescript
// Status
type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

// Steps within the flow
type OnboardingStep = 'welcome' | 'create_task' | 'done'

// Feature seen tracking key
type FeatureSeenKey = 'tasks' | 'focus' | 'diary' | 'notes' | 'calendar'

// localStorage keys
const ONBOARDING_STATUS_KEY = 'focusgo.onboarding.status'
const ONBOARDING_STEP_KEY = 'focusgo.onboarding.step'
const FEATURE_SEEN_PREFIX = 'focusgo.feature-seen.'
```

### Step 2: `onboarding.runtime.ts`

Pure functions — no React, no hooks. Mirrors the existing `readX()`/`writeX()` pattern from `preferences.ts`.

```typescript
// Status
export function readOnboardingStatus(): OnboardingStatus
export function writeOnboardingStatus(status: OnboardingStatus): void

// Step
export function readOnboardingStep(): OnboardingStep
export function writeOnboardingStep(step: OnboardingStep): void

// Feature seen
export function readFeatureSeen(key: FeatureSeenKey): boolean
export function writeFeatureSeen(key: FeatureSeenKey): void

// Computed helpers
export function isOnboardingActive(): boolean {
  const status = readOnboardingStatus()
  return status === 'not_started' || status === 'in_progress'
}

export function isOnboardingCompleted(): boolean {
  const status = readOnboardingStatus()
  return status === 'completed' || status === 'skipped'
}

// Actions
export function startOnboarding(): void {
  writeOnboardingStatus('in_progress')
  writeOnboardingStep('welcome')
}

export function skipOnboarding(): void {
  writeOnboardingStatus('skipped')
  writeOnboardingStep('done')
}

export function completeOnboarding(): void {
  writeOnboardingStatus('completed')
  writeOnboardingStep('done')
}
```

### Step 3: `useOnboarding.ts` + `OnboardingProvider.tsx`

React Context wrapping the runtime. Follows the exact same pattern as `PreferencesProvider` / `usePreferences`.

```typescript
// OnboardingContext.ts
type OnboardingContextValue = {
  status: OnboardingStatus
  step: OnboardingStep
  isActive: boolean
  isCompleted: boolean
  start: () => void
  skip: () => void
  complete: () => void
  markFeatureSeen: (key: FeatureSeenKey) => void
  isFeatureSeen: (key: FeatureSeenKey) => boolean
}
```

```typescript
// OnboardingProvider.tsx
// - Initializes state from localStorage on mount
// - Provides setter functions that write to localStorage AND update React state
// - Listens to StorageEvent for cross-tab sync (same as PreferencesProvider)
// - Children: {children}
```

```typescript
// useOnboarding.ts
// - useContext(OnboardingContext)
// - Throws if used outside provider
```

### Step 4: `OnboardingWelcomeModal.tsx`

**A modal, not a page.** Reuses shadcn Dialog component (`@/components/ui/dialog`).

Content:
- Title: "Welcome to Focus&go"
- Description: "Your all-in-one work cockpit. Let's create your first task."
- Buttons: [Start] (primary) | [I'll explore on my own] (ghost/link)

Behavior:
- Rendered by DashboardPage when `status === 'not_started'`
- On "Start": calls `start()`, navigates to `/tasks`
- On "Skip": calls `skip()`, modal closes, normal dashboard

Styling:
- Follow `.impeccable.md` design principles
- `#F5F3F0` background tones, `#3A3733` text
- Warm, calm, non-patronizing

### Step 5: `DashboardPage.tsx` — Entry Gate

Add onboarding gate logic at the top of DashboardPage:

```typescript
const { status, step } = useOnboarding()

// Entry gate
if (status === 'not_started') {
  // Render normal dashboard + welcome modal overlay
}

if (status === 'in_progress' && step === 'create_task') {
  // Redirect to /tasks via useNavigate
  // This is the "Dashboard as routing system" behavior
}

// else: normal dashboard
```

This implements the user's spec:
```
if not_started → show welcome modal
if in_progress → redirect → Tasks
if completed   → normal dashboard
```

### Step 6: `TasksPage.tsx` — Onboarding Mode

Detect onboarding state and communicate it to TasksBoard:

```typescript
const { status, step, complete, markFeatureSeen } = useOnboarding()
const isOnboardingTask = status === 'in_progress' && step === 'create_task'

// Pass to TasksBoard
<TasksBoard
  asCard={false}
  topView={viewMode}
  onboardingMode={isOnboardingTask}
  onOnboardingTaskCreated={handleOnboardingComplete}
/>
```

The `handleOnboardingComplete` callback:
```typescript
const handleOnboardingComplete = useCallback(() => {
  complete()
  markFeatureSeen('tasks')
  toast.push({
    variant: 'success',
    message: 'Your first task is ready. Start a focus session when you\'re set.',
  })
}, [complete, markFeatureSeen, toast])
```

### Step 7: `TasksBoard.tsx` — Integrate Onboarding

**Props change:**
```typescript
type TasksBoardProps = {
  asCard?: boolean
  className?: string
  topView?: TopView
  onboardingMode?: boolean                    // NEW
  onOnboardingTaskCreated?: () => void        // NEW
}
```

**Behavior change in `handleAddTask`:**

After the existing task creation logic (line 248-260), add:
```typescript
if (onboardingMode && onOnboardingTaskCreated) {
  onOnboardingTaskCreated()
}
```

This is a minimal, non-invasive change — it's a callback hook, not a mode override.

### Step 8: i18n Keys

Add to `en.ts`:
```typescript
'onboarding.welcome.title': 'Welcome to Focus&go'
'onboarding.welcome.description': 'Your all-in-one work cockpit. Let\'s create your first task.'
'onboarding.welcome.start': 'Start'
'onboarding.welcome.skip': 'I\'ll explore on my own'
'onboarding.complete.message': 'Your first task is ready. Start a focus session when you\'re set.'
```

Add to `zh.ts`:
```typescript
'onboarding.welcome.title': '欢迎使用 Focus&go'
'onboarding.welcome.description': '你的一站式效率工作台。让我们创建你的第一个任务。'
'onboarding.welcome.start': '开始'
'onboarding.welcome.skip': '我自己探索'
'onboarding.complete.message': '你的第一个任务已就绪。准备好了可以开始专注。'
```

Update `TranslationKey` type in `types.ts`.

### Step 9: `App.tsx` — Provider Integration

Wrap app with OnboardingProvider:

```tsx
<PreferencesProvider>
  <OnboardingProvider>     {/* NEW */}
    <ToastProvider>
      <LabsProvider>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </LabsProvider>
    </ToastProvider>
  </OnboardingProvider>
</PreferencesProvider>
```

---

## Phase 2: Empty State System

### `EmptyState.tsx` — Reusable Component

```typescript
type EmptyStateProps = {
  icon?: ReactNode         // lucide icon or custom illustration
  title: string            // "No tasks yet"
  description: string      // "Tasks help you organize your work"
  cta?: {                  // primary action
    label: string
    onClick: () => void
  }
  secondary?: {            // alternative action
    label: string
    onClick: () => void
  }
  className?: string
}
```

Design:
- Centered layout, generous padding
- Muted icon (not aggressive)
- `#F5F3F0` background card or dashed border
- Title: `text-lg font-medium`, description: `text-sm text-muted-foreground`
- CTA: primary button, secondary: ghost/link button

### Integration Points

| Module | Where | Condition |
|--------|-------|-----------|
| Tasks | TasksBoard | `tasks.length === 0` |
| Diary | DiaryPanel | no entries for today |
| Focus | FocusPage | no focus sessions |
| Spend | SpendCard | no spend entries |
| Notes | NotePage | no notes exist |

Each integration:
1. Import `EmptyState`
2. Replace any existing inline empty state OR add where none exists
3. Use consistent props pattern

---

## Phase 3: Progressive Tooltip System + Time Trigger

### Feature Seen Registry

Already built in Phase 1 (`readFeatureSeen` / `writeFeatureSeen`).

### Tooltip Pattern

NOT hover tooltips. Behavior-triggered contextual hints.

Example: After user creates their first task → show a transient toast or subtle hint near the Focus sidebar item.

Implementation:
- A lightweight hook `useFeatureHint(key, trigger)` that checks `isFeatureSeen(key)` and shows a hint when the trigger condition is met
- Hints are dismissable with "Don't show again"
- Stored via `writeFeatureSeen(key)`

### Time-based Triggers

Lightweight scheduler in `AppShell.tsx` (same place as `useTaskReminderEngine`):

```typescript
useOnboardingHints()
```

Rules:
- 18:00+ local time → if diary not seen today, hint to write a diary entry
- After task completion → if focus not seen, hint to start a focus session

This is a **hook**, not a separate engine. Checks conditions on mount and on relevant state changes.

---

## Complete User Path

```
First visit
  ↓
Dashboard (status: not_started)
  ↓
Welcome Modal appears
  ↓
Click "Start"
  → status: in_progress, step: create_task
  → navigate(/tasks)
  ↓
Dashboard redirect: /tasks (status: in_progress)
  ↓
TasksPage detects onboardingMode
  ↓
User types task title in TaskAddComposer
  ↓
Click "Add"
  → task created (existing flow)
  → onOnboardingTaskCreated() fires
  → status: completed, step: done
  → feature-seen: tasks
  → toast: "Your first task is ready..."
  ↓
User sees task in board
  ↓
Onboarding complete. No more onboarding UI.
  ↓
Later: empty states, feature hints, time triggers
```

---

## Implementation Order (Strict)

### Phase 1 (10 files)
1. `onboarding.types.ts` — types + constants
2. `onboarding.runtime.ts` — localStorage functions
3. `OnboardingProvider.tsx` + `useOnboarding.ts` — React context
4. `index.ts` — barrel export
5. `OnboardingWelcomeModal.tsx` — welcome UI
6. `en.ts` / `zh.ts` / `types.ts` — i18n strings
7. `App.tsx` — add provider
8. `DashboardPage.tsx` — entry gate logic
9. `TasksPage.tsx` — pass onboarding props
10. `TasksBoard.tsx` — integrate callback

### Phase 2 (2-3 files)
11. `EmptyState.tsx` — reusable component
12. TasksBoard / FocusPage / DiaryPanel — integrate empty states

### Phase 3 (1-2 files)
13. `useFeatureHint` hook — behavior-triggered hints
14. `AppShell.tsx` — time-based trigger hook

---

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| TasksBoard is 608 lines — adding props increases complexity | Changes are minimal: 2 new props + 3 lines in handleAddTask |
| localStorage can be cleared manually | Runtime gracefully defaults to 'not_started' if no value found |
| User navigates away during onboarding | Dashboard re-redirects to /tasks as long as status is 'in_progress' |
| User closes browser mid-onboarding | Status persists in localStorage — resumes on next visit |
| Seed data creates tasks on first launch | Onboarding checks status, not task count — seed doesn't interfere |
| Cross-tab state sync | StorageEvent listener in OnboardingProvider (same pattern as PreferencesProvider) |

---

## Verification Checklist

- [ ] New user: welcome modal shows on first visit
- [ ] New user: clicking Start navigates to /tasks
- [ ] New user: creating a task completes onboarding
- [ ] New user: toast shows after onboarding completion
- [ ] Returning user: no welcome modal shown
- [ ] Skip path: "I'll explore" dismisses modal, no future prompts
- [ ] Cross-tab: onboarding state syncs across tabs
- [ ] Empty states: show when appropriate (no tasks, no notes, etc.)
- [ ] i18n: both EN and ZH strings work
- [ ] Theme: welcome modal respects light/dark theme
- [ ] Keyboard: welcome modal is accessible (ESC to close, focus trap)
- [ ] Lint + build: `npm run verify` passes
