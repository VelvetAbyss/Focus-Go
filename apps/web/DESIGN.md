# Design System — Focus&go · 纸与墨 (Paper & Ink)

Always read this before a visual or UI change. Tokens live in
`src/shared/theme/tokens.css`; the JS mirror for motion/react is
`src/shared/motion/tokens.ts`. Preview of the system: see the decisions log.

## Product context
- **What this is:** an all-in-one personal productivity workspace: tasks,
  projects, calendar, notes, diary, focus timer, habits, trips, timeline and
  life widgets.
- **Who it's for:** individuals (knowledge workers, students, makers) working
  for hours a day on laptop and desktop screens (1280–1920px). The UI is
  bilingual, with Chinese as the primary language.
- **Project type:** a desktop-first web app, also shipped as Tauri builds for
  macOS and Windows.
- **Memorable first impression:** a quiet, focused, paper-feel workspace
  (安静、专注的纸感工作台).

## Aesthetic direction
- **Direction:** Paper & Ink. The UI is warm paper and dark ink with one
  deep-teal pen. Color is rare and always means something. Hierarchy comes
  from type and whitespace, not from fills and ornament.
- **Decoration:** minimal-intentional. The paper warmth, hairlines and the
  optional ambient scenes are the only decoration. No gradients on UI chrome,
  no colored card fills, no decorative stripes.
- **Mood:** you sit down at a cleared desk. The eye lands on the date, then on
  the single teal thing (what's next, or the running timer), then on the list.

### Three rules
1. **One sheet, one pen.** There is exactly one accent. It marks *now* and *you*:
   today, the current selection, a running timer, and the single primary action
   of a view.
2. **Color means state, not category.** The four tones appear only as small
   marks (a 6–8px dot, a 2px bar, or text color) and only when something needs
   attention. They never fill cards or columns. User-chosen project colors
   shrink to an 8px dot. At most three colored marks are visible at once,
   outside the user's own content.
3. **Serif where you write, sans where you operate.** Diary, notes and review
   bodies are set in serif. Tasks, calendar and settings use sans.

## Color
| role | token | light | dark |
|---|---|---|---|
| desk (app background) | `--paper-desk` = `--bg` | `#f6f5f2` | `#242320` |
| sheet (main panel) | `--paper-sheet` | `#fdfcfa` | `#282623` |
| raised (cards, menus) | `--paper-raised` = `--bg-elevated` | `#ffffff` | `#2d2b27` |
| sunken (inputs, wells, hover) | `--paper-sunken` | `#f0ede7` | `#211f1c` |
| rule / rule-strong | `--rule` / `--rule-strong` | `#e7e2d9` / `#d6d0c5` | `#3a3733` / `#4a4640` |
| ink 1: titles, body | `--ink-1` = `--text-primary` | `#3a3733` | `#f2f0ec` |
| ink 2: secondary, labels | `--ink-2` = `--text-secondary` | `#5e5a54` | `#c8c1b7` |
| ink 3: meta, timestamps (≥4.5:1) | `--ink-3` = `--text-tertiary` | `#77726b` | `#a39c91` |
| ink 4: placeholder, disabled | `--ink-4` | `#a8a298` | `#6f6a62` |
| accent (now / you) | `--accent` | `#1b4f4a` | `#7edbc7` |
| text on an accent fill | `--accent-ink` | `#ffffff` | `#0f2622` |
| vermilion: overdue, high, destructive | `--tone-urgent` | `#b5412c` | `#e58470` |
| ochre: due soon, medium, in progress | `--tone-warn` | `#9a6a17` | `#d9a950` |
| moss: done, achieved, streak | `--tone-done` | `#4f7a3a` | `#97bb7b` |
| indigo: scheduled, info, links | `--tone-info` | `#3d5a8c` | `#95add9` |

Each tone has a `-wash` for the rare tinted chip. No cool grays anywhere: use
the ink tokens, not Tailwind `slate/gray/zinc`, and never raw hex in features.

Mapping: priority high/medium/low → urgent/warn/ink-3; status todo/doing/
blocked/done → ink-3/warn/urgent/done.

- **Progress** (rings, bars) is ink (`--ink-2`), not accent: several share a screen.
- **Categories are not colors.** Activity kinds, focus modes, sound tracks, people
  groups and tags render in ink; user-chosen colors (projects, calendar
  subscriptions, habits, avatars) stay, as an 8px dot or a 2px bar.
- **Charts** may use a muted categorical palette for data series (donut
  segments, map routes). Never for chrome.

## Typography
- **Display:** Fraunces, with Noto Serif SC (bundled in `public/fonts`) for
  Chinese. Use it for page titles, dates, hero numbers and the timer.
- **UI:** Manrope. Chinese falls back to PingFang SC or Microsoft YaHei.
- **Reading:** Noto Serif SC / Fraunces at 16px, line-height 1.8, for diary,
  notes and review bodies.
- **Numerals:** use `tabular-nums` for anything that updates or aligns.
- **Scale** (px; `--fs-*` tokens and Tailwind `text-*` names):

  | px | token / class | use |
  |---|---|---|
  | 11 | `meta` | timestamps, counts. **12 in Chinese**: `--fs-meta` switches on `html[lang=zh]` |
  | 12 | `label` | labels, chips, captions |
  | 13 | `ui` | default UI text, buttons, menus |
  | 14 | `body` | row titles, body copy |
  | 16 | `section` | section heads, reading body |
  | 20 | `subhead` | card and panel titles (Fraunces) |
  | 30 | `title` | page titles (`--page-title-*`) |
  | 44 | `hero` | hero date, big stats |
  | 72 | `display` | focus timer |

- **Chinese text:** never below 12px. No letter-spacing and no uppercase
  transform on CJK. There are no monospace uppercase eyebrows. An eyebrow is
  `label` size, weight 600, `--ink-3`.

## Spacing, shape, elevation
- **Spacing:** 4px base: 4, 8, 12, 16, 24, 32, 48.
- **Radius** (`--radius-*`; Tailwind `rounded-xs/sm/md/lg/pill`):
  - 6 (`xs`): checkboxes, small marks;
  - 10 (`sm`): inputs, list rows, chips;
  - 14 (`md`): cards, menus, popovers;
  - 20 (`lg`): the main sheet, dialogs, drawers;
  - pill (`pill`): buttons, segmented controls, switches, avatars.
- **Elevation:** borders give structure, shadows give height, and the two are
  never both heavy.
  - flat: hairline border only.
  - `--elev-1`: resting cards.
  - `--elev-2`: menus, popovers, dragging.
  - `--elev-3`: dialogs and drawers.

## Components
- **Primary action:** `--cta-*`, an ink pill (inverse in dark). One per view.
  Repeats of the same action on a screen (for example in an empty state) use
  the secondary `--cta2-*` outline. The accent fill is reserved for present-tense
  actions like "Start focus".
- **Selection:** navigation uses an accent-wash pill with accent text.
  Segmented controls use the `--segmented-*` track with a raised thumb. There
  are no other selected styles.
- **Metadata:** cards show a single meta line in `--ink-3`, joined by `·`
  (`● 高 · 9月25日 · 0/10`). Only items that need action take a tone (an
  overdue date in vermilion). Don't stack chips.
- **Tags and chips:** 20px high, `rounded-sm`, `label` size, `--paper-sunken`
  fill, `--ink-2` text. A tone wash is used only for state.
- **Calendar events:** a neutral `--paper-sunken` chip with a 2px left bar in
  the source color. Uncolored tasks get a neutral bar. Today is a filled accent
  mark.
- **Active item in a list** (the open note or diary entry): a 2px accent bar.
- **Notices and toasts:** `--paper-sunken` or raised surface, with a 7px tone
  dot and a bold lead word.

## Motion vocabulary
| token | use |
|---|---|
| `--motion-duration-instant` 90ms | hover color, press-in |
| `--motion-duration-fast` 140ms | small state changes, exits |
| `--motion-duration-base` 200ms | default |
| `--motion-duration-medium` 280ms | overlays in, selection indicators |
| `--motion-duration-slow` 360ms | sheets, route enter |
| `--ease-standard` | state changes in place |
| `--ease-emphasized` | things arriving |
| `--ease-accelerate` | things leaving |
| `--ease-sheet` | drawers |
| `--ease-bounce` | small pops only |

Loops share `--motion-spin-duration` and `--motion-shimmer-duration`. In JS,
use `EASE`, `DURATION` and `SPRING` from `shared/motion/tokens`, never literal
bezier arrays or durations.

## Built-in behaviors (don't re-implement)
- **Press feedback** (`shared/motion/pressFeedback.ts`): controls sink on press
  and spring back. Opt out with `data-press="off"`. Don't add
  `:active { transform }` or hover `translateY` lifts to controls. Clickable
  cards may lift `-2px`.
- **Sliding selection** (`shared/motion/ActiveIndicator`): put it first inside
  any tab bar, segmented control or nav. Set `--indicator-*` on the container.
- **Route enter:** page roots fade up once when they mount
  (`shared/theme/page.css`).
- **Shell and overlay scale:** below 1920px wide the shell renders through
  `zoom: var(--shell-scale)`, which is 0.8 at ≤1512px (a 13–14" laptop) and
  reaches 1 at 1920px. Overlays portal to `<body>`, so AppShell publishes the
  same factor as `--overlay-scale` and `shared/theme/overlay-scale.css`
  applies it. For a new overlay:
  - use the shared Dialog, Drawer or Radix components, or add the
    `overlay-panel` class;
  - never zoom the element that floating-ui positions with pixel transforms;
  - divide `vh`/`px` caps of large panels by `--overlay-scale`.

  Otherwise dialogs render about 25% larger than the page and run off short
  screens.
- **Interaction layer** (`shared/theme/interaction.css`): color transitions,
  a visible `:focus-visible`, and themed native widgets and scrollbars.
- **Reduced motion:** the in-app switch and the OS setting both collapse
  motion.

## Page structure
- Route titles use `--page-title-*` or `.page-title`.
- The shell's main panel is the sheet, and it is the only full-page surface.
  Route roots stay transparent. A bleeding root uses
  `margin: calc(var(--route-pad) * -1)`.

## Checks before shipping UI
- Test light + dark, idle + an ambient scene, zh + en, at 1280 and 1920 wide.
- No text under 4.5:1 (disabled controls excepted). No light surfaces in dark.
- After editing `tailwind.config.ts`, restart the dev server.
- A new `text-*` size or `rounded-*` name must also be registered with
  tailwind-merge in `src/shared/lib/utils.ts`. Otherwise `cn()` reads it as a
  color and silently drops the real text color.
- Never pair `background: var(--ink-1)` with a hard-coded light text color. Use
  `--cta-bg` / `--cta-fg`, which invert correctly in dark.

## Decisions log
| Date | Decision | Rationale |
|---|---|---|
| 2026-09-26 | Motion vocabulary, press feedback, sliding selection, route enter | Unified ~40 durations and ~30 curves. |
| 2026-09-26 | Paper & Ink adopted as the single design language | Chosen via /design-consultation, which included research on Things 3, Craft, Sunsama, Amie, Linear and Notion Calendar, plus an independent proposal. The first impression is "quiet, focused paper workspace". It replaces six module sub-styles (newspaper, pastel, scrapbook, …). |
| 2026-09-26 | Serif reading bodies for diary, notes and review | "Write vs operate" is legible at a glance. The user approved it. |
| 2026-09-26 | Color = state; chip piles become a meta line | Calmer boards; action items stand out. The user approved it. |
| 2026-09-26 | Keep pill buttons | Softer, and consistent with shipped CTAs. The user chose it over 8px rects. |
| 2026-09-26 | Not adopted (for now): "Today page" dashboard, opaque sheet over scenes | The first is an IA change; the second would mute the ambient scenes. |
| 2026-09-26 | Rollout: module palettes (`--pj-*`, `--pd-*`, `--tj-*`, `--note-*`, `--fg-*`, habits, life, labs, admin, tiptap grays) mapped onto the core tokens; decorative glows removed (diary, habits, focus, labs) | One palette, both themes correct by construction; fixed several dark-mode light-on-light bugs. |
| 2026-09-26 | "Start focus" uses the accent fill; `--accent-action` (brown) folded into the CTA ink | Only present-tense actions take the pen. |
| 2026-09-26 | Overlays adopt the shell scale (`--overlay-scale`); life cards tightened; drawer's priority stripe removed | On a 14" laptop, dialogs and the task drawer rendered 25% larger than the page and cut off at the bottom. |
| 2026-09-27 | Timeline rows: ink icon, content-first title, one `·` meta line, actions on hover; runs of the same event fold into one row; the recap card is folded by default; "rebuild" is a toolbar icon | The feed started below the fold, rows were 95px with chip piles and category-colored marks. The user approved the density pass. |
| 2026-09-27 | Task views are named 卡片 (status-tab card grid) and 看板 (three columns); rows drag between 看板 columns to change status | The old labels were swapped relative to the content. The user approved it. |
| 2026-09-27 | ⌘K searches tasks, notes, diary and projects (title first, then body, open before closed) and opens the item in place | Replaces navigation-only ⌘K. The user approved it. |
