// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'en' }) }))
vi.mock('../life/lifeI18n', () => ({ useLifeI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../hooks/use-is-breakpoint', () => ({ useIsBreakpoint: () => false }))
vi.mock('react-grid-layout', () => ({ GridLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, useContainerWidth: () => ({ width: 1200, containerRef: { current: null }, mounted: true }) }))
vi.mock('./registry', () => ({ getDashboardCards: () => [{ id: 'tasks', title: 'Tasks', pageScope: 'main', defaultSize: { w: 4, h: 4 }, render: () => <div>Task data</div> }], getLifeCards: () => [{ id: 'library', title: 'Books', pageScope: 'life', defaultSize: { w: 10, h: 8 }, render: () => <div>Book data</div> }] }))
import CustomDashboard from './CustomDashboard'
const view = { id: 'one', name: 'Work', items: [{ key: 'tasks', x: 0, y: 0, w: 4, h: 4 }] }
const props = () => ({ view, views: [view], isNew: false, onSave: vi.fn(), onCopy: vi.fn(), onDelete: vi.fn(), onCancel: vi.fn(), onDirtyChange: vi.fn() })
afterEach(cleanup)
it('mixes Focus and Life widgets and only saves after explicit save', () => {
  const callbacks = props(); render(<CustomDashboard {...callbacks} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit view' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add Books' }))
  expect(screen.getByText('Book data')).toBeInTheDocument()
  expect(callbacks.onSave).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox', { name: 'View name' }), { target: { value: 'Reading' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save view' }))
  expect(callbacks.onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Reading', items: [view.items[0], { key: 'library', x: 4, y: 0, w: 5, h: 8 }] }))
})
it('cancel restores the saved layout, including a removed final widget', () => {
  const callbacks = props(); render(<CustomDashboard {...callbacks} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit view' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove Tasks' })[0])
  expect(screen.queryByText('Task data')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByText('Task data')).toBeInTheDocument()
  expect(callbacks.onSave).not.toHaveBeenCalled()
})
it('retains the editor and draft if storage fails', () => {
  const callbacks = props(); callbacks.onSave.mockImplementation(() => { throw new Error('Quota') })
  render(<CustomDashboard {...callbacks} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit view' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save view' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
  expect(screen.getByRole('textbox', { name: 'View name' })).toBeInTheDocument()
})
it('requires confirmation before deleting a view', () => {
  const callbacks = props(); render(<CustomDashboard {...callbacks} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete view' }))
  expect(callbacks.onDelete).not.toHaveBeenCalled()
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete view' })[1])
  expect(callbacks.onDelete).toHaveBeenCalledOnce()
})
