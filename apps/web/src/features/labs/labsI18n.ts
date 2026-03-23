import { useMemo } from 'react'
import { usePreferences } from '../../shared/prefs/usePreferences'
import type { LanguageCode } from '../../shared/i18n/types'

export type LabsLang = LanguageCode

type LabsMessages = {
  nav: {
    dashboard: string
    tasks: string
    note: string
    calendar: string
    focus: string
    review: string
    settings: string
    labs: string
  }
  labs: {
    title: string
    subtitle: string
    available: string
    installed: string
    removed: string
    premiumLocked: string
    install: string
    openHabits: string
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
    nav: {
      dashboard: 'Dashboard',
      tasks: 'Tasks',
      note: 'Note',
      calendar: 'Calendar',
      focus: 'Focus',
      review: 'Review',
      settings: 'Settings',
      labs: 'Labs',
    },
    labs: {
      title: 'Labs',
      subtitle: 'Enable premium features and manage installed capabilities.',
      available: 'Available',
      installed: 'Installed',
      removed: 'Removed',
      premiumLocked: 'Premium required',
      install: 'Install',
      openHabits: 'Open Habits',
      remove: 'Remove',
      restore: 'Restore',
      upgrade: 'Upgrade to Premium',
      comingSoon: 'Coming soon',
      upgradeTitle: 'Upgrade to Premium?',
      upgradeDesc: 'Premium unlocks Habit Tracker and additional Labs features.',
      upgradeConfirm: 'Activate mock Premium',
      cancel: 'Cancel',
      removeTitle: 'Remove feature?',
      removeDesc: 'This feature will be removed from your installed list. You can restore it later.',
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
    nav: {
      dashboard: '仪表盘',
      tasks: '任务',
      note: '笔记',
      calendar: '日历',
      focus: '专注',
      review: '复盘',
      settings: '设置',
      labs: 'Labs',
    },
    labs: {
      title: 'Labs',
      subtitle: '管理高级功能并控制安装状态。',
      available: '可添加',
      installed: '已安装',
      removed: '已移除',
      premiumLocked: '需要 Premium',
      install: '安装',
      openHabits: '打开习惯追踪',
      remove: '移除',
      restore: '恢复',
      upgrade: '升级到 Premium',
      comingSoon: '即将支持',
      upgradeTitle: '升级到 Premium？',
      upgradeDesc: 'Premium 可解锁 Habit Tracker 与后续 Labs 功能。',
      upgradeConfirm: '立即开通（模拟）',
      cancel: '取消',
      removeTitle: '移除该功能？',
      removeDesc: '该功能会从已安装列表移除，你可以稍后恢复。',
    },
    toast: {
      habitAccessDenied: 'Habit Tracker 需要 Premium 且已安装，已跳转到 Labs。',
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
