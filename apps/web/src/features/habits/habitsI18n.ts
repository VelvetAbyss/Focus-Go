import { useMemo } from 'react'

export type HabitsLang = 'en' | 'zh'

type HabitsMessages = {
  title: string
  subtitle: string
  today: string
  addHabit: string
  active: string
  archived: string
  emptyActive: string
  emptyArchived: string
  completeAll: string
  progress: string
  stats: string
  heatmap: string
  activeCount: string
  streak: string
  freezes: string
  completed: string
  archive: string
  restore: string
  edit: string
  moveUp: string
  moveDown: string
  complete: string
  updateValue: string
  target: string
  minutes: string
  dateFormat: Intl.DateTimeFormatOptions
  form: {
    createTitle: string
    editTitle: string
    title: string
    titlePlaceholder: string
    type: string
    typeBoolean: string
    typeNumeric: string
    typeTimer: string
    target: string
    freezesAllowed: string
    color: string
    cancel: string
    save: string
    validationTitle: string
    validationTarget: string
    discardTitle: string
    discardDescription: string
    discardConfirm: string
    keepEditing: string
  }
  toast: {
    created: string
    updated: string
    archived: string
    restored: string
    completed: string
    undone: string
    allCompleted: string
    undo: string
  }
}

const messages: Record<HabitsLang, HabitsMessages> = {
  en: {
    title: 'Habit Tracker',
    subtitle: 'Identity-first habits with gentle consistency and clear daily progress.',
    today: 'Today',
    addHabit: 'Add habit',
    active: 'Active',
    archived: 'Archived',
    emptyActive: 'No active habits yet. Create your first one to start a streak.',
    emptyArchived: 'No archived habits.',
    completeAll: 'All habits complete',
    progress: 'Daily Progress',
    stats: 'Stats',
    heatmap: 'Heatmap',
    activeCount: 'Active',
    streak: 'Streak',
    freezes: 'Freeze',
    completed: 'Completed',
    archive: 'Archive',
    restore: 'Restore',
    edit: 'Edit habit',
    moveUp: 'Move up',
    moveDown: 'Move down',
    complete: 'Complete',
    updateValue: 'Update value',
    target: 'Target',
    minutes: 'min',
    dateFormat: { weekday: 'long', month: 'short', day: 'numeric' },
    form: {
      createTitle: 'Create habit',
      editTitle: 'Edit habit',
      title: 'Title',
      titlePlaceholder: 'Drink water',
      type: 'Type',
      typeBoolean: 'Boolean',
      typeNumeric: 'Numeric goal',
      typeTimer: 'Timer (minutes)',
      target: 'Target',
      freezesAllowed: 'Freeze allowance',
      color: 'Color',
      cancel: 'Cancel',
      save: 'Save',
      validationTitle: 'Title is required.',
      validationTarget: 'Target must be at least 1.',
      discardTitle: 'Discard changes?',
      discardDescription: 'You have unsaved changes.',
      discardConfirm: 'Discard',
      keepEditing: 'Keep editing',
    },
    toast: {
      created: 'Habit created.',
      updated: 'Habit updated.',
      archived: 'Habit archived.',
      restored: 'Habit restored.',
      completed: 'Habit completed.',
      undone: 'Completion undone.',
      allCompleted: 'All habits complete for today.',
      undo: 'Undo',
    },
  },
  zh: {
    title: '习惯追踪',
    subtitle: '以身份习惯为核心，减少中断焦虑，清晰展示每日进度。',
    today: '今天',
    addHabit: '新增习惯',
    active: '进行中',
    archived: '已归档',
    emptyActive: '当前没有进行中的习惯，先创建一个开始连胜。',
    emptyArchived: '暂无已归档习惯。',
    completeAll: '今日全部完成',
    progress: '今日进度',
    stats: '统计',
    heatmap: '热力图',
    activeCount: '进行中',
    streak: '连胜',
    freezes: '冻结',
    completed: '已完成',
    archive: '归档',
    restore: '恢复',
    edit: '编辑习惯',
    moveUp: '上移',
    moveDown: '下移',
    complete: '完成',
    updateValue: '更新数值',
    target: '目标',
    minutes: '分钟',
    dateFormat: { weekday: 'long', month: 'short', day: 'numeric' },
    form: {
      createTitle: '创建习惯',
      editTitle: '编辑习惯',
      title: '标题',
      titlePlaceholder: '例如：喝水',
      type: '类型',
      typeBoolean: '是否完成',
      typeNumeric: '数值目标',
      typeTimer: '计时（分钟）',
      target: '目标值',
      freezesAllowed: '可用冻结次数',
      color: '颜色',
      cancel: '取消',
      save: '保存',
      validationTitle: '请输入标题。',
      validationTarget: '目标值不能小于 1。',
      discardTitle: '放弃修改？',
      discardDescription: '你有未保存的更改。',
      discardConfirm: '放弃',
      keepEditing: '继续编辑',
    },
    toast: {
      created: '习惯已创建。',
      updated: '习惯已更新。',
      archived: '习惯已归档。',
      restored: '习惯已恢复。',
      completed: '已完成打卡。',
      undone: '已撤销本次打卡。',
      allCompleted: '今日习惯全部完成。',
      undo: '撤销',
    },
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
