export const pushContextTrail = (history: string[], nextId: string, maxSize = 8): string[] => {
  const deduped = history.filter((id) => id !== nextId)
  const next = [...deduped, nextId]
  if (next.length <= maxSize) return next
  return next.slice(next.length - maxSize)
}
