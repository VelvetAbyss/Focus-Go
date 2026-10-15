import type { CSSProperties } from 'react'

/** Semantic UI roles. Values live in tokens/typography.css; display numbers
 * and user-authored documents keep their own content typography. */
export const typography = {
  page: { fontFamily: 'var(--font-body)', fontSize: 'var(--page-title-size)', fontWeight: 600, lineHeight: 'var(--page-title-leading)', letterSpacing: 'normal' },
  section: { fontFamily: 'var(--font-body)', fontSize: 'var(--type-section-size)', fontWeight: 600, lineHeight: 'var(--type-ui-leading)', letterSpacing: 'normal' },
  record: { fontFamily: 'var(--font-body)', fontSize: 'var(--fs-body)', fontWeight: 500, lineHeight: 'var(--leading-reading)', letterSpacing: 'normal' },
  body: { fontFamily: 'var(--font-body)', fontSize: 'var(--fs-body)', fontWeight: 400, lineHeight: 'var(--leading-reading)', letterSpacing: 'normal' },
  label: { fontFamily: 'var(--font-body)', fontSize: 'var(--fs-label)', fontWeight: 500, lineHeight: 'var(--type-ui-leading)', letterSpacing: 'normal' },
  meta: { fontFamily: 'var(--font-body)', fontSize: 'var(--fs-meta)', fontWeight: 400, lineHeight: 'var(--type-ui-leading)', letterSpacing: 'normal' },
  input: { fontFamily: 'var(--font-body)', fontSize: 'var(--type-input-size)', fontWeight: 400, lineHeight: 'var(--type-ui-leading)', letterSpacing: 'normal' },
  control: { fontFamily: 'var(--font-body)', fontSize: 'var(--fs-ui)', fontWeight: 500, lineHeight: 'var(--type-ui-leading)', letterSpacing: 'normal' },
  compact: { fontFamily: 'var(--font-body)', fontSize: 'var(--fs-label)', fontWeight: 500, lineHeight: 'var(--type-ui-leading)', letterSpacing: 'normal' },
} satisfies Record<string, CSSProperties>
