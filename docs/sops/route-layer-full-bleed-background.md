# Route Layer Full-Bleed Background SOP

## Problem

In pages rendered inside `AppShell`, a page-level background gradient or solid background may appear clipped, leaving a visible border around the page content.

This happens because `.focus-shell__route-layer` applies padding, and the page background only paints inside the page's own content box. The route-layer padding area still shows the shell background.

## Root Cause

`min-height: 100%` or `min-h-full` is not sufficient here because the real visual gap is usually not a height issue. The actual problem is that the page background does not bleed into the parent route-layer padding.

## Preferred Fix Pattern

When the problem is specifically "background does not visually reach the route edges", use a dedicated bleed background layer instead of relying on the layout box itself.

Apply the background to a pseudo-element on the page root wrapper:

1. Keep the page root at viewport-based height.
2. Make the page root `position: relative` and `isolation: isolate`.
3. Add `::before` as an absolute background layer.
4. Extend that background layer by `route-pad` on all sides with negative `inset`.

## Reference Implementation

Use this pattern on the page root class:

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
  background: linear-gradient(...);
  z-index: -1;
}
```

Then keep content above the background layer:

```tsx
<section className="page-shell">
  <div className="page-shell__content">...</div>
</section>
```

```css
.page-shell__content {
  position: relative;
  z-index: 1;
}
```

## Legacy Fix Pattern

If the entire page layout itself must bleed outward, not just the background, use the older width + negative margin pattern:

```css
.page-shell {
  width: calc(100% + (var(--route-pad, 16px) * 2));
  margin: calc(var(--route-pad, 16px) * -1);
  min-height: calc(100vh - (var(--page-pad, 14px) * 2));
}
```

## When To Use

Use this SOP when:

1. A page-level background should visually fill the whole route container.
2. You see a white or shell-colored border around a custom page background.
3. The page lives inside `AppShell` / `.focus-shell__route-layer`.

## When Not To Use

Do not use this pattern when:

1. The page is supposed to preserve the default route padding visually.
2. Only an inner card/panel should have background styling.
3. The layout intentionally relies on inset spacing from the shell background.

## Existing Examples

1. `apps/web/src/features/diary/review/review.css`
2. `apps/web/src/features/habits/habits.css`
3. `apps/web/src/styles.css` for `.rss-design`

## Verification Checklist

After applying the fix, verify:

1. No shell-colored border is visible around the page background.
2. The background reaches the route container edges on all sides.
3. Inner content alignment still looks correct after the negative margin.
4. Mobile layout still behaves correctly.

## Common Failure Mode

Do not subtract `route-pad` again inside `min-height`.

Reason:

1. `route-pad` is already being handled by the negative margin bleed.
2. If you subtract it again in height math, the page background becomes too short.
3. The symptom is usually a visible strip at the bottom even though left and right edges look fixed.

## Default Rule

If a future page inside `AppShell` shows a clipped page-level background, use the pseudo-element bleed layer first. Only use width + negative margin when the layout itself must bleed, not just the background.
