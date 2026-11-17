# Adaptive Focus and Life dashboards

Focus and Life use a viewport-sized overview. The route does not scroll; a widget detail sheet owns its content scrolling. Other dashboard views retain their existing behavior.

`fitDashboardLayout` computes display-only geometry from saved positions. Wide desktops retain their relative layout after removing vertical gaps. Narrow/short canvases, or a desktop layout that would create a target smaller than 44 CSS pixels, use the compact overview. Never persist these computed rectangles to either layout repository.

`AdaptiveDashboardGrid` chooses a full card or an overview from each profile in `widgetCatalog`. The card remains mounted once inside a stable portal host. Moving that host between the inline slot and the detail sheet preserves drafts, timers and requests. Zero-sized observations while the layout editor is visible must not unmount the widgets. Layout editing still uses the existing grid and persistence paths.

Each widget reports its current presentation through `useWidgetSummary` in `widgetPresentation`. This reads existing component state; it must not trigger a second request, initialize duplicate data, or expose unrevealed results. When adding a registered widget, provide its title, icon, minimum full-card dimensions and a useful summary. Keep the primary action available in the expanded component.

Phone and tablet views use bottom navigation and touch-sized overview entries. Phone details occupy the viewport. Life master/detail editors stack vertically on narrow screens. The original hanging-note stack becomes a compact toolbar entry without changing saved notes.

## Verification

- Unit/component tests: `npm run test --workspace @focus-go/web -- src/features/dashboard`
- Production build smoke tests: `npm run build:web` then `npm run test:smoke --workspace @focus-go/web`
- Adaptive integration tests: start the web dev server on port 5416, then run `node node_modules/@playwright/test/cli.js test --config apps/web/playwright.adaptive.config.ts` from the repository root.

The adaptive suite uses isolated browser storage and synthetic data. It enables all 13 Focus and 9 Life widgets, measures 16 portrait/landscape viewport sizes, checks all detail sheets at three sizes, and verifies draft preservation, nested dialogs, mobile task creation and note editing. It also compares saved layouts before/after resizing. This browser simulation does not replace physical iOS/Android device testing.
