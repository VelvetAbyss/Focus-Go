import { useMemo } from 'react'

export type HabitsLang = 'en' | 'zh'

type HabitsMessages = {
  title: string
  subtitle: string
  addHabit: string
  emptyTitle: string
  emptyDescription: string
  todayCompleted: string
  markToday: string
  hideCalendar: string
  showCalendar: string
  progress: string
  completed: string
  heatmap: string
  stats: string
  activeCount: string
  streak: string
  completionRate: string
  total: string
  archived: string
  restore: string
  remove: string
  undo: string
  toastCompleted: string
  toastUndone: string
  toastArchived: string
  toastRestored: string
  formTitleCreate: string
  formTitleEdit: string
  formName: string
  formNamePlaceholder: string
  formDescription: string
  formDescriptionPlaceholder: string
  formIcon: string
  formColor: string
  formPreview: string
  formCancel: string
  formSubmitCreate: string
  formSubmitSave: string
  formValidationName: string
}

const messages: Record<HabitsLang, HabitsMessages> = {
  en: {
    title: 'Habit Tracker',
    subtitle: 'Build better routines one quiet day at a time.',
    addHabit: 'Add New Habit',
    emptyTitle: 'No habits yet',
    emptyDescription: 'Add your first habit to start building momentum.',
    todayCompleted: 'Completed Today',
    markToday: 'Mark Today Complete',
    hideCalendar: 'Hide Calendar',
    showCalendar: 'View Calendar',
    progress: 'Progress',
    completed: 'Completed',
    heatmap: 'Heatmap',
    stats: 'Stats',
    activeCount: 'Active',
    streak: 'Streak',
    completionRate: 'Rate',
    total: 'Total',
    archived: 'Archived',
    restore: 'Restore',
    remove: 'Archive',
    undo: 'Undo',
    toastCompleted: 'Habit completed.',
    toastUndone: 'Completion undone.',
    toastArchived: 'Habit archived.',
    toastRestored: 'Habit restored.',
    formTitleCreate: 'Add New Habit',
    formTitleEdit: 'Edit Habit',
    formName: 'Habit Name',
    formNamePlaceholder: 'Daily Reading',
    formDescription: 'Description',
    formDescriptionPlaceholder: 'Add a short note...',
    formIcon: 'Choose Icon',
    formColor: 'Choose Color',
    formPreview: 'Preview:',
    formCancel: 'Cancel',
    formSubmitCreate: 'Add Habit',
    formSubmitSave: 'Save Habit',
    formValidationName: 'Habit name is required.',
  },
  zh: {
    title: '习惯追踪器',
    subtitle: '养成好习惯，成就更好的自己',
    addHabit: '添加新习惯',
    emptyTitle: '还没有习惯',
    emptyDescription: '点击上方按钮添加你的第一个习惯吧！',
    todayCompleted: '今日已完成',
    markToday: '标记今日完成',
    hideCalendar: '隐藏日历',
    showCalendar: '查看日历',
    progress: '进度',
    completed: '完成',
    heatmap: '热力图',
    stats: '统计',
    activeCount: '进行中',
    streak: '连续',
    completionRate: '完成率',
    total: '总计',
    archived: '已归档',
    restore: '恢复',
    remove: '移除',
    undo: '撤销',
    toastCompleted: '已完成今日打卡。',
    toastUndone: '已撤销本次打卡。',
    toastArchived: '习惯已归档。',
    toastRestored: '习惯已恢复。',
    formTitleCreate: '添加新习惯',
    formTitleEdit: '编辑习惯',
    formName: '习惯名称 *',
    formNamePlaceholder: '例如：每日阅读',
    formDescription: '描述',
    formDescriptionPlaceholder: '添加一些描述...',
    formIcon: '选择图标',
    formColor: '选择颜色',
    formPreview: '预览：',
    formCancel: '取消',
    formSubmitCreate: '添加习惯',
    formSubmitSave: '保存习惯',
    formValidationName: '请输入习惯名称。',
  },
}

const resolveLang = (): HabitsLang => {
  if (typeof navigator === 'undefined') return 'en'
  const first = navigator.languages?.[0] ?? navigator.language
  return String(first).toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const useHabitsI18n = () => {
  const lang = resolveLang()
  return useMemo(() => messages[lang], [lang])
}
