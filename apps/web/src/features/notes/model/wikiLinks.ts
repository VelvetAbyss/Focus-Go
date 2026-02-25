export type WikiLinkTrigger = {
  start: number
  end: number
  query: string
}

export const detectWikiLinkTrigger = (value: string, caret: number): WikiLinkTrigger | null => {
  const safeCaret = Math.max(0, Math.min(caret, value.length))
  const openIndex = value.lastIndexOf('[[', safeCaret)
  if (openIndex < 0) return null

  const lastCloseIndex = value.lastIndexOf(']]', safeCaret)
  if (lastCloseIndex > openIndex) return null

  const rawQuery = value.slice(openIndex + 2, safeCaret)
  if (rawQuery.includes('[') || rawQuery.includes(']') || rawQuery.includes('\n')) return null

  return {
    start: openIndex,
    end: safeCaret,
    query: rawQuery,
  }
}

export const applyWikiLinkSelection = (value: string, trigger: WikiLinkTrigger, title: string): { value: string; caret: number } => {
  const replacement = `[[${title}]]`
  const nextValue = `${value.slice(0, trigger.start)}${replacement}${value.slice(trigger.end)}`
  const caret = trigger.start + replacement.length
  return { value: nextValue, caret }
}

export const filterWikiSuggestions = (titles: string[], query: string, limit = 8): string[] => {
  const q = query.trim().toLowerCase()
  const ranked = titles
    .filter((title) => (q ? title.toLowerCase().includes(q) : true))
    .sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q)
      const bStarts = b.toLowerCase().startsWith(q)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return a.localeCompare(b)
    })
  return ranked.slice(0, limit)
}
