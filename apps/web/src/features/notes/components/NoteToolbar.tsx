import { useEffect, useRef, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { useI18n } from '../../../shared/i18n/useI18n'

/** Roving focus is scoped to the toolbar, never to its portaled forms/menus. */
export const NoteToolbar = ({ editor, children }: { editor: Editor | null; children: ReactNode }) => {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const refresh = () => {
      const controls = Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        .filter(button => button.getClientRects().length)
      const current = controls.find(button => button === document.activeElement) ?? controls.find(button => button.tabIndex === 0) ?? controls[0]
      controls.forEach(button => { button.tabIndex = button === current ? 0 : -1 })
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] })
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} role="toolbar" aria-label={t('notes.toolbar.label')} data-variant="fixed" className="tiptap-toolbar note-editor__toolbar-inline"
    onMouseDown={event => { if (event.currentTarget.contains(event.target as Node) && (event.target as Element).closest('button')) event.preventDefault() }}
    onFocus={event => {
      const focused = (event.target as Element).closest<HTMLButtonElement>('button')
      if (!focused || !event.currentTarget.contains(focused)) return
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.tabIndex = button === focused ? 0 : -1 })
    }}
    onKeyDown={event => {
      if (!event.currentTarget.contains(event.target as Node) || event.nativeEvent.isComposing) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); editor?.commands.focus(); return }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(button => button.getClientRects().length)
      const index = controls.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length
      controls[next]?.focus()
    }}>{children}</div>
}
