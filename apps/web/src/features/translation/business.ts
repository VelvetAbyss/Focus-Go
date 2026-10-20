export type BusinessSuggestion = { before: string; after: string; reason: [string, string] }

/** Conservative, reviewable English style rules. Never paraphrase quantities, dates or product names. */
export function businessSuggestions(text: string): BusinessSuggestion[] {
  const suggestions: BusinessSuggestion[] = []
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim()
    const match = /^Please (send|confirm|provide|review|share|check)( .+?)[.!]?$/u.exec(trimmed)
    if (match) {
      const body = match[2].replace(/[.!]$/u, '')
      // Only a single declarative request; don't put an entire multi-sentence paragraph into a question.
      if (!/[!?]|\.(?:\s|$)/u.test(body) && !suggestions.some(suggestion => suggestion.before === trimmed)) {
        suggestions.push({
          before: trimmed, after: `Could you please ${match[1]}${body}?`,
          reason: ['将请求改为更礼貌的问句', 'Make the request more courteous'],
        })
      }
    }
  }
  const contractions: [RegExp, string][] = [
    [/\bWe can't\b/gu, 'We cannot'], [/\bI can't\b/gu, 'I cannot'],
    [/\bWe don't\b/gu, 'We do not'], [/\bI don't\b/gu, 'I do not'],
    [/\bWe're\b/gu, 'We are'], [/\bI'm\b/gu, 'I am'],
  ]
  for (const [pattern, expanded] of contractions) {
    for (const match of text.matchAll(pattern)) {
      if (suggestions.some(suggestion => suggestion.before === match[0])) continue
      suggestions.push({ before: match[0], after: expanded, reason: ['展开缩写，表达更正式', 'Use the formal expanded form'] })
    }
  }
  return suggestions
}
