---
name: route-layer-full-bleed-background
description: Use when a page inside AppShell shows a clipped gradient or background, with shell-colored borders or bottom strips caused by route-layer padding, inset layout backgrounds, or incomplete full-bleed rendering.
---

# Route Layer Full Bleed Background

## Overview

Use this when a page-level background should visually fill the full route container, but a light border or bottom strip remains visible inside `AppShell`.

Root cause is usually not height alone. In this shell, `.focus-shell__route-layer` adds padding, so a background painted on the page content box often fails to cover the padded edge area.

## Default Fix

Prefer a dedicated bleed background layer on the page root instead of relying on the layout box itself.

```css
.page-shell {
  position: relative;
  isolation: isolate;
  min-height: calc(100vh - (var(--page-pad, 14px) * 2));
}

.page-shell::before {
  content: '';
  position: absolute;
  inset: calc(var(--route-pad, 16px) * -1);
  background: linear-gradient(180deg, #fff 0%, #fcfcfb 40%, #faf8f4 100%);
  z-index: -1;
}

.page-shell__content {
  position: relative;
  z-index: 1;
}
```

```tsx
<section className="page-shell">
  <div className="page-shell__content">...</div>
</section>
```

## Investigation Order

1. Confirm the page is rendered inside `AppShell` / `.focus-shell__route-layer`.
2. Check whether the unwanted strip matches the shell background rather than the page background.
3. If yes, treat it as a route-layer bleed problem before trying more height tweaks.
4. If left/right edges are fixed but the bottom still leaks, verify that `route-pad` is not being subtracted again in the page `min-height`.

## Preferred Decision Rule

Use the pseudo-element bleed layer when:

1. Only the background needs to bleed.
2. The content layout should stay aligned to the normal route padding.
3. The bug appears as a thin edge, corner, or bottom strip.

Use width + negative margin only when:

1. The full page layout itself must bleed outward.
2. Background and content both intentionally extend into the route padding area.

## Common Failure Modes

Do not use `min-h-full` as the primary fix here.

Do not subtract `route-pad` inside `min-height` when you already bleed the background outward. That causes the page to become too short and leaves a bottom strip visible.

Do not keep the background directly on the layout wrapper if shell padding, border radius, or overflow clipping are involved. Split background and content into separate layers.

## Verification

After the fix:

1. Check top, bottom, left, and right edges for shell-colored leaks.
2. Check rounded corners and clipped regions.
3. Verify desktop and mobile.
4. If the strip remains, inspect whether another ancestor is drawing a visible background above the page layer.
