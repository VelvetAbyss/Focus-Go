// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TranslationPage from './TranslationPage'
const labs = vi.hoisted(() => ({ ready: true, catalog: [] as { featureKey: string; state: string }[] }))
vi.mock('../labs/LabsContext', () => ({ useLabs: () => labs }))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'zh' }) }))
vi.mock('./TranslationCard', () => ({ default: ({ fullPage }: { fullPage: boolean }) => <div>{fullPage ? 'Full translation editor' : 'Card'}</div> }))
afterEach(() => { cleanup(); labs.ready = true; labs.catalog = [] })
const open = () => render(<MemoryRouter initialEntries={['/translation']}><Routes><Route path="/translation" element={<TranslationPage />} /><Route path="/labs" element={<div>Labs catalog</div>} /></Routes></MemoryRouter>)
it('redirects unavailable and removed features to Labs', () => {
  labs.catalog = [{ featureKey: 'translation', state: 'removed' }]
  open()
  expect(screen.getByText('Labs catalog')).toBeTruthy()
  expect(screen.queryByText('Full translation editor')).toBeNull()
})
it('waits for installation hydration before redirecting', () => {
  labs.ready = false
  open()
  expect(screen.queryByText('Labs catalog')).toBeNull()
  expect(screen.queryByText('Full translation editor')).toBeNull()
})
it('opens the full editor with feature management for installed users', () => {
  labs.catalog = [{ featureKey: 'translation', state: 'installed' }]
  open()
  expect(screen.getByText('Full translation editor')).toBeTruthy()
  expect(screen.getByRole('link', { name: '管理功能' }).getAttribute('href')).toBe('/labs')
})
