/**
 * Snap a numeric font size (px) onto the Paper & Ink type scale
 * (apps/web/DESIGN.md). Inline-style helpers pass numbers; this keeps them on
 * the same nine steps as CSS — and lets `--fs-meta` lift to 12px in Chinese.
 */
export const scaleFontSize = (px: number): string | number => {
  if (px <= 11.2) return 'var(--fs-meta)'
  if (px <= 12.6) return 'var(--fs-label)'
  if (px <= 13.6) return 'var(--fs-ui)'
  if (px <= 15.2) return 'var(--fs-body)'
  if (px <= 17.6) return 'var(--fs-section)'
  if (px <= 22.5) return 'var(--fs-subhead)'
  return px
}
