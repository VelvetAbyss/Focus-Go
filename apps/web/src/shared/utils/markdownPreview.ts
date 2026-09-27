/**
 * One-line plain-text preview of markdown, for list cards.
 *
 * Stored excerpts are often already collapsed to one line, so block markers
 * (`## `, `- `, `1. `, `> `, `[ ]`) are stripped wherever they follow whitespace,
 * not only at line starts. Pass `title` to drop a leading heading that repeats it.
 */
export const markdownToPreview = (text: string, title?: string): string => {
  let out = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    .replace(/(^|\s)>\s*/g, '$1')
    .replace(/(^|\s)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/g, '$1')
    .replace(/(^|\s)\[[ xX]\]\s+/g, '$1')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/gs, '$1$2')
    .replace(/~~(.+?)~~/gs, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  const heading = title?.trim()
  if (heading && out.startsWith(heading)) out = out.slice(heading.length).trim()
  return out
}
