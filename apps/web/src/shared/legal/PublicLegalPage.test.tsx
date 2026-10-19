// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PublicLegalPage from './PublicLegalPage'
vi.mock('../i18n/useI18n', () => ({ useI18n: () => ({ language: 'zh' }) }))
afterEach(cleanup)
const open = (path: string) => render(<MemoryRouter initialEntries={[path]}><PublicLegalPage /></MemoryRouter>)
it('shows current content ownership and individual operator without login', () => {
  open('/legal/terms-of-service?lang=zh&version=2026-10-19')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('服务条款')
  expect(screen.getByText(/以个人身份运营/)).toBeTruthy()
  expect(screen.getByRole('heading', { name: /你的内容归属/ })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('switches languages while keeping the document edition', async () => {
  open('/legal/privacy-policy?lang=zh&version=2026-10-19')
  await userEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Privacy Policy')
  expect(screen.getByText('Version 2026-10-19')).toBeTruthy()
})
it('clearly labels old text as archived', () => {
  open('/legal/terms-of-service?lang=zh&version=2026-03-30')
  expect(screen.getByRole('note').textContent).toContain('历史文本，已停用')
  expect(screen.getByText(/部分功能可能仅对高级版开放/)).toBeTruthy()
})
it('does not substitute a different edition for an unknown version', () => {
  open('/legal/terms-of-service?lang=en&version=unknown')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Policy edition not found')
  expect(screen.queryByRole('heading', { name: /Ownership of your content/ })).toBeNull()
})
