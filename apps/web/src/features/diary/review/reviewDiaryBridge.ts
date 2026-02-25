import type { ReviewAnswers } from './reviewSessionStore'

const REVIEW_BLOCK_START_PREFIX = '<!-- REVIEW_BLOCK_START '
const REVIEW_BLOCK_END = '<!-- REVIEW_BLOCK_END -->'

const REVIEW_BLOCK_PATTERN =
  /<!-- REVIEW_BLOCK_START ([\s\S]*?) -->\n([\s\S]*?)\n<!-- REVIEW_BLOCK_END -->/g

export type ReviewSubmitPayload = {
  inboxCount?: string
  inboxCleared?: boolean
  focusScore?: string
  reflectionNote?: string
  mustDo1?: string
  mustDo2?: string
  mustDo3?: string
  submittedAt: number
}

export type ParsedReviewBlock = {
  version: number
  submittedAt: number
  raw: string
  summary: {
    focusScore?: string
    reflectionPreview: string
  }
}

const cleanLine = (value: string | undefined) => (value ?? '').trim()

const buildReflectionPreview = (value: string) => {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > 100 ? `${compact.slice(0, 100)}...` : compact
}

export const buildSubmitPayload = (answers: ReviewAnswers, submittedAt = Date.now()): ReviewSubmitPayload => ({
  inboxCount: typeof answers.inboxCount === 'string' ? answers.inboxCount : undefined,
  inboxCleared: answers.inboxCleared === true,
  focusScore: typeof answers.focusScore === 'string' ? answers.focusScore : undefined,
  reflectionNote: typeof answers.reflectionNote === 'string' ? answers.reflectionNote : undefined,
  mustDo1: typeof answers.mustDo1 === 'string' ? answers.mustDo1 : undefined,
  mustDo2: typeof answers.mustDo2 === 'string' ? answers.mustDo2 : undefined,
  mustDo3: typeof answers.mustDo3 === 'string' ? answers.mustDo3 : undefined,
  submittedAt,
})

export const serializeReviewBlock = (payload: ReviewSubmitPayload): string => {
  const metadata = JSON.stringify({
    version: 1,
    submittedAt: payload.submittedAt,
  })

  const lines = [
    `- Inbox Count: ${cleanLine(payload.inboxCount)}`,
    `- Inbox Cleared: ${payload.inboxCleared === true}`,
    `- Focus Score: ${cleanLine(payload.focusScore)}`,
    `- Must Do 1: ${cleanLine(payload.mustDo1)}`,
    `- Must Do 2: ${cleanLine(payload.mustDo2)}`,
    `- Must Do 3: ${cleanLine(payload.mustDo3)}`,
  ]

  const reflection = cleanLine(payload.reflectionNote)

  return [
    `${REVIEW_BLOCK_START_PREFIX}${metadata} -->`,
    '## Review Snapshot',
    ...lines,
    '',
    '### Reflection',
    reflection,
    REVIEW_BLOCK_END,
  ].join('\n')
}

export const appendReviewBlock = (contentMd: string, payload: ReviewSubmitPayload): string => {
  const block = serializeReviewBlock(payload)
  const trimmed = contentMd.trim()
  if (!trimmed) return block
  return `${trimmed}\n\n${block}`
}

export const hasReviewBlock = (contentMd: string): boolean =>
  contentMd.includes(REVIEW_BLOCK_START_PREFIX) && contentMd.includes(REVIEW_BLOCK_END)

const extractFocusScoreFromBody = (body: string): string | undefined => {
  const focusLine = body.match(/^- Focus Score:\s*(.*)$/m)
  const score = focusLine?.[1]?.trim()
  return score ? score : undefined
}

const extractReflectionFromBody = (body: string): string => {
  const reflectionMatch = body.match(/### Reflection\s*\n([\s\S]*)/)
  return reflectionMatch?.[1]?.trim() ?? ''
}

export const extractReviewBlocks = (contentMd: string): ParsedReviewBlock[] => {
  const blocks: ParsedReviewBlock[] = []
  REVIEW_BLOCK_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = REVIEW_BLOCK_PATTERN.exec(contentMd)) !== null) {
    const metadataRaw = match[1]?.trim()
    const bodyRaw = match[2]?.trim() ?? ''

    try {
      const metadata = JSON.parse(metadataRaw) as { version?: number; submittedAt?: number }
      const version = typeof metadata.version === 'number' ? metadata.version : 1
      if (typeof metadata.submittedAt !== 'number') continue
      const submittedAt = metadata.submittedAt

      const reflection = extractReflectionFromBody(bodyRaw)
      const focusScore = extractFocusScoreFromBody(bodyRaw)

      blocks.push({
        version,
        submittedAt,
        raw: match[0],
        summary: {
          focusScore,
          reflectionPreview: buildReflectionPreview(reflection),
        },
      })
    } catch {
      continue
    }
  }

  return blocks.sort((a, b) => b.submittedAt - a.submittedAt)
}
