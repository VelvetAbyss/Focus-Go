---
# gstack: design-md-format=spec
name: "Focus&go · 纸与墨 · 批注本 (Paper & Ink: Marginalia)"
description: "A quiet paper desk where plans are written in pencil, records in ink, and one teal pen marks what is happening now."
colors:
  desk: "#ffffff"
  surface: "#fdfcfa"
  raised: "#ffffff"
  sunken: "#f0ede7"
  rule: "#e7e2d9"
  rule-strong: "#d6d0c5"
  text: "#3a3733"
  text-secondary: "#5e5a54"
  text-muted: "#77726b"
  placeholder: "#a8a298"
  pencil: "#6f6a63"
  pencil-line: "#948e84"
  primary: "#1b4f4a"
  on-primary: "#ffffff"
  cta: "#3a3733"
  on-cta: "#fdfcfa"
  error: "#b5412c"
  warning: "#9a6a17"
  success: "#4f7a3a"
  info: "#3d5a8c"
  dark-desk: "#242320"
  dark-surface: "#282623"
  dark-raised: "#2d2b27"
  dark-sunken: "#211f1c"
  dark-rule: "#3a3733"
  dark-rule-strong: "#4a4640"
  dark-text: "#f2f0ec"
  dark-text-secondary: "#c8c1b7"
  dark-text-muted: "#a39c91"
  dark-placeholder: "#6f6a62"
  dark-pencil: "#9d968a"
  dark-pencil-line: "#8a847a"
  dark-primary: "#7edbc7"
  dark-on-primary: "#0f2622"
  dark-cta: "#f2f0ec"
  dark-on-cta: "#242320"
  dark-error: "#e58470"
  dark-warning: "#d9a950"
  dark-success: "#97bb7b"
  dark-info: "#95add9"
typography:
  display:
    fontFamily: Instrument Serif
    fontWeight: 400
    fontSize: 30px
    letterSpacing: -0.01em
  display-zh:
    fontFamily: Noto Serif SC
    fontWeight: 600
    fontSize: 30px
  numeral:
    fontFamily: Source Serif 4
    fontWeight: 300
    fontSize: 72px
    fontFeature: tnum, lnum
  reading:
    fontFamily: Source Serif 4, Noto Serif SC
    fontSize: 16px
    lineHeight: 1.8
  body:
    fontFamily: Manrope, PingFang SC, Microsoft YaHei
    fontSize: 14px
    lineHeight: 1.55
  label:
    fontFamily: Manrope, PingFang SC, Microsoft YaHei
    fontWeight: 600
    fontSize: 12px
    letterSpacing: 0
rounded:
  xs: 6px
  sm: 10px
  md: 14px
  lg: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.on-cta}"
    rounded: "{rounded.full}"
  button-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  button-secondary:
    borderColor: "{colors.rule-strong}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.sunken}"
    borderColor: "{colors.rule}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.md}"
  chip:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
  chip-planned:
    borderColor: "{colors.pencil-line}"
    textColor: "{colors.pencil}"
    rounded: "{rounded.sm}"
  checkbox-open:
    borderColor: "{colors.pencil-line}"
  checkbox-done:
    backgroundColor: "{colors.text}"
---

# Design System — Focus&go · 纸与墨 · 批注本 (Paper & Ink: Marginalia)

Always read this before a visual or UI change. Tokens live in
`src/shared/theme/tokens.css`; the JS mirror for motion/react is
`src/shared/motion/tokens.ts`. The approved preview (2026-09-28) is kept in
the gstack design folder (`designs/design-system-20260928/preview.html`).

## Overview

**Creative North Star:** a quiet white paper desk where every detail feels
handcrafted (安静的纸面，处处有手艺感). Plans are written in pencil, records in
ink, and one teal pen marks what is happening now.

The default light backdrop is solid white, with no grain or gradient. The
sidebar is a quiet gray (`#f1f3f1`), the work canvas is a recessed near-white
(`#f7f8f7`), and content cards are white with fine `#e0e4e1` edges and short
contact shadows. The distinct surface values carry the depth; shadows only
reinforce the boundaries. Ambient scenes remain available when selected; dark
mode keeps its charcoal desk.

**Product context:** an all-in-one personal productivity workspace (tasks,
projects, calendar, notes, diary, focus timer, habits, trips, timeline and
life widgets) for individuals who keep it open for hours on 13–14" laptops and
desktops (1280–1920px). Bilingual, Chinese first. A desktop-first web app,
also shipped as Tauri builds for macOS and Windows.

**Mode per surface:**
- Operate: tasks, calendar, projects, settings. Sans, grid, dense.
- Read: notes, diary, review. Serif body, a wide measure.
- Experience: the focus timer and the ambient scenes. Big numerals, very little else.

**Reference sites (2026-09-28 research):**
- https://culturedcode.com/things/features/
- https://streaksapp.com/
- https://dayoneapp.com/
- https://structured.app/
- https://bear.app/

**Key characteristics:**
- The eye lands on the date, then on the single teal thing (now), then on the list.
- You can tell what is done from what is only planned without any color: ink against pencil.
- Numbers look set in type: the timer, stats and dates.
- Surfaces lie flat on the desk; nothing floats unless it is a menu or dialog.
- Color is rare and always means something.

### Three hands (the state language)
1. **Pencil is intention.** It covers open checkboxes (dashed circles), goals
   and targets (dashed outlines), scheduled and future items (dashed chips,
   pencil text for times and dates not yet reached) and placeholders. Pencil
   is a mark, not a voice: `--pencil-line` draws lines only, and `--pencil`
   (5.2:1) is the only pencil text color.
2. **Ink is record.** It covers checked boxes (filled ink), strike-throughs on
   done items, actual values (filled bars), past events and habit days that
   happened. Titles of open items stay ink so they read; the pencil goes on
   their marks.
3. **The pen is now.** One accent marks *now* and *you*: today, the current
   selection, a running timer, the current time slot and the single primary
   action of a view.

### Three rules
1. **One sheet, one pen.** There is exactly one accent (see the pen above).
2. **Color means state, not category.** The four tones appear only as small
   marks (a 6–8px dot, a 2px bar or text color), and only when something needs
   attention. They never fill cards or columns. User-chosen project colors
   shrink to an 8px dot. At most three colored marks are visible at once,
   outside the user's own content.
3. **Serif where you write, sans where you operate.** Diary, notes and review
   bodies are set in serif. Tasks, calendar and settings use sans.

## Colors

**Strategy:** Restrained. The paper and ink ramps, one pen and four tones, plus
two pencil tokens. State is carried by the hand (pencil, ink, pen) before any
hue.

**Light or dark:** light by default, because the product is used for long
daytime desk sessions. Evening use gets a full dark theme that keeps the same
hierarchy: surfaces step up in lightness, the ink ramp inverts, and shadows
become rules.

| role | token | light | dark |
|---|---|---|---|
| desk (shell background) | `--shell-page-bg` / `--paper-desk` | `#ffffff` | `#242320` |
| work canvas (idle main panel) | `.focus-shell__main` | `#f7f8f7` | `#282623` |
| sheet (other paper surfaces) | `--paper-sheet` | `#fdfcfa` | `#282623` |
| raised (cards, menus) | `--paper-raised` = `--bg-elevated` | `#ffffff` | `#2d2b27` |
| sunken (inputs, wells, hover) | `--paper-sunken` | `#f0ede7` | `#211f1c` |
| rule / rule-strong | `--rule` / `--rule-strong` | `#e7e2d9` / `#d6d0c5` | `#3a3733` / `#4a4640` |
| ink 1: titles, body | `--ink-1` = `--text-primary` | `#3a3733` | `#f2f0ec` |
| ink 2: secondary, labels | `--ink-2` = `--text-secondary` | `#5e5a54` | `#c8c1b7` |
| ink 3: meta, timestamps (≥4.5:1) | `--ink-3` = `--text-tertiary` | `#77726b` | `#a39c91` |
| ink 4: placeholder, disabled | `--ink-4` | `#a8a298` | `#6f6a62` |
| pencil text (planned dates/times) | `--pencil` | `#6f6a63` (5.23:1 on sheet) | `#9d968a` (4.82:1 on raised) |
| pencil line (marks only) | `--pencil-line` | `#948e84` (3.17:1 on sheet) | `#8a847a` (4.07:1 on sheet) |
| pen (now / you) | `--accent` | `#1b4f4a` | `#7edbc7` |
| text on a pen fill | `--accent-ink` | `#ffffff` | `#0f2622` |
| vermilion: overdue, high, destructive | `--tone-urgent` | `#b5412c` | `#e58470` |
| ochre: due soon, medium, in progress | `--tone-warn` | `#9a6a17` | `#d9a950` |
| moss: done, achieved, streak | `--tone-done` | `#4f7a3a` | `#97bb7b` |
| indigo: scheduled, info, links | `--tone-info` | `#3d5a8c` | `#95add9` |

Each tone has a `-wash` for the rare tinted chip. No cool grays anywhere: use
the ink and pencil tokens, not Tailwind `slate/gray/zinc`, and never raw hex in
features. `--pencil-line` sits on the sheet or raised surfaces (on the desk it
drops to 2.98:1), and never colors text.

Mapping: priority high/medium/low → urgent/warn/ink-3; status todo/doing/
blocked/done → pencil mark/warn/urgent/ink mark.

- **Progress** (rings, bars) is ink (`--ink-2`), and the goal is a pencil
  outline. Today's value is the pen.
- **Categories are not colors.** Activity kinds, focus modes, sound tracks,
  people groups and tags render in ink. User-chosen colors (projects, calendar
  subscriptions, habits, avatars) stay, as an 8px dot or a 2px bar.
- **Charts** may use a muted categorical palette for true data series (donut
  segments, map routes). Never for chrome.

## Typography

**Source world:** books, notebooks and set type. **Faces** (all SIL OFL 1.1,
verified 2026-09-28, all self-hosted because Google Fonts is unreliable in
mainland China):

- **Display, Latin:** Instrument Serif 400, upright only. Page titles, the
  wordmark and Latin dates. It replaces Fraunces, which gstack now flags as an
  overused display face.
- **Display, Chinese:** Noto Serif SC 600 (bundled). Page titles and dates in zh.
- **Numerals:** Source Serif 4 (weight 300, optical size 60) with
  `font-variant-numeric: tabular-nums lining-nums`. Used for the focus timer,
  the hero date number and big stats. Tabular figures keep a ticking timer
  still.
- **Reading:** Source Serif 4 with Noto Serif SC at 16px, line-height 1.8, for
  diary, notes and review bodies. Source Serif is the Latin sibling of Source
  Han Serif (= Noto Serif SC), so mixed text shares one voice.
- **UI:** Manrope, falling back to PingFang SC (macOS) and Microsoft YaHei
  (Windows).
- **Mono:** not part of the system. Code blocks keep the platform monospace.

Loading: woff2 in `public/fonts` (built by `scripts/subset-fonts.py`),
Latin-subset for Instrument Serif and Source Serif 4 (variable wght + opsz,
core OpenType features only, ~370 KB), `font-display: swap`. Instrument Serif
is declared for weights 100–900 so titles never get a faked bold, and drawn at
`size-adjust: 110%` because it is condensed next to CJK and Manrope. Size
measures in `em`, not `ch`: `ch` follows the width of "0", which differs by 40%
between these serifs. Fraunces was removed on 2026-09-28.

**Scale** (px; `--fs-*` tokens and Tailwind `text-*` names):

| px | token / class | use |
|---|---|---|
| 11 | `meta` | timestamps, counts. **12 in Chinese**: `--fs-meta` switches on `html[lang=zh]` |
| 12 | `label` | labels, chips, captions |
| 13 | `ui` | default UI text, buttons, menus |
| 14 | `body` | row titles, body copy |
| 16 | `section` | section heads, reading body |
| 20 | `subhead` | card and panel titles (Noto Serif SC / Instrument Serif) |
| 30 | `title` | page titles (`--page-title-*`) |
| 44 | `hero` | hero date, big stats (Source Serif 4 numerals) |
| 72 | `display` | focus timer (Source Serif 4 numerals) |

- **Chinese text:** never below 12px. No letter-spacing and no uppercase
  transform on CJK. No monospace uppercase eyebrows. An eyebrow is `label`
  size, weight 600, `--ink-3`.
- **Weights are hundreds only** (400/500/600/700). Manrope is variable, but the
  Chinese fallbacks are not: PingFang SC tops out at 600 and Microsoft YaHei
  jumps from 400 to 700, so a 550 title renders Latin at 550 and Chinese at
  600 (700 on Windows).
- **No italic display.** Emphasis is weight or size.

## Layout

- Operate surfaces keep a disciplined grid: the shell sidebar, a main sheet,
  cards and rows on a 4px rhythm.
- Editorial moments break the grid on purpose, and only here: the dashboard
  date header, the weekly recap and diary entries. They use large numerals, an
  asymmetric date line and a wide measure.
- Read surfaces cap the measure at about 720px, with generous side margins.
- Empty states are centered in their container: the drawing, the line and the sentence stack on one axis.
- The shell zooms below 1920px (see Built-in behaviors).

## Elevation & Depth

Borders give structure, shadows give height, and the two are never both heavy.
Paper lies on the desk: shadows are short and tight.

- **flat:** hairline border only.
- **`--elev-1` (resting cards):** a contact shadow, `0 1px 0 var(--rule), 0 2px
  6px rgba(58,55,51,.06)`.
- **`--elev-2` (menus, popovers, dragging):** `0 1px 0 var(--rule), 0 10px 28px
  -12px rgba(58,55,51,.22)`.
- **`--elev-3` (dialogs, drawers):** unchanged.
- **Dark:** no drop shadows. Elevation is a 1px rule (`--rule`, or
  `--rule-strong` for menus) on a lighter surface.
- **Paper grain:** a static fractal-noise tile at about 5% (7% dark) on the
  desk only. Sheets and cards stay smooth. No zero-offset glows anywhere.

## Shapes

- **Radius** (`--radius-*`; Tailwind `rounded-xs/sm/md/lg/pill`):
  - 6 (`xs`): checkboxes, small marks;
  - 10 (`sm`): inputs, list rows, chips;
  - 14 (`md`): cards, menus, popovers;
  - 20 (`lg`): the main sheet, dialogs, drawers;
  - pill (`pill`): buttons, segmented controls, switches, avatars.
- A nested element's radius is the outer radius minus the gap.
- Pencil shapes are dashed (1.5px, 4/4); ink shapes are solid.

## Components

- **Primary action:** `--cta-*`, an ink pill (inverse in dark). One per view.
  Repeats of the same action on a screen (for example in an empty state) use
  the secondary `--cta2-*` outline. The pen fill is reserved for present-tense
  actions like "Start focus".
- **Selection:** navigation uses a pen-wash pill with pen text. Segmented
  controls use the `--segmented-*` track with a raised thumb. There are no
  other selected styles.
- **Metadata:** cards show a single meta line in `--ink-3`, joined by `·`
  (`● 高 · 9月25日 · 0/10`). Dates not yet reached may be pencil; only items
  that need action take a tone (an overdue date in vermilion). Don't stack chips.
- **Checkboxes:** open is a dashed pencil circle; done is a filled ink circle
  with a paper-colored check, and the title gets an ink strike-through and
  `--ink-3`. In progress is a solid ochre ring with a centre dot. Use
  `shared/ui/InkMark` (`state="todo|doing|done"`) for task marks; the to-do and
  subtask checkboxes (`.widget-plan-checkbox-*`) are restyled to match in
  `shared/theme/marks.css`. Status tokens: `--status-todo` = pencil line,
  `--status-done` = ink.
- **Tags and chips:** 20px high, `rounded-sm`, `label` size, `--paper-sunken`
  fill, `--ink-2` text. A planned chip (scheduled, future) is a dashed pencil
  outline with pencil text. A tone wash is used only for state.
- **Calendar events:** past and current events are a neutral `--paper-sunken`
  chip with a 2px left bar in the source color. Future scheduled blocks are
  dashed pencil outlines. Uncolored tasks get a neutral bar. Today is a filled
  pen mark.
- **Timelines (day, activity):** a dashed pencil spine. Past nodes are filled
  ink, the current node is the pen with a wash ring, and future nodes are
  dashed pencil.
- **Charts:** actual values are ink fills (`--ink-2`), goals are dashed pencil
  outlines and today is the pen. No gridlines, one baseline in
  `--rule-strong`, and values labeled on the marks. Use the `--chart-*`
  tokens in `shared/theme/charts.css`. A falling trend is not an alarm: it
  stays ink; a rise may be moss.
- **Habit history:** a done day is an ink dot, a missed day is bare paper (a
  hairline ring), a future day is a pencil ring, and today is the pen.
- **Empty states:** centered. One serif line (`subhead`), one sentence
  of help and one action. Illustrations must be licensed or commissioned
  assets, recolored to pencil. Open Doodles (CC0) is the interim source; a
  commissioned set of single-line desk objects replaces it. Never CSS-shape
  or generated illustrations. Use `DiscoveryEmptyState` (`illustration` prop)
  or `shared/ui/Doodle`. Art goes where there is room: 112px tall on a page,
  72–96px in a roomy card or view. Tight panels (fixed-height cards, drawers,
  trash lists, per-source cards) keep the line and sentence only. Each place
  gets its own drawing; the SVGs are cropped to their ink, so a drawing sits
  centered with no offset. A hint with no destination is plain text, not a
  link.
- **Completion jar** (the weekly recap's brief week view): one ink bead per task
  finished that week, in an open glass jar, beside a plank of earlier weeks'
  sealed jars (paper lid, twine). It is a record, never a goal: no capacity
  line, no count on the jar, no streak, nothing resets. Each jar is sized to
  its beads, so every sealed jar is full and a light week is a small jar, not
  a half-empty one. Beads are ink in both themes (deep ink-jade in light, warm
  pearl in dark), never project colours. A bead drops in only when a task is
  ticked on screen a moment ago; synced or background completions simply
  appear. The scene draws on demand (nothing runs at rest), and a flat SVG of
  the same packing stands in without WebGL.
- **Active item in a list** (the open note or diary entry): a 2px pen bar.
- **Notices and toasts:** `--paper-sunken` or raised surface, with a 7px tone
  dot and a bold lead word.
- **Icons:** Lucide at a single 1.5px stroke with round caps, in ink. No
  filled or colored icon tiles.

## Do's and Don'ts

- Do: mark intention in pencil and record in ink, so a finished day reads darker and calmer.
- Do: set big numbers (the timer, stats, the hero date) in Source Serif 4 tabular numerals.
- Do: keep resting surfaces flat with contact shadows, and use rules instead of shadows in dark.
- Do: label chart values directly, and draw goals as pencil outlines.
- Do: center empty states, with one drawing, one line, one sentence and one action.
- Don't: write text in `--pencil-line`, or put pencil lines on the desk background.
- Don't: turn open task titles pencil gray; titles stay ink.
- Don't: add a second accent, colored card fills, per-category colors or glossy icon tiles.
- Don't: use italic display type, gradient text, glows, or cards inside cards.
- Don't: ship placeholder illustrations or draw them from CSS shapes.

## Motion

- **Approach:** intentional. The vocabulary below is unchanged.
- **Easing:** enter uses `--ease-emphasized`; exit uses `--ease-accelerate`;
  in-place changes use `--ease-standard`.
- **Duration:** micro 90ms, short 140–200ms, medium 280ms, long 360ms.
- **The one authored moment:** completing a task turns pencil to ink. The
  dashed circle becomes a filled ink check, and the title takes an ink
  strike-through, on the standard 200ms state transition. Stroke-drawing
  animation was considered and declined (2026-09-28).

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
- Pencil check: no text uses `--pencil-line`; pencil lines don't sit on the
  desk color; open titles are ink.
- New fonts are self-hosted; nothing loads from Google Fonts at runtime.
- After editing `tailwind.config.ts`, restart the dev server.
- A new `text-*` size or `rounded-*` name must also be registered with
  tailwind-merge in `src/shared/lib/utils.ts`. Otherwise `cn()` reads it as a
  color and silently drops the real text color.
- Never pair `background: var(--ink-1)` with a hard-coded light text color. Use
  `--cta-bg` / `--cta-fg`, which invert correctly in dark.
- A class built at runtime (`foo--${state}`) must not be styled inside
  `styles.css`: most of that file sits in `@layer base`, and Tailwind drops
  layered rules whose class never appears literally in the source. Put such
  rules in a feature stylesheet or an unlayered theme file (`marks.css`).

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
| 2026-09-28 | Paper & Ink evolves into 批注本 (Marginalia): pencil = intention, ink = record, pen = now | Focus&go's core loop is plan vs record; the memorable thing is "安静的纸面，处处有手艺感". The pencil/ink idea came from an independent Claude subagent voice (Codex unavailable). The user approved the direction and chose this risk. |
| 2026-09-28 | Type: Instrument Serif for the Latin display (replaces Fraunces); Source Serif 4 for numerals (tabular) and the reading Latin; Manrope kept for UI | Fraunces is now flagged as an overused display face; the timer needs tabular figures; Source Serif pairs with Source Han Serif / Noto Serif SC. All OFL, self-hosted. |
| 2026-09-28 | Contact shadows for resting cards, rules instead of shadows in dark, paper grain on the desk only | Paper lies flat; depth without floating cards. |
| 2026-09-28 | Charts, habit history and timelines use pencil for goals and future, ink for actuals and past, and the pen for today; no gridlines | State is readable without new colors. |
| 2026-09-28 | Empty states are top-left aligned, with licensed illustrations only (Open Doodles CC0 interim, commissioned set later) | "Centered everything" and placeholder art read as template work. |
| 2026-09-28 | Declined for now: 正-tally counts, handwritten margin notes (LXGW WenKai), stroke-drawing motion, a tapered-pen selection underline, IBM Plex Mono | The user chose only the pencil/ink risk; the rest stay out until asked. |
| 2026-09-28 | DESIGN.md converted to the design.md spec format (front-matter tokens); legacy copy kept as `.legacy.bak` | Lets gstack design tools read the tokens directly. The user approved the conversion. |
| 2026-09-28 | Rollout phase 1: fonts self-hosted (Fraunces removed), numerals in Source Serif 4, contact shadows, desk grain | Approved after a before/after review. |
| 2026-09-28 | Rollout phase 2: `InkMark` for task marks; to-do/subtask checkboxes, calendar chips after today, diary and activity timelines in pencil/ink; user-content titles (projects, trips, task and person names, in-document headings) use the reading serif | Instrument Serif has no bold, so mixed CJK/Latin user titles paired bold CJK with thin Latin. |
| 2026-09-28 | Rollout phase 3: charts and habit history in the three hands; chart tokens in `shared/theme/charts.css` (`--chart-actual/goal/today/baseline`); habit colours shrink to the 2px bar | The focus week chart gained the daily goal as a pencil outline; the task analytics lost its gridlines and a hard-coded "今" badge that showed in English too. |
| 2026-09-28 | Rollout phase 4: empty states top-left with `DiscoveryEmptyState`/`Doodle`; six Open Doodles (CC0) split into pencil line + wash masks in `public/illustrations`; CSS-drawn marks, icon tiles and repeated primary buttons removed | Page-level empties (tasks, habits, diary, notes, projects, timeline) get a drawing; small panels get the line and sentence only. |
| 2026-09-28 | Rollout phase 5 (verification): 6-combo route matrix (zh/en, light/dark, 1280/1512/1920, stormy scene), no page errors; bare `h3`/`h4` UI labels that inherited the display face below 16px moved to sans (`font-body`) | Instrument Serif under 16px reads thin; operate surfaces are sans by rule 3. |
| 2026-09-28 | Dashboard fixes: the tasks widget has no opaque inner fill and its task cards share the card surface (hairline + contact shadow); the recap card's period/stepper/density controls stay on one row (icon-only "back to this week", English density labels Brief/Full) | Under an ambient scene the cards are frosted glass (~#fbfaf8); the widget's `bg-background` and white task cards showed as #ffffff blocks. The user asked for one row. |
| 2026-09-28 | Font weights snapped to hundreds (53 declarations: 450/530→500, 550–660→600, 720–760→700); the note list title is 600 with no tracking | Mixed titles like "Impeccable Skills 指令" rendered the Chinese heavier than the Latin. |
| 2026-09-28 | Task cards have a fixed anatomy: a title box that always reserves two lines, then one footer line (state left, joined by `·`; the project as an 8px dot + name on the right). Hover swaps the footer to the action row in place; pending subtasks and blockers open in a portaled peek after a 400ms rest. The recap card's control row is centred | Cards were 3 heights in one grid (the project sat on a second row, collapsed hover panels still took gap space, and a legacy `nowrap` defeated the two-line clamp); hovering grew the card and pushed the grid. The user asked for equal heights and a centred recap row. |
| 2026-09-28 | Weather card is an Experience surface: a live three.js sky (phase from sunrise/sunset, moon phase, two cloud layers, fog, instanced rain, snow/hail, scheduled lightning) behind a left scrim; the reading layer is a big numeral temperature, one `·` meta line (体感 · 湿度 · 风, or 降水% for later days), the next sun event and frosted day tabs. Colors stay in sRGB display space; the dark theme deepens day skies multiplicatively and leaves night skies alone | The old card was a flat gradient with the same icon in every state. Sky art is content, not chrome, so it may use colour beyond the three hands; the text layer still follows them. The user asked for a full redo of the weather effects. |
| 2026-09-28 | World clock: a dotted-land globe (Natural Earth 110m, ISC) with a real terminator drawn as a dashed pencil line, ink pins and the home pin in pen; each city row gets a daylight strip on the viewer's 0–24h axis (night/twilight/golden/day from sun elevation, work hours as a pencil dash, now in pen). The analog dial is removed | A clock list says what time it is; the strips say whether it's a good time to call. The pencil/ink/pen hands carry over unchanged. |
| 2026-09-28 | The four ambient scenes (雨天咖啡馆, 暴风雨之夜, 海风, 壁炉暖意) are rebuilt in three.js with the old 2D canvas scene as fallback; three.js loads lazily per scene (shared chunk). Rules: render scale 0.7 under the glass blur, a fresh canvas per scene switch (a canvas can't change context type), no rebuild on resize/theme/wake (`resize`/`setTheme` instead), reduced motion draws one settled still with random events skipped | The user asked for a full redo in three.js with performance deferred. The blur hides the lower resolution; rebuilding GL contexts on every resize leaked contexts. |
| 2026-09-28 | Dashboard header, date first, two voices: the date is the only display type (Source Serif 4 light at `hero`; 月/日 at half size in Noto Serif SC 400; the English month in Source Serif too, not Instrument Serif, so the date is one face). Everything else about the day is one sans line on the date's baseline: weekday · lunar day · festival or solar term · the time in the pen, minutes only. The quote sits below in the reading serif, source the same size in tertiary; "another quote" shows on hover. The header's left edge lines up with the cards | "The eye lands on the date, then on the pen." The first pass mixed three faces, four weights and five sizes on four baselines; the user found it messy. The old header led with a ticking seconds clock and went stale past midnight. |
| 2026-09-28 | Quotes: a bundled library of 132 lines (64 Chinese, 68 international), each in both languages with a checked source; one per day, the same in either language, Chinese and international alternating. Remote quote feeds removed | The Chinese pack had 10 lines (one a love poem, one misattributed) and the English one pulled random quotes from GitHub, often unreachable in mainland China. The user asked for genuinely motivating lines from home and abroad. |
| 2026-09-29 | Empty-state art, second pass: all drawings cropped to their ink and drawn at a shared height (flush left, 14px to the title, no per-page offsets); nine more Open Doodles (CC0) placed one per state: tasks Today (plant), task analytics (roller-skating), focus history (levitate), project timeline (swinging), trips (strolling), 404 (unboxing), error fallback (clumsy, replacing the CSS-drawn ring and cross), dashboard checklist (sitting), spend (ice-cream). The checklist, project timeline and 404 moved from centered to top-left | The user liked the tasks and diary drawings and asked for them in more places. The first set drifted: a uniform 4:3 frame left each drawing a different margin, so some sat small and far from their title. The Life people card was tried and left without art: its fixed height pushed the add button out of view. |
| 2026-09-29 | Empty states are centered (supersedes the 2026-09-28 top-left rule): drawing, serif line, sentence and action on one axis; bounded panes (dashboard checklist, notes editor, diary pane, 404) also center vertically | The user found the top-left drawings looked unaligned in narrow cards and asked for them centered. The ink-cropped drawings center cleanly because each has an even margin. |
| 2026-09-29 | Completion jar replaces the per-project list in the weekly recap's brief week view (Full and Month keep the list); the recap's three numbers become one caption row there. Beads come from task activity logs, one per task per week, so past weeks are on the shelf from day one | The user's most frequent action is ticking tasks, and a ticked task left nothing behind. Research on streaks and progress bars says the unfilled state is what hurts, so the jar has no goal and no fixed size. The user chose the direction, the shelf, content-sized jars and the ink-jade-in-glass material. |
