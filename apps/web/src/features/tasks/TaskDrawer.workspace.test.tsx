// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TaskDrawer from './TaskDrawer'
import type { TaskItem } from './tasks.types'

const mocks = vi.hoisted(() => ({ update: vi.fn(), push: vi.fn() }))
vi.mock('../../data/repositories/tasksRepo', () => ({ tasksRepo: { update: mocks.update } }))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'en', t: (key: string) => key }) }))
vi.mock('../../shared/ui/toast/toast', () => ({ useToast: () => ({ push: mocks.push }) }))
vi.mock('../auth/AuthGateContext', () => ({ useAuthGate: () => ({ isGated: false, requireAuth: vi.fn() }) }))
vi.mock('../premium/PremiumProvider', () => ({ usePremiumGate: () => ({ canUse: () => true, openUpgradeModal: vi.fn() }) }))
vi.mock('./application/useTaskDeletion', () => ({ useTaskDeletion: () => vi.fn() }))
vi.mock('./components/TaskNotesPanel', () => ({ default: () => <section data-testid="task-notes">Notes</section> }))
vi.mock('./components/TaskProgressCard', () => ({ default: () => <section>Progress</section> }))
vi.mock('./components/TaskAttachmentsSection', () => ({ default: () => <section>Attachments</section> }))
vi.mock('./components/TaskProjectAssignCard', () => ({ default: () => <section data-testid="task-project">Project</section> }))
const baseTask: TaskItem = {
  id: 'task-document', title: 'Prepare certification reply', description: 'Confirm the model scope',
  createdAt: Date.now(), updatedAt: Date.now(), status: 'todo', priority: null,
  pinned: false, isToday: false, tags: [], subtasks: [], taskNoteBlocks: [], activityLogs: [],
}
beforeEach(() => { localStorage.clear(); mocks.update.mockReset(); mocks.update.mockImplementation(async task => task) })
afterEach(cleanup)

describe('Task execution document', () => {
  it('places execution content in the wide pane and planning in the inspector', async () => {
    render(<TaskDrawer open task={baseTask} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByPlaceholderText('tasks.drawer.title')
    expect(screen.getByTestId('task-notes').closest('.task-detail-pane--left')).toBeInTheDocument()
    expect(screen.getByTestId('task-project').closest('.task-detail-pane--right')).toBeInTheDocument()
    expect(document.querySelector<HTMLElement>('.task-detail-layout')?.style.gridTemplateColumns).toContain('0.7fr')
  })
  it('saves an edited title when closing the document', async () => {
    const onClose = vi.fn(), onUpdated = vi.fn()
    render(<TaskDrawer open task={baseTask} onClose={onClose} onUpdated={onUpdated} onDeleted={vi.fn()} />)
    const input = await screen.findByPlaceholderText('tasks.drawer.title')
    fireEvent.change(input, { target: { value: 'Send verified certification reply' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Send verified certification reply' })))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ title: 'Send verified certification reply' }))
  })
  it('persists edits immediately and keeps the latest edit while a local write is pending', async () => {
    let finishFirst!: (task: TaskItem) => void
    mocks.update.mockImplementationOnce(() => new Promise<TaskItem>(resolve => { finishFirst = resolve }))
    render(<TaskDrawer open task={baseTask} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />)
    const input = await screen.findByPlaceholderText('tasks.drawer.title')
    fireEvent.change(input, { target: { value: 'First edit' } })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'First edit' }))
    fireEvent.change(input, { target: { value: 'Latest edit' } })
    expect(input).toHaveValue('Latest edit')
    finishFirst({ ...baseTask, title: 'First edit' })
    await waitFor(() => expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Latest edit' })))
  })
  it('keeps direct metadata edits when typing continues during a pending save', async () => {
    let finishFirst!: (task: TaskItem) => void
    mocks.update.mockImplementationOnce(() => new Promise<TaskItem>(resolve => { finishFirst = resolve }))
    const waitingTask: TaskItem = { ...baseTask, status: 'waiting', waitingOn: 'Buyer' }
    render(<TaskDrawer open task={waitingTask} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />)
    const title = await screen.findByPlaceholderText('tasks.drawer.title')
    fireEvent.change(title, { target: { value: 'First edit' } })
    const waiting = screen.getByLabelText('tasks.drawer.waitingOn')
    fireEvent.change(waiting, { target: { value: 'Supplier' } })
    fireEvent.blur(waiting)
    fireEvent.change(title, { target: { value: 'Latest edit' } })
    finishFirst({ ...waitingTask, title: 'First edit' })
    await waitFor(() => expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Latest edit', waitingOn: 'Supplier' })))
  })
  it('labels a waiting task date as follow-up rather than a deadline', async () => {
    render(<TaskDrawer open task={{ ...baseTask, status: 'waiting', waitingOn: 'Buyer confirmation' }} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />)
    expect(await screen.findByText('tasks.workspace.followUp')).toBeInTheDocument()
    expect(screen.queryByText('tasks.drawer.dueDate')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Buyer confirmation')).toBeInTheDocument()
  })
})
