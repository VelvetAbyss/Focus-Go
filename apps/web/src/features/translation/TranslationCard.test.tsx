// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render as renderEditor, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TranslationCard from './TranslationCard'
import { translateOnline } from './online'
import { installPacks, readyPacks, translateOffline } from './offline'

const render = (node: React.ReactNode) => renderEditor(<MemoryRouter>{node}</MemoryRouter>)

vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'zh' }) }))
vi.mock('./online', () => ({ translateOnline: vi.fn() }))
vi.mock('./offline', () => ({ readyPacks: vi.fn(), installPacks: vi.fn(), removePack: vi.fn(), translateOffline: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(readyPacks).mockResolvedValue([])
  vi.mocked(translateOnline).mockResolvedValue('请确认交货日期。')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})
afterEach(() => vi.clearAllMocks())

describe('Dashboard translation card', () => {
  it('waits for an explicit click and shows the online destination before sending', async () => {
    render(<TranslationCard />)
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: 'Please confirm the delivery date.' } })
    expect(translateOnline).not.toHaveBeenCalled()
    expect(screen.getByText(/发送至 MyMemory/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '翻译' }))
    await waitFor(() => expect((screen.getByLabelText('译文') as HTMLTextAreaElement).value).toBe('请确认交货日期。'))
    expect(translateOnline).toHaveBeenCalledTimes(1)
  })

  it('aborts stale translations on editing and discards late results', async () => {
    let resolve!: (value: string) => void
    vi.mocked(translateOnline).mockReturnValue(new Promise(done => { resolve = done }))
    render(<TranslationCard />)
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: '翻译' }))
    const signal = vi.mocked(translateOnline).mock.calls[0][3]
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: 'New text' } })
    expect(signal.aborted).toBe(true)
    resolve('stale result')
    await waitFor(() => expect((screen.getByLabelText('译文') as HTMLTextAreaElement).value).toBe(''))
  })

  it('does not translate or download automatically in offline mode', async () => {
    render(<TranslationCard />)
    fireEvent.click(screen.getByRole('button', { name: '离线' }))
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: 'Hello' } })
    await waitFor(() => expect(screen.getByRole('button', { name: '翻译' }).hasAttribute('disabled')).toBe(true))
    expect(screen.getByText(/所选语向尚缺/)).toBeTruthy()
    expect(installPacks).not.toHaveBeenCalled()
    expect(translateOffline).not.toHaveBeenCalled()
    expect(translateOnline).not.toHaveBeenCalled()
  })

  it('uses the local engine when the language pack is ready', async () => {
    vi.mocked(readyPacks).mockResolvedValue(['en-zh'])
    vi.mocked(translateOffline).mockResolvedValue('你好。')
    render(<TranslationCard />)
    fireEvent.click(screen.getByRole('button', { name: '离线' }))
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: 'Hello.' } })
    await waitFor(() => expect(screen.getByRole('button', { name: '翻译' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '翻译' }))
    await waitFor(() => expect((screen.getByLabelText('译文') as HTMLTextAreaElement).value).toBe('你好。'))
    expect(translateOnline).not.toHaveBeenCalled()
  })

  it('does not save the source or translation into preferences', async () => {
    render(<TranslationCard />)
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: 'Confidential draft' } })
    await waitFor(() => expect(localStorage.getItem('focusgo.translation.preferences')).toBeTruthy())
    expect(localStorage.getItem('focusgo.translation.preferences')).not.toContain('Confidential')
  })

  it('keeps the draft when expanding and closing an accessible workspace', async () => {
    render(<TranslationCard />)
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: 'My draft' } })
    fireEvent.click(screen.getByRole('button', { name: '展开翻译' }))
    expect(await screen.findByRole('dialog', { name: '翻译' })).toBeTruthy()
    expect((screen.getByLabelText('原文') as HTMLTextAreaElement).value).toBe('My draft')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((screen.getByLabelText('原文') as HTMLTextAreaElement).value).toBe('My draft')
  })
})
