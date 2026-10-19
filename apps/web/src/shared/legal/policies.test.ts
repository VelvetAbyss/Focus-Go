import { describe, expect, it } from 'vitest'
import { LEGAL_DOCUMENTS, POLICY_VERSION, policyConfirmation, policyUrl } from './policies'
import { LEGACY_LEGAL_DOCUMENTS } from './legacyPolicies'
describe('bilingual policy editions', () => {
  it('keeps matching sections and paragraph counts in both languages', () => {
    for (const key of ['terms-of-service', 'privacy-policy'] as const) {
      const zh = LEGAL_DOCUMENTS.zh[key], en = LEGAL_DOCUMENTS.en[key]
      expect(zh.updatedAt).toBe(POLICY_VERSION); expect(en.updatedAt).toBe(POLICY_VERSION)
      expect(zh.sections.map(section => section.paragraphs.length)).toEqual(en.sections.map(section => section.paragraphs.length))
      expect(JSON.stringify(zh)).toContain('Dylan Feng'); expect(JSON.stringify(en)).toContain('Dylan Feng')
    }
  })
  it('replaces contradictory free/login rules and preserves historical text separately', () => {
    const zh = JSON.stringify(LEGAL_DOCUMENTS.zh), en = JSON.stringify(LEGAL_DOCUMENTS.en)
    expect(zh).toContain('你的内容归属'); expect(en).toContain('Ownership of your content')
    expect(zh).toContain('250 MiB'); expect(en).toContain('250 MiB')
    expect(zh).not.toContain('部分功能可能仅对高级版开放'); expect(en).not.toContain('Local use does not require an account')
    expect(JSON.stringify(LEGACY_LEGAL_DOCUMENTS.zh)).toContain('部分功能可能仅对高级版开放')
  })
  it('pins links and explicit confirmation to the displayed edition', () => {
    expect(policyUrl('terms-of-service', 'zh')).toBe(`/legal/terms-of-service?lang=zh&version=${POLICY_VERSION}`)
    expect(policyConfirmation('en')).toEqual({ termsAccepted: true, privacyAcknowledged: true, termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION, locale: 'en' })
  })
})
