import { useMemo } from 'react'
import { usePreferences } from '../../shared/prefs/usePreferences'
import type { LanguageCode } from '../../shared/i18n/types'

export type LabsLang = LanguageCode

type LabsMessages = {
  featureTitles: Record<string, string>
  featureDescriptions: Record<string, string>
  nav: {
    dashboard: string
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
    openHabits: string
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
      'habit-tracker': 'Habit Tracker',
      'project-workspace': 'Project',
      'ai-digest': 'AI Digest',
      automation: 'Automation Flows',
    },
    featureDescriptions: {
      'habit-tracker': 'Identity-first habit dashboard with streaks, progress ring, and heatmap.',
      'project-workspace': 'Dedicated workspace for complex projects with clear goals and timelines.',
      'ai-digest': 'Weekly summarization digest for your subscriptions.',
      automation: 'Composable productivity automations and triggers.',
    },
    nav: {
      dashboard: 'Dashboard',
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
      openHabits: 'Open Habits',
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
      'habit-tracker': '习惯追踪',
      'project-workspace': '项目',
      'ai-digest': 'AI Digest',
      automation: '自动化流程',
    },
    featureDescriptions: {
      'habit-tracker': '以身份认同为核心的习惯仪表盘，带有连续记录、进度环和热力图。',
      'project-workspace': '为复杂项目打造的专属工作区，目标清晰，时间线明确。',
      'ai-digest': '每周自动汇总你的订阅内容摘要。',
      automation: '可组合的生产力自动化流程与触发器。',
    },
    nav: {
      dashboard: '仪表盘',
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
      openHabits: '打开习惯追踪',
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
