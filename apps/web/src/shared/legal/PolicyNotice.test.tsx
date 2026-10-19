// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const requestAccount = vi.hoisted(() => vi.fn())
vi.mock('../../store/userProfile', () => ({ requestAccount }))
vi.mock('../../store/auth', () => ({ getAuth: () => ({ user: { id: 'legacy' } }) }))
vi.mock('../i18n/useI18n', () => ({ useI18n: () => ({ language: 'en' }) }))
import { PolicyNotice } from './PolicyNotice'
afterEach(cleanup)
beforeEach(() => requestAccount.mockReset())
it('does not record acceptance for an existing sign-in or for postponing', async () => {
  requestAccount.mockResolvedValue({ acceptance: null })
  render(<PolicyNotice userId="legacy" />)
  await screen.findByLabelText('Policy update')
  await userEvent.click(screen.getByRole('button', { name: 'Later' }))
  expect(requestAccount).toHaveBeenCalledTimes(1)
  expect(requestAccount).toHaveBeenCalledWith('/policy')
})
it('requires an explicit check and saves only when the user confirms', async () => {
  requestAccount.mockResolvedValueOnce({ acceptance: null }).mockResolvedValueOnce({ acceptance: { termsVersion: '2026-10-19' } })
  render(<PolicyNotice userId="legacy" />)
  await userEvent.click(await screen.findByText(/Policies updated/))
  const button = screen.getByRole('button', { name: 'Confirm this edition' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  await userEvent.click(screen.getByRole('checkbox')); await userEvent.click(button)
  await waitFor(() => expect(screen.queryByLabelText('Policy update')).toBeNull())
  expect(JSON.parse(requestAccount.mock.calls[1][1].body)).toMatchObject({ termsAccepted: true, privacyAcknowledged: true, termsVersion: '2026-10-19', locale: 'en' })
})
it('keeps the confirmation pending after a server failure', async () => {
  requestAccount.mockResolvedValueOnce({ acceptance: null }).mockRejectedValueOnce(new Error('offline'))
  render(<PolicyNotice userId="legacy" />)
  await userEvent.click(await screen.findByText(/Policies updated/)); await userEvent.click(screen.getByRole('checkbox')); await userEvent.click(screen.getByRole('button', { name: 'Confirm this edition' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByLabelText('Policy update')).toBeTruthy()
})
