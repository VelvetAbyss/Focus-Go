import { Extension } from '@tiptap/core'
import type { NoteBlockType } from './noteBlocks'
import type { EditorState } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export type NoteTaskIntent = 'task' | 'waiting' | 'reminder'
export type NoteCommandId = NoteTaskIntent | NoteBlockType
export type NoteCommandContext = { from: number; to: number; query: string }

export const NOTE_COMMANDS: Array<{ id: NoteCommandId; keywords: string }> = [
  { id: 'task', keywords: 'task todo 任务 待办' },
  { id: 'waiting', keywords: 'waiting followup 等待 跟进' },
  { id: 'reminder', keywords: 'reminder remind 提醒' },
  { id: 'quote', keywords: 'quote blockquote 引用' },
  { id: 'paragraph', keywords: 'paragraph text 正文 段落' },
  { id: 'heading1', keywords: 'heading1 h1 一级标题 标题1' },
  { id: 'heading2', keywords: 'heading2 h2 二级标题 标题2' },
  { id: 'heading3', keywords: 'heading3 h3 三级标题 标题3' },
  { id: 'bulletList', keywords: 'bullet list 无序列表 项目符号' },
  { id: 'orderedList', keywords: 'ordered numbered 有序列表 编号' },
  { id: 'taskList', keywords: 'check checklist 勾选清单' },
  { id: 'codeBlock', keywords: 'code 代码' },
]

export const matchNoteCommands = (query: string, allowTasks = true) => {
  const needle = query.trim().toLowerCase()
  return NOTE_COMMANDS.filter((command) => (allowTasks || !['task', 'waiting', 'reminder'].includes(command.id)) && command.keywords.includes(needle))
}

export const findNoteCommand = (state: EditorState): NoteCommandContext | null => {
  const { selection } = state
  if (!selection.empty || !selection.$from.parent.isTextblock || selection.$from.parent.type.spec.code) return null
  const before = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\ufffc', '\ufffc')
  // Only a leading slash in a text block is a command; URLs and prose keep normal input.
  const match = /^\/([\p{L}\p{N}-]{0,24})$/u.exec(before)
  return match ? { from: selection.$from.start(), to: selection.from, query: match[1] } : null
}

type CommandState = { context: NoteCommandContext | null; dismissedAt: number | null }
export const noteCommandKey = new PluginKey<CommandState>('focusgoNoteCommands')

export const NoteCommands = Extension.create<{
  onContext: (context: NoteCommandContext | null) => void
  onKey: (event: KeyboardEvent, context: NoteCommandContext) => boolean
}>({
  name: 'focusgoNoteCommands',
  addOptions: () => ({ onContext: () => {}, onKey: () => false }),
  addProseMirrorPlugins() {
    const { onContext, onKey } = this.options
    return [new Plugin<CommandState>({
      key: noteCommandKey,
      state: {
        init: (_, state) => ({ context: findNoteCommand(state), dismissedAt: null }),
        apply: (transaction, previous, _, next) => {
          const context = findNoteCommand(next)
          const dismissedAt = transaction.getMeta(noteCommandKey) === 'dismiss'
            ? context?.from ?? null
            : context?.from === previous.dismissedAt ? previous.dismissedAt : null
          return { context, dismissedAt }
        },
      },
      props: {
        handleKeyDown: (view, event) => {
          if (view.composing || event.isComposing || event.keyCode === 229) return false
          const state = noteCommandKey.getState(view.state)
          if (!state?.context || state.dismissedAt === state.context.from) return false
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            view.dispatch(view.state.tr.setMeta(noteCommandKey, 'dismiss'))
            return true
          }
          return onKey(event, state.context)
        },
        handleDOMEvents: {
          compositionstart: () => { onContext(null); return false },
          compositionend: (view) => {
            queueMicrotask(() => {
              if (view.isDestroyed) return
              const state = noteCommandKey.getState(view.state)
              onContext(!view.composing && view.hasFocus() && state?.context && state.dismissedAt !== state.context.from ? state.context : null)
            })
            return false
          },
          blur: () => { onContext(null); return false },
        },
      },
      view: () => ({
        update: (view) => {
          const state = noteCommandKey.getState(view.state)
          onContext(!view.composing && view.hasFocus() && state?.context && state.dismissedAt !== state.context.from ? state.context : null)
        },
        destroy: () => onContext(null),
      }),
    })]
  },
})
