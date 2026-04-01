import { useMemo } from 'react'
import { usePreferences } from '../../shared/prefs/usePreferences'
import type { LanguageCode } from '../../shared/i18n/types'

export type PricingRegion = 'cn' | 'global'

export type PricingSet = {
  free: string
  premiumMonthly: string
  premiumMonthlyBilling: string
  premiumYearly: string
  premiumYearlyBilling: string
  lifetime: string
  lifetimeBilling: string
}

export const PRICING: Record<PricingRegion, PricingSet> = {
  cn: {
    free: '¥0',
    premiumMonthly: '¥15',
    premiumMonthlyBilling: '/ 月',
    premiumYearly: '¥148',
    premiumYearlyBilling: '/ 年',
    lifetime: '¥249',
    lifetimeBilling: '一次性',
  },
  global: {
    free: '$0',
    premiumMonthly: '$4.99',
    premiumMonthlyBilling: '/ month',
    premiumYearly: '$39.99',
    premiumYearlyBilling: '/ year',
    lifetime: '$89',
    lifetimeBilling: 'one-time',
  },
}

type UpgradeModalMessages = {
  title: string
  subtitle: string
  lockedFeaturePrefix: string
  regionCN: string
  regionGlobal: string
  planFree: string
  planPremium: string
  planLifetime: string
  badgeRecommended: string
  badgeOneTime: string
  freeTagline: string
  freeCta: string
  premiumTagline: string
  premiumCtaMonthly: string
  premiumCtaYearly: string
  lifetimeTagline: string
  lifetimeCta: string
  comparisonTitle: string
  footerRestore: string
  footerPromo: string
  footerFaq: string
  footerTerms: string
  footerContact: string
  freePerks: string[]
  premiumPerks: string[]
  lifetimePerks: string[]
  table: {
    groups: {
      label: string
      rows: { label: string; free: 'check' | 'cross' | string; premium: 'check' | 'cross' | string; lifetime: 'check' | 'cross' | string }[]
    }[]
  }
}

const messages: Record<LanguageCode, UpgradeModalMessages> = {
  en: {
    title: 'Choose Your Plan',
    subtitle: 'Unlock cloud sync, unlimited notes, and more premium features',
    lockedFeaturePrefix: 'Unlock:',
    regionCN: '中国区',
    regionGlobal: 'Global',
    planFree: 'Free',
    planPremium: 'Premium',
    planLifetime: 'Lifetime',
    badgeRecommended: 'Recommended',
    badgeOneTime: 'One-Time',
    freeTagline: 'For light everyday use',
    freeCta: 'Continue Free',
    premiumTagline: 'Everything you need',
    premiumCtaMonthly: 'Upgrade Monthly',
    premiumCtaYearly: 'Upgrade Yearly',
    lifetimeTagline: 'Buy once, own forever',
    lifetimeCta: 'Get Lifetime Access',
    comparisonTitle: 'Feature Comparison',
    footerRestore: 'Restore Purchase',
    footerPromo: 'Promo Code',
    footerFaq: 'FAQ',
    footerTerms: 'Terms',
    footerContact: 'Contact Us',
    freePerks: [
      'Tasks, Notes, Focus & Diary',
      'Local data storage',
      'Core widgets on Dashboard',
      'Limited notes count',
    ],
    premiumPerks: [
      'Cloud Sync across devices',
      'Unlimited Notes',
      'Mind Map',
      'White Noise library',
      'Custom Dashboard & extra widgets',
    ],
    lifetimePerks: [
      'All current Premium features',
      'Permanent access to local advanced features',
      'No monthly or yearly renewal',
    ],
    table: {
      groups: [
        {
          label: 'Focus & Productivity',
          rows: [
            { label: 'Tasks & Focus Timer', free: 'check', premium: 'check', lifetime: 'check' },
            { label: 'White Noise', free: 'cross', premium: 'check', lifetime: 'check' },
            { label: 'Diary', free: 'check', premium: 'check', lifetime: 'check' },
          ],
        },
        {
          label: 'Notes & Knowledge',
          rows: [
            { label: 'Basic Notes', free: 'check', premium: 'check', lifetime: 'check' },
            { label: 'Unlimited Notes', free: 'cross', premium: 'check', lifetime: 'check' },
            { label: 'Mind Map', free: 'cross', premium: 'check', lifetime: 'check' },
          ],
        },
        {
          label: 'Data & Sync',
          rows: [
            { label: 'Local Storage', free: 'check', premium: 'check', lifetime: 'check' },
            { label: 'Cloud Sync', free: 'cross', premium: 'check', lifetime: 'check' },
          ],
        },
        {
          label: 'Customization',
          rows: [
            { label: 'Standard Dashboard', free: 'check', premium: 'check', lifetime: 'check' },
            { label: 'Custom Dashboard Layout', free: 'cross', premium: 'check', lifetime: 'check' },
            { label: 'Extra Widgets', free: 'cross', premium: 'check', lifetime: 'check' },
            { label: 'Future Premium Features', free: 'cross', premium: 'check', lifetime: 'check' },
          ],
        },
      ],
    },
  },
  zh: {
    title: '选择适合你的方案',
    subtitle: '解锁云同步、无限笔记和更多高级功能',
    lockedFeaturePrefix: '解锁此功能：',
    regionCN: '中国区',
    regionGlobal: '海外区',
    planFree: '免费版',
    planPremium: 'Premium',
    planLifetime: '终身版',
    badgeRecommended: '推荐',
    badgeOneTime: '一次付费',
    freeTagline: '适合轻量使用',
    freeCta: '继续免费使用',
    premiumTagline: '最受欢迎',
    premiumCtaMonthly: '升级月付',
    premiumCtaYearly: '升级年付',
    lifetimeTagline: '一次购买，永久使用',
    lifetimeCta: '立即买断',
    comparisonTitle: '功能对比',
    footerRestore: '恢复购买',
    footerPromo: '优惠码',
    footerFaq: '常见问题',
    footerTerms: '条款',
    footerContact: '联系客服',
    freePerks: [
      '基础 Tasks / Notes / Focus / Diary',
      '本地数据使用',
      '仪表盘核心组件',
      '笔记数量有限制',
    ],
    premiumPerks: [
      '跨设备云同步',
      '无限笔记',
      '思维导图',
      '白噪音音效库',
      '自定义仪表盘与更多 Widgets',
    ],
    lifetimePerks: [
      '当前全部 Premium 权益',
      '永久解锁本地高级功能',
      '无月付 / 年付续费',
    ],
    table: {
      groups: [
        {
          label: '专注与效率',
          rows: [
            { label: '任务与专注计时器', free: 'check', premium: 'check', lifetime: 'check' },
            { label: '白噪音', free: 'cross', premium: 'check', lifetime: 'check' },
            { label: '日记', free: 'check', premium: 'check', lifetime: 'check' },
          ],
        },
        {
          label: '笔记与知识整理',
          rows: [
            { label: '基础笔记', free: 'check', premium: 'check', lifetime: 'check' },
            { label: '无限笔记', free: 'cross', premium: 'check', lifetime: 'check' },
            { label: '思维导图', free: 'cross', premium: 'check', lifetime: 'check' },
          ],
        },
        {
          label: '数据与同步',
          rows: [
            { label: '本地存储', free: 'check', premium: 'check', lifetime: 'check' },
            { label: '云同步', free: 'cross', premium: 'check', lifetime: 'check' },
          ],
        },
        {
          label: '个性化',
          rows: [
            { label: '标准仪表盘', free: 'check', premium: 'check', lifetime: 'check' },
            { label: '自定义仪表盘布局', free: 'cross', premium: 'check', lifetime: 'check' },
            { label: '额外 Widgets', free: 'cross', premium: 'check', lifetime: 'check' },
            { label: '未来 Premium 新功能', free: 'cross', premium: 'check', lifetime: 'check' },
          ],
        },
      ],
    },
  },
}

export const useUpgradeModalI18n = () => {
  const { language } = usePreferences()
  return useMemo(() => messages[language] ?? messages.en, [language])
}
