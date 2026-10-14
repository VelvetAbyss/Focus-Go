import { Bell, Clock, ListTodo, Quote, Type, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Code } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { NoteCommandId } from '../model/noteCommands'

const icons = { task: ListTodo, waiting: Clock, reminder: Bell, quote: Quote, paragraph: Type, heading1: Heading1, heading2: Heading2, heading3: Heading3, bulletList: List, orderedList: ListOrdered, taskList: ListChecks, codeBlock: Code }
const labels = {
  task: 'notes.command.task', waiting: 'notes.command.waiting', reminder: 'notes.command.reminder', quote: 'notes.command.quote',
  paragraph: 'notes.block.paragraph', heading1: 'notes.headingDropdown.h1', heading2: 'notes.headingDropdown.h2', heading3: 'notes.headingDropdown.h3',
  bulletList: 'notes.block.bulletList', orderedList: 'notes.block.orderedList', taskList: 'notes.block.taskList', codeBlock: 'notes.block.codeBlock',
} as const

export const NoteCommandMenu = ({ commands, activeIndex, left, top, menuId, onChoose }: {
  commands: Array<{ id: NoteCommandId }>
  activeIndex: number
  left: number
  top: number
  menuId: string
  onChoose: (id: NoteCommandId) => void
}) => {
  const { t } = useI18n()
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    menuRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])
  return (
    <div ref={menuRef} id={menuId} className="note-command-menu" role="listbox" aria-label={t('notes.command.label')} style={{ left, top }}>
      {commands.length ? commands.map(({ id }, index) => {
        const Icon = icons[id]
        return <button
          type="button" key={id} role="option" aria-selected={index === activeIndex}
          id={`${menuId}-${id}`}
          className="note-command-menu__option" data-active={index === activeIndex || undefined}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onChoose(id)}
        ><Icon size={16} /><span>{t(labels[id])}</span></button>
      }) : <div className="note-command-menu__empty">{t('notes.command.empty')}</div>}
      <div className="note-command-menu__hint">{t('notes.command.hint')}</div>
    </div>
  )
}
