import { useMemo } from 'react'

export type LabsLang = 'en' | 'zh'

type LabsMessages = {
  nav: {
    dashboard: string
    rss: string
    tasks: string
    calendar: string
    focus: string
    notes: string
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
    openRss: string
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
  rss: {
    title: string
    subtitle: string
    back: string
    refresh: string
    stale: string
    staleHint: string
    retry: string
    emptyError: string
    sourceInputRoute: string
    sourceInputName: string
    addSource: string
    addSourceTitle: string
    addSourceDesc: string
    removedSources: string
    restore: string
    noRemoved: string
    noEntries: string
    noSelection: string
    read: string
    closeSummary: string
    openSummary: string
    favorites: string
    list: string
    subscriptions: string
    newGroup: string
    renameGroup: string
    deleteGroup: string
    assignGroup: string
    ungrouped: string
    star: string
    unstar: string
    today: string
    yesterday: string
    sourceCount: string
    removeSourceTitle: string
    removeSourceDesc: string
  }
  toast: {
    rssAccessDenied: string
    habitAccessDenied: string
    upgraded: string
    installed: string
    removed: string
    restored: string
    groupCreated: string
    groupRenamed: string
    groupDeleted: string
    sourceStarred: string
    sourceUnstarred: string
  }
}

const messages: Record<LabsLang, LabsMessages> = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      rss: 'RSS',
      tasks: 'Tasks',
      calendar: 'Calendar',
      focus: 'Focus',
      notes: 'Notes',
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
      openRss: 'Open RSS',
      openHabits: 'Open Habits',
      remove: 'Remove',
      restore: 'Restore',
      upgrade: 'Upgrade to Premium',
      comingSoon: 'Coming soon',
      upgradeTitle: 'Upgrade to Premium?',
      upgradeDesc: 'Premium unlocks RSS and additional Labs features.',
      upgradeConfirm: 'Activate mock Premium',
      cancel: 'Cancel',
      removeTitle: 'Remove feature?',
      removeDesc: 'This feature will be removed from your installed list. You can restore it later.',
    },
    rss: {
      title: 'RSS Reader',
      subtitle: 'Reference-style feed workspace with grouped timeline.',
      back: 'Back to Dashboard',
      refresh: 'Refresh',
      stale: 'Showing cached data',
      staleHint: 'Latest refresh failed. Last successful sync',
      retry: 'Retry refresh',
      emptyError: 'Failed to load feed and no cache is available yet.',
      sourceInputRoute: 'Route or RSS URL, e.g. /github/trending/daily or https://example.com/feed.xml',
      sourceInputName: 'Display name (optional)',
      addSource: 'Add source',
      addSourceTitle: 'Add source',
      addSourceDesc: 'You can use RSSHub route or regular RSS URL.',
      removedSources: 'Removed sources',
      restore: 'Restore',
      noRemoved: 'No removed sources',
      noEntries: 'No entries yet. Refresh to pull data.',
      noSelection: 'Select an entry to read summary.',
      read: 'Read',
      closeSummary: 'Close summary',
      openSummary: 'Open summary',
      favorites: 'Favorites',
      list: 'List',
      subscriptions: 'Subscriptions',
      newGroup: 'New group',
      renameGroup: 'Rename group',
      deleteGroup: 'Delete group',
      assignGroup: 'Assign group',
      ungrouped: 'Ungrouped',
      star: 'Star source',
      unstar: 'Unstar source',
      today: 'Today',
      yesterday: 'Yesterday',
      sourceCount: 'sources',
      removeSourceTitle: 'Remove source?',
      removeSourceDesc: 'The source moves to removed list and can be restored later.',
    },
    toast: {
      rssAccessDenied: 'RSS requires Premium and installation. Redirected to Labs.',
      habitAccessDenied: 'Habit Tracker requires Premium and installation. Redirected to Labs.',
      upgraded: 'Premium unlocked in mock mode.',
      installed: 'Feature installed.',
      removed: 'Feature removed.',
      restored: 'Feature restored.',
      groupCreated: 'Group created.',
      groupRenamed: 'Group renamed.',
      groupDeleted: 'Group deleted. Sources moved to Ungrouped.',
      sourceStarred: 'Source starred.',
      sourceUnstarred: 'Source unstarred.',
    },
  },
  zh: {
    nav: {
      dashboard: '仪表盘',
      rss: '订阅',
      tasks: '任务',
      calendar: '日历',
      focus: '专注',
      notes: '笔记',
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
      openRss: '打开 RSS',
      openHabits: '打开习惯追踪',
      remove: '移除',
      restore: '恢复',
      upgrade: '升级到 Premium',
      comingSoon: '即将支持',
      upgradeTitle: '升级到 Premium？',
      upgradeDesc: 'Premium 可解锁 RSS 与后续 Labs 功能。',
      upgradeConfirm: '立即开通（模拟）',
      cancel: '取消',
      removeTitle: '移除该功能？',
      removeDesc: '该功能会从已安装列表移除，你可以稍后恢复。',
    },
    rss: {
      title: 'RSS 阅读器',
      subtitle: '参考信息流布局，应用内阅读并支持缓存回退。',
      back: '返回仪表盘',
      refresh: '刷新',
      stale: '当前展示缓存数据',
      staleHint: '最近刷新失败，上次成功同步时间',
      retry: '重试刷新',
      emptyError: '刷新失败且暂无历史缓存。',
      sourceInputRoute: '输入 route 或 RSS 链接，例如 /github/trending/daily 或 https://example.com/feed.xml',
      sourceInputName: '显示名称（可选）',
      addSource: '新增源',
      addSourceTitle: '新增订阅源',
      addSourceDesc: '支持 RSSHub route 或常规 RSS 链接。',
      removedSources: '已移除源',
      restore: '恢复',
      noRemoved: '暂无已移除源',
      noEntries: '暂无条目，点击刷新获取内容。',
      noSelection: '选择一条内容查看摘要。',
      read: '已读',
      closeSummary: '关闭摘要',
      openSummary: '打开摘要',
      favorites: '收藏',
      list: '列表',
      subscriptions: '订阅源',
      newGroup: '新建分组',
      renameGroup: '重命名分组',
      deleteGroup: '删除分组',
      assignGroup: '分配分组',
      ungrouped: '未分组',
      star: '收藏订阅源',
      unstar: '取消收藏',
      today: '今天',
      yesterday: '昨天',
      sourceCount: '个源',
      removeSourceTitle: '移除该源？',
      removeSourceDesc: '该源将进入已移除列表，可稍后恢复。',
    },
    toast: {
      rssAccessDenied: 'RSS 需要 Premium 且已安装，已跳转到 Labs。',
      habitAccessDenied: 'Habit Tracker 需要 Premium 且已安装，已跳转到 Labs。',
      upgraded: '已开通 Premium（模拟）。',
      installed: '功能安装成功。',
      removed: '功能已移除。',
      restored: '功能已恢复。',
      groupCreated: '分组创建成功。',
      groupRenamed: '分组重命名成功。',
      groupDeleted: '分组已删除，订阅源已回到未分组。',
      sourceStarred: '已收藏该订阅源。',
      sourceUnstarred: '已取消收藏。',
    },
  },
}

const resolveLang = (): LabsLang => {
  if (typeof navigator === 'undefined') return 'en'
  const first = navigator.languages?.[0] ?? navigator.language
  return String(first).toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const useLabsI18n = () => {
  const lang = resolveLang()
  return useMemo(() => messages[lang], [lang])
}
