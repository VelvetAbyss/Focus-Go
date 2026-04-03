// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UpgradeModal from './UpgradeModal'

const mockCloseModal = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../UpgradeModalContext', () => ({
  useUpgradeModal: () => ({
    open: true,
    lockedFeature: 'Cloud Sync',
    closeModal: mockCloseModal,
  }),
}))

vi.mock('../upgradeModalI18n', async () => {
  const actual = await vi.importActual('../upgradeModalI18n')
  return {
    ...actual,
    useUpgradeModalI18n: () => ({
      title: 'Choose your plan',
      subtitle: 'Unlock premium',
      regionCN: '中国区',
      regionGlobal: '海外区',
      lockedFeaturePrefix: 'Locked feature:',
      planFree: 'Free',
      planPremium: 'Premium',
      planLifetime: 'Lifetime',
      freeTagline: 'Free',
      premiumTagline: 'Premium',
      lifetimeTagline: 'Lifetime',
      freeCta: 'Continue',
      premiumCtaMonthly: '升级月付',
      premiumCtaYearly: '升级年付',
      lifetimeCta: '立即买断',
      badgeRecommended: '推荐',
      badgeOneTime: '一次付费',
      comparisonTitle: 'Compare',
      footerRestore: 'Restore',
      footerPromo: 'Promo',
      footerFaq: 'FAQ',
      footerTerms: 'Terms',
      footerContact: 'Contact',
      freePerks: [],
      premiumPerks: [],
      lifetimePerks: [],
      table: { groups: [] },
    }),
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('UpgradeModal', () => {
  beforeEach(() => {
    mockCloseModal.mockReset()
    mockNavigate.mockReset()
  })

  it('navigates to premium page from monthly plan button', async () => {
    render(
      <MemoryRouter>
        <UpgradeModal />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /升级月付|Upgrade Monthly/i }))
    expect(mockCloseModal).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/premium')
  })
})
