import type { TaskNoteBlock, TaskNoteParagraphBlock } from '../../../data/models/types'
import { createId } from '../../../shared/utils/ids'

export const createTaskNoteParagraph = (text = ''): TaskNoteParagraphBlock => ({
  id: createId(),
  type: 'paragraph',
  text,
})

const normalizeParagraphBlock = (raw: unknown): TaskNoteParagraphBlock | null => {
  if (!raw || typeof raw !== 'object') return null
  const block = raw as Partial<TaskNoteParagraphBlock>
  if (block.type !== 'paragraph') return null
  return {
    id: typeof block.id === 'string' && block.id ? block.id : createId(),
    type: 'paragraph',
    text: typeof block.text === 'string' ? block.text : '',
  }
}

export const normalizeTaskNoteBlocks = (raw: unknown, legacyText?: unknown): TaskNoteBlock[] => {
  const next = Array.isArray(raw) ? raw.map((item) => normalizeParagraphBlock(item)).filter((item): item is TaskNoteParagraphBlock => Boolean(item)) : []
  if (next.length > 0) return next
  if (typeof legacyText === 'string') return [createTaskNoteParagraph(legacyText)]
  return [createTaskNoteParagraph()]
}

export const cloneTaskNoteBlocks = (blocks: TaskNoteBlock[]) => blocks.map((block) => ({ ...block }))

export const areTaskNoteBlocksEqual = (left: TaskNoteBlock[], right: TaskNoteBlock[]) => {
  if (left.length !== right.length) return false
  return left.every((block, index) => block.id === right[index]?.id && block.type === right[index]?.type && block.text === right[index]?.text)
}
