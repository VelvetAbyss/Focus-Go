import { useMemo } from 'react'
import { usePreferences } from '../../shared/prefs/usePreferences'
import type { LanguageCode } from '../../shared/i18n/types'

export type LabsLang = LanguageCode

type LabsMessages = {
  featureTitles: Record<string, string>
  featureDescriptions: Record<string, string>
  nav: {
    dashboard: string
    timeline: string
    projects: string
    tasks: string
    note: string
    calendar: string
    trips: string
    focus: string
    diary: string
    membership: string
    settings: string
    labs: string
    admin: string
  }
  labs: {
    title: string
    eyebrow: string
    eyebrowPremium: string
    tierFree: string
    tierPremium: string
    subtitle: string
    available: string
    installed: string
    removed: string
    premiumLocked: string
    install: string
    open: string
    openHabits: string
    openTranslation: string
    openProject: string
    remove: string
    restore: string
    upgrade: string
    comingSoon: string
    upgradeTitle: string
    upgradeDesc: string
    upgradeConfirm: string
    cancel: string
    removeTitle: string
    removeDesc: string
    loading: string
  }
  toast: {
    habitAccessDenied: string
    upgraded: string
    installed: string
    removed: string
    restored: string
  }
}

const messages: Record<LabsLang, LabsMessages> = {
  en: {
    featureTitles: {
      bazi: 'BaZi', astrology: 'Astrology', tarot: 'Tarot',
      'habit-tracker': 'Habit Tracker',
      translation: 'Translate',
      'currency-exchange': 'Currency Exchange',
      crm: 'Customer workspace',
      'project-workspace': 'Project',
      'ai-digest': 'AI Digest',
      automation: 'Automation Flows',
    },
    featureDescriptions: {
      bazi: 'Four pillars, luck cycles and transparent rule-based readings.',
      astrology: 'Sun-sign overviews, personal charts and daily to yearly readings.',
      tarot: 'Choose cards by hand, explore questions and keep complete readings.',
      'habit-tracker': 'Identity-first habit dashboard with streaks, progress ring, and heatmap.',
      translation: 'Free online and offline translation, business expressions and language packs downloaded as needed.',
      'currency-exchange': 'Convert currencies and explore historical exchange rates.',
      crm: 'B2B and B2C customers, opportunities and follow-ups, connected to Tasks, Calendar and Notes.',
      'project-workspace': 'Dedicated workspace for complex projects with clear goals and timelines.',
      'ai-digest': 'Weekly summarization digest for your subscriptions.',
      automation: 'Composable productivity automations and triggers.',
    },
    nav: {
      dashboard: 'Dashboard',
      timeline: 'Timeline',
      projects: 'Project',
      tasks: 'Tasks',
      note: 'Note',
      calendar: 'Calendar',
      trips: 'Trips',
      focus: 'Focus',
      diary: 'Diary',
      membership: 'Membership',
      settings: 'Settings',
      labs: 'Labs',
      admin: 'Admin',
    },
    labs: {
      title: 'Labs',
      eyebrow: 'Labs',
      eyebrowPremium: 'Premium Labs',
      tierFree: 'Free',
      tierPremium: 'Premium',
      subtitle: 'Enable premium features and manage installed capabilities.',
      available: 'Available',
      installed: 'Installed',
      removed: 'Removed',
      premiumLocked: 'Premium required',
      install: 'Install',
      open: 'Open',
      openHabits: 'Open Habits',
      openTranslation: 'Open Translate',
      openProject: 'Open Project',
      remove: 'Remove',
      restore: 'Restore',
      upgrade: 'Upgrade to Premium',
      comingSoon: 'Coming soon',
      upgradeTitle: 'Upgrade to Premium?',
      upgradeDesc: 'Choose a payment method to open Premium monthly membership.',
      upgradeConfirm: 'Continue to pay',
      cancel: 'Cancel',
      removeTitle: 'Remove feature?',
      removeDesc: 'This feature will be removed from your installed list. You can restore it later.',
      loading: 'Loading Labs…',
    },
    toast: {
      habitAccessDenied: 'Habit Tracker requires Premium and installation. Redirected to Labs.',
      upgraded: 'Premium unlocked in mock mode.',
      installed: 'Feature installed.',
      removed: 'Feature removed.',
      restored: 'Feature restored.',
    },
  },
  zh: {
    featureTitles: {
      bazi: '八字 · 四时', astrology: '星座 · 星图', tarot: '塔罗 · 一刻',
      'habit-tracker': '习惯追踪',
      translation: '翻译',
      'currency-exchange': '汇率转换',
      crm: '客户管理',
      'project-workspace': '项目',
      'ai-digest': 'AI Digest',
      automation: '自动化流程',
    },
    featureDescriptions: {
      bazi: '多人八字排盘与完整解读，查看今日及各阶段运势。',
      astrology: '十二星座速览与个人星盘，阅读日、周、月、年趋势。',
      tarot: '每日一牌与主题问事，亲手选牌，保存解读与心得。',
      'habit-tracker': '以身份认同为核心的习惯仪表盘，带有连续记录、进度环和热力图。',
      translation: '免费在线与离线翻译，支持商务表达，离线语言包按需下载。',
      'currency-exchange': '换算多种货币，查看历史汇率走势。',
      crm: '企业与个人客户、商机和跟进工作台，与任务、日历、笔记联动。',
      'project-workspace': '为复杂项目打造的专属工作区，目标清晰，时间线明确。',
      'ai-digest': '每周自动汇总你的订阅内容摘要。',
      automation: '可组合的生产力自动化流程与触发器。',
    },
    nav: {
      dashboard: '仪表盘',
      timeline: '时间线',
      projects: '项目',
      tasks: '任务',
      note: '笔记',
      calendar: '日历',
      trips: '旅行',
      focus: '专注',
      diary: '日记',
      membership: '会员',
      settings: '设置',
      labs: '实验室',
      admin: '管理后台',
    },
    labs: {
      title: '实验室',
      eyebrow: '实验室',
      eyebrowPremium: 'Premium 实验室',
      tierFree: '免费版',
      tierPremium: 'Premium',
      subtitle: '管理高级功能并控制安装状态。',
      available: '可添加',
      installed: '已安装',
      removed: '已移除',
      premiumLocked: '需要 Premium',
      install: '安装',
      open: '打开',
      openHabits: '打开习惯追踪',
      openTranslation: '打开翻译',
      openProject: '打开项目',
      remove: '移除',
      restore: '恢复',
      upgrade: '升级到 Premium',
      comingSoon: '即将支持',
      upgradeTitle: '升级到 Premium？',
      upgradeDesc: '选择支付方式，完成后立即开通 Premium 月会员。',
      upgradeConfirm: '继续支付',
      cancel: '取消',
      removeTitle: '移除该功能？',
      removeDesc: '该功能会从已安装列表移除，你可以稍后恢复。',
      loading: '加载实验室中…',
    },
    toast: {
      habitAccessDenied: '习惯追踪需要 Premium 且已安装，已跳转到实验室。',
      upgraded: '已开通 Premium（模拟）。',
      installed: '功能安装成功。',
      removed: '功能已移除。',
      restored: '功能已恢复。',
    },
  },
}

const resolveLang = (language: LanguageCode): LabsLang => language

export const useLabsI18n = () => {
  const { language } = usePreferences()
  const lang = resolveLang(language)
  return useMemo(() => messages[lang], [lang])
}
