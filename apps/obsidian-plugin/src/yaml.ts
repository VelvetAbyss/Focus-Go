// A deliberately small YAML subset: flat scalar keys plus string lists.
//
// This is not a general YAML implementation and must not become one. It covers
// exactly what appears in our frontmatter and what Obsidian's own property
// editor writes back — which is the reason both list styles are supported:
//
//   tags: [work, deep]        <- what we emit
//   tags:                      <- what Obsidian rewrites it to
//     - work
//     - deep

export type YamlValue = string | number | boolean | null | string[]
export type YamlMap = Record<string, YamlValue>

const unquote = (raw: string): string => {
  const value = raw.trim()
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if (first === '"' && last === '"') {
      return value
        .slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
    }
    if (first === "'" && last === "'") return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

const parseScalar = (raw: string): YamlValue => {
  const value = raw.trim()
  if (value === '' || value === '~' || value === 'null') return null
  if (value === 'true') return true
  if (value === 'false') return false
  // Flow sequence: [a, b, "c, d"]
  if (value.startsWith('[') && value.endsWith(']')) {
    return splitFlowSequence(value.slice(1, -1))
  }
  return unquote(value)
}

/** Split on commas that are not inside quotes. */
const splitFlowSequence = (inner: string): string[] => {
  const items: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i]
    if (quote) {
      if (char === quote) quote = null
      current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === ',') {
      items.push(current)
      current = ''
      continue
    }
    current += char
  }
  items.push(current)
  return items.map((item) => unquote(item)).filter((item) => item !== '')
}

/**
 * Split a document into its frontmatter block and the body that follows.
 * Returns `frontmatter: null` when the document has none.
 */
export const splitFrontmatter = (content: string): { frontmatter: string | null; body: string } => {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) return { frontmatter: null, body: normalized }
  const end = normalized.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: null, body: normalized }
  const afterMarker = end + '\n---'.length
  // The closing marker must own its line.
  const rest = normalized.slice(afterMarker)
  if (rest !== '' && !rest.startsWith('\n')) return { frontmatter: null, body: normalized }
  return {
    frontmatter: normalized.slice('---\n'.length, end),
    body: rest.startsWith('\n') ? rest.slice(1) : rest,
  }
}

export const parseYamlMap = (source: string): YamlMap => {
  const result: YamlMap = {}
  const lines = source.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue

    const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match

    if (rawValue.trim() !== '') {
      result[key] = parseScalar(rawValue)
      continue
    }

    // Empty value: either the header of a block sequence, or a cleared scalar.
    // These mean different things downstream — `priority:` with nothing after it
    // is the user deliberately clearing the priority, not an absent key — so
    // look ahead for indented `- ` items instead of guessing.
    const items: string[] = []
    let j = i + 1
    for (; j < lines.length; j += 1) {
      const next = lines[j]
      if (next.trim() === '') continue
      const listItem = /^\s+-\s*(.*)$/.exec(next)
      if (!listItem) break
      const item = unquote(listItem[1])
      if (item !== '') items.push(item)
    }
    if (j > i + 1 && items.length > 0) {
      result[key] = items
      i = j - 1
      continue
    }
    result[key] = null
  }

  return result
}

/** True when the key appears in the frontmatter at all, whatever its value. */
export const hasKey = (map: YamlMap, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(map, key)

const needsQuoting = (value: string): boolean =>
  value === '' ||
  /^[\s]|[\s]$/.test(value) ||
  /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
  /: |#/.test(value) ||
  ['true', 'false', 'null', '~', 'yes', 'no', 'on', 'off'].includes(value.toLowerCase()) ||
  /^-?\d+(\.\d+)?$/.test(value)

export const quoteYamlString = (value: string): string => {
  if (!needsQuoting(value)) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

export const stringifyYamlMap = (map: YamlMap): string => {
  const lines: string[] = []
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((item) => quoteYamlString(item)).join(', ')}]`)
      continue
    }
    if (value === null) {
      lines.push(`${key}:`)
      continue
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`${key}: ${String(value)}`)
      continue
    }
    lines.push(`${key}: ${quoteYamlString(value)}`)
  }
  return lines.join('\n')
}

/** Read a key as a string, tolerating the parser's other scalar shapes. */
export const readString = (map: YamlMap, key: string): string | undefined => {
  const value = map[key]
  if (typeof value === 'string' && value !== '') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

export const readBoolean = (map: YamlMap, key: string): boolean | undefined => {
  const value = map[key]
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export const readStringList = (map: YamlMap, key: string): string[] | undefined => {
  const value = map[key]
  if (Array.isArray(value)) return value
  // A single unbracketed value is a common hand-edit: `tags: work`.
  if (typeof value === 'string' && value !== '') return [value]
  // Present but empty means the user cleared the list — distinct from absent,
  // which means "leave whatever the server has alone".
  if (value === null && hasKey(map, key)) return []
  return undefined
}
