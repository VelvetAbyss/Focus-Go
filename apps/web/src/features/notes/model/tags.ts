const INVALID_TAG_CHAR_RE = /[^\p{L}\p{N}_-]/gu
const HASH_TAG_RE = /(?:^|[\s([{])#([\p{L}\p{N}_-]{1,32})/gu

export const normalizeTag = (raw: string) => raw.trim().replace(/^#+/, '').replace(INVALID_TAG_CHAR_RE, '').slice(0, 32)

const tagKey = (tag: string) => normalizeTag(tag).toLocaleLowerCase()

export const extractHashTagsFromMarkdown = (contentMd: string) => {
  const found: string[] = []
  const seen = new Set<string>()

  for (const match of contentMd.matchAll(HASH_TAG_RE)) {
    const normalized = normalizeTag(match[1] ?? '')
    if (!normalized) continue
    const key = tagKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    found.push(normalized)
  }

  return found
}

export const mergeTags = (manualTags: string[], autoTags: string[]) => {
  const merged: string[] = []
  const seen = new Set<string>()

  for (const tag of [...manualTags, ...autoTags]) {
    const normalized = normalizeTag(tag)
    if (!normalized) continue
    const key = tagKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(normalized)
  }

  return merged
}
