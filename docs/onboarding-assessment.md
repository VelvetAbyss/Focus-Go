# Focus&go Onboarding Assessment

> Assessment date: 2026-03-23
> Design context: `.impeccable.md`

---

## 1. Project Overview

Focus&go is a personal productivity workspace that integrates planning (tasks), execution (focus/pomodoro), reflection (diary), and daily signals (weather, spend) in one continuous workflow. The product targets individual knowledge workers, especially procrastination-prone users who open it at the start of the workday and keep it open until end of day.

---

## 2. Current State: Zero Onboarding

**The project currently has NO onboarding implementation.** This is the most critical finding.

| Aspect | Status |
|--------|--------|
| Welcome screen | ❌ Does not exist |
| First-time user detection | ❌ No localStorage flags for onboarding |
| Guided tour / walkthrough | ❌ Not implemented |
| Empty states | ⚠️ Partial — only habits, tasks analytics, spend have basic empty states |
| Contextual tooltips | ❌ Not implemented |
| Feature discovery | ❌ Not implemented |
| Skip option | ❌ N/A (nothing to skip) |

### What exists but is not leveraged:
- Basic empty state pattern in `HabitTrackerPage.tsx` (animated emoji + description)
- Generic `ModulePlaceholder` component
- i18n translations for some empty states (`modules.note.emptyTitle`, `modules.note.emptyDescription`)
- Seed data with a task titled "Draft MVP onboarding flow" — ironic, but not real onboarding
- Rich UI infrastructure: Dialog, Drawer, Popover, Toast components ready to support onboarding

---

## 3. Identified Challenges

### 3.1 High feature density for new users
The dashboard alone has: todos, weather, diary launcher, spend tracker — all configurable via react-grid-layout. A new user sees a blank or pre-configured grid with no explanation of what each widget does or how to add/remove them.

### 3.2 No "start here" signal
When a user opens Focus&go for the first time, they land on the dashboard. There is no clear entry point, no "do this first" guidance. The sidebar shows 7+ navigation items (Dashboard, Tasks, Note, Calendar, Focus, Review, Labs) — overwhelming for a first visit.

### 3.3 Feature complexity is front-loaded
Tasks alone have: status flow, priority, due dates, subtasks, tags, progress logs, activity logs, rich text notes, reminders, pinned items. Notes have: rich text editing, tags, appearance settings, export, trash/recycle bin. Presenting all of this without progressive disclosure will overwhelm beginners.

### 3.4 The "aha moment" is gated behind knowing where to click
The aha moment is "first task created." But a new user must: (1) find the Tasks nav item, (2) understand the board layout, (3) locate the "add task" action, (4) fill in the form. None of this is guided.

---

## 4. Onboarding Strategy

### Target: < 2 minutes to first task created

Given the time budget and mixed user levels, the onboarding must be:

1. **Ultra-fast** — get to the aha moment in under 2 minutes
2. **Skippable** — experienced users can bypass entirely
3. **Progressive** — teach advanced features later, when contextually relevant
4. **Action-oriented** — user does something real, not just reads about features

### Proposed Onboarding Flow

#### Phase 1: Welcome Card (10 seconds)
- Appears as a dashboard card or lightweight modal on first visit
- **Content**: "Welcome to Focus&go — your all-in-one work cockpit. Let's create your first task."
- **CTA**: [Start] or [I'll explore on my own]
- **Tone**: Warm, concise, respects user intelligence
- **Design**: Matches warm clarity aesthetic (`#F5F3F0` background, `#3A3733` text, low-saturation)

#### Phase 2: Guided First Task (60-90 seconds)
- Navigate user to Tasks page
- Pre-focus the task creation form
- Guide through 3 essential fields only:
  1. **Title** — "What's one thing you want to get done today?"
  2. **Priority** — "How important is it?" (with visual priority selector)
  3. **Start Focus** — "Want to focus on it now?" (offers to jump to Focus Center)
- On completion: celebrate subtly (not patronizing), show task in board
- Mark onboarding as complete in localStorage

#### Phase 3: Contextual Discovery (Ongoing, not in onboarding)
- Empty states teach features when users encounter them
- "New" badges on unvisited modules
- First-time tooltip on features like Focus Center, Notes, Review — triggered at point of use
- Dismissable, tracked per-feature in localStorage

---

## 5. Empty State Audit & Recommendations

### Current empty states:

| Module | Current State | Recommendation |
|--------|---------------|----------------|
| Dashboard | Pre-configured widgets, no guidance | Add "Welcome" card for first visit, then auto-remove after task created |
| Tasks (empty) | No empty state found | Add: illustration + "Your tasks will appear here" + [Create first task] + [Start from template] |
| Notes (empty) | i18n strings exist (`modules.note.emptyTitle`) | Verify rendered UI matches; add illustration + template option |
| Focus Center | Unknown | Add: "Start your first focus session" with a 25-min pomodoro preset |
| Calendar | Unknown | Add: "Your tasks with due dates appear here" |
| Review/Diary | Unknown | Add: "Capture your first daily reflection" |
| Spend | Has basic empty state | Enhance with illustration + "Track spending awareness" |
| Habits | Has animated emoji + description | Good — keep as is |

### Empty state pattern to follow:

Every empty state should have:
1. **Illustration or icon** — visual interest, not blank canvas
2. **What will be here** — clear description
3. **Why it matters** — one-line value prop
4. **How to get started** — primary CTA button
5. **Alternative** — "or start from template" / "or watch 1-min tutorial"

---

## 6. First-Time User Detection

Implement localStorage-based tracking:

```typescript
// Onboarding completion
localStorage.setItem('onboarding-completed', 'true');

// Per-feature first-visit tracking
localStorage.setItem('feature-seen-tasks', 'true');
localStorage.setItem('feature-seen-focus', 'true');
localStorage.setItem('feature-seen-notes', 'true');
// etc.

// Respect skip decisions
localStorage.setItem('onboarding-skipped', 'true');
```

### Logic:
- On app init: check `onboarding-completed` or `onboarding-skipped`
- If neither exists → show welcome card
- If `onboarding-completed` → no welcome, but show feature tooltips for first visits
- If `onboarding-skipped` → no welcome, no tooltips
- Returning users: never show onboarding again

---

## 7. Progressive Disclosure Strategy

Don't teach everything upfront. Layer complexity:

### First session (Day 1):
- Create a task
- Start a focus session (optional)
- See the dashboard working

### First week:
- Add subtasks to a task
- Create a note
- Write a diary entry
- Customize dashboard layout

### Ongoing (contextual discovery):
- Task tags and filters
- Note appearance settings
- Focus session history and stats
- Labs / Habit tracker (premium features)
- Export, trash management

### Implementation:
- "New" badge indicators on features not yet visited
- Contextual tooltip on first encounter with each feature
- Feature unlock milestones (e.g., "You've completed 5 tasks — try Tags to organize them")

---

## 8. Technical Implementation Notes

### Components to build:
1. **`OnboardingWelcomeCard`** — dashboard widget or modal for first visit
2. **`OnboardingGuide`** — lightweight overlay/spotlight for guided first task
3. **`EmptyState`** — reusable component with illustration, title, description, CTA
4. **`FeatureTooltip`** — contextual tooltip with dismiss + "don't show again"
5. **`OnboardingContext`** — React context for onboarding state management

### Existing infrastructure to leverage:
- `Dialog` / `AlertDialog` components (`src/components/ui/`)
- `Drawer` component (`src/shared/ui/Drawer.tsx`)
- `Toast` system (`src/shared/ui/toast/`)
- `Popover` component (`src/components/ui/popover.tsx`)
- i18n system (`src/shared/i18n/`)
- Preferences system (`src/shared/prefs/`)
- Theme tokens (`src/shared/theme/tokens.css`)

### localStorage keys to add:
```typescript
const ONBOARDING_KEYS = {
  COMPLETED: 'onboarding-completed',
  SKIPPED: 'onboarding-skipped',
  FEATURE_PREFIX: 'feature-seen-',
} as const;
```

---

## 9. Design Alignment

All onboarding UI must follow the existing design principles from `.impeccable.md`:

| Principle | Onboarding Application |
|-----------|----------------------|
| Start-fast by default | Welcome card has one clear CTA, no multi-step forms |
| Complexity budget | Onboarding teaches only task creation; other features are discovered later |
| One-day cockpit | Onboarding respects the all-day-use model — no intrusive overlays after Day 1 |
| Warm clarity | Welcome UI uses `#F5F3F0`, `#3A3733`, warm illustrations, soft corners |
| Control without pressure | Skip is always visible; no urgency language; user controls the pace |

---

## 10. Success Metrics

Track these to validate onboarding effectiveness:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Onboarding completion rate | > 70% | `onboarding-completed` localStorage flag |
| Time to first task | < 2 min | Timestamp from app init to first task creation |
| Skip rate | < 30% | `onboarding-skipped` localStorage flag |
| Day-1 retention | Baseline TBD | Users who return next day |
| Feature adoption (7 days) | > 50% use Focus | Track `feature-seen-focus` |
| Task creation rate | > 80% create 1+ task | Track task count per user |

---

## 11. Anti-Patterns to Avoid

- ❌ Long wizard before user can access the product
- ❌ Patronizing explanations ("This is a task. Tasks help you remember things.")
- ❌ Auto-playing tours that block UI interaction
- ❌ Showing the same onboarding to returning users
- ❌ Hiding "Skip" or making it hard to find
- ❌ Overwhelming with 7+ features in the welcome
- ❌ Separate tutorial mode disconnected from the real product
- ❌ Generic AI-generated illustrations (use warm, contextual visuals)
