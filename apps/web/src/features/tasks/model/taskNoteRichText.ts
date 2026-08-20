import type { JSONContent } from '@tiptap/core'
import type { TaskNoteBlock } from '../../../data/models/types'

type TaskNoteRichTextFields = {
  taskNoteBlocks?: TaskNoteBlock[] | null
  taskNoteContentJson?: Record<string, unknown> | null
  taskNoteContentMd?: string
}

const isTextNode = (node: JSONContent | null | undefined): node is JSONContent & { type: 'text'; text: string } =>
  node?.type === 'text' && typeof node.text === 'string'

const contentToMarkdown = (content: JSONContent[] | undefined): string => {
  if (!content?.length) return ''
  return content.map((node) => (isTextNode(node) ? node.text : node.type === 'hardBreak' ? '  \n' : '')).join('')
}

export const createTaskNoteDoc = (content: JSONContent[] = [{ type: 'paragraph' }]): JSONContent => ({
  type: 'doc',
  content,
})

const markdownToTaskNoteDoc = (markdown?: string) => {
  const source = typeof markdown === 'string' ? markdown : ''
  const normalized = source.replace(/\r\n/g, '\n')
  if (!normalized.trim()) return createTaskNoteDoc()
  const paragraphs = normalized.split(/\n{2,}/).map((block) => block.trimEnd())
  return createTaskNoteDoc(
    paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: paragraph
        ? paragraph.split('\n').flatMap((line, index, lines) => {
            const nodes: JSONContent[] = line ? [{ type: 'text', text: line }] : []
            if (index < lines.length - 1) nodes.push({ type: 'hardBreak' })
            return nodes
          })
        : [],
    })),
  )
}

export const taskNoteDocToMarkdown = (doc: JSONContent | null | undefined): string => {
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return ''

  return doc.content
    .map((node) => {
      if (node.type === 'paragraph') return contentToMarkdown(node.content)
      if (node.type === 'heading') {
        const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1
        return `${'#'.repeat(Math.max(1, Math.min(6, level)))} ${contentToMarkdown(node.content)}`
      }
      return ''
    })
    .join('\n\n')
    .trimEnd()
}

export const buildTaskNoteRichTextSnapshot = (blocks: TaskNoteBlock[]) => {
  const content = blocks.map((block) => ({ type: 'paragraph', content: block.text ? [{ type: 'text', text: block.text }] : [] }))
  const contentJson = createTaskNoteDoc(content.length ? content : [{ type: 'paragraph' }])
  return {
    contentJson,
    contentMd: taskNoteDocToMarkdown(contentJson),
  }
}

export const resolveTaskNoteRichText = (task: TaskNoteRichTextFields) => {
  if (task.taskNoteContentJson && (task.taskNoteContentJson as JSONContent).type === 'doc') {
    return {
      contentJson: task.taskNoteContentJson,
      contentMd: typeof task.taskNoteContentMd === 'string' ? task.taskNoteContentMd : '',
    }
  }

  if (typeof task.taskNoteContentMd === 'string' && task.taskNoteContentMd.trim().length > 0) {
    return {
      contentJson: markdownToTaskNoteDoc(task.taskNoteContentMd),
      contentMd: task.taskNoteContentMd,
    }
  }

  return buildTaskNoteRichTextSnapshot(Array.isArray(task.taskNoteBlocks) ? task.taskNoteBlocks : [])
}
