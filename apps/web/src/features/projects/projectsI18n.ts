import { useMemo } from 'react'
import { usePreferences } from '../../shared/prefs/usePreferences'
import type { LanguageCode } from '../../shared/i18n/types'

type ProjectsMessages = {
  tabs: {
    overview: string
    tasks: string
    timeline: string
    people: string
    notes: string
  }
  page: {
    title: string
    subtitle: string
    newProject: string
    searchPlaceholder: string
    filter: string
    loading: string
    emptyTitle: string
    emptyDesc: string
    createFirst: string
    cardOwner: string
    cardUnassigned: string
    cardTimeline: string
    cardTBD: string
    cardProgress: string
    cardNextAction: string
    cardNextActionDefault: string
    cardOpenWorkspace: string
  }
  filter: {
    statusLabel: string
    priorityLabel: string
    healthLabel: string
    all: string
    planning: string
    active: string
    blocked: string
    done: string
    archived: string
    high: string
    medium: string
    low: string
    onTrack: string
    atRisk: string
  }
  health: {
    onTrack: string
    atRisk: string
    blocked: string
  }
  status: {
    planning: string
    active: string
    blocked: string
    done: string
    archived: string
  }
  detail: {
    back: string
    editTitle: string
    edit: string
    archiveTitle: string
    archive: string
    deleteTitle: string
    delete: string
    deleteConfirm: string
    cancel: string
    addTask: string
    noDescription: string
    unassigned: string
    statTotal: string
    statDone: string
    statActive: string
    statOverdue: string
    projectSections: string
    statTotalTasks: string
    statCompleted: string
    statInProgress: string
    statOverdueLabel: string
    nextAction: string
    nextActionDefault: string
    update: string
    risksBlockers: string
    overdueWarning: string
    noRisks: string
    recentActivity: string
    noActivity: string
    loading: string
    notFound: string
    allStatus: string
    inProgress: string
    allOwners: string
    noTasksFiltered: string
    timeline: string
    week: string
    month: string
    year: string
    noTasksScheduled: string
    team: string
    addPerson: string
    tasks: string
    noContactInfo: string
    noTeamMembers: string
    notes: string
    searchNotes: string
    open: string
    unlink: string
    noLinkedNotes: string
    progressComplete: string
    activityTaskCompleted: string
    activityTaskUpdated: string
    activityTeamMember: string
    activityNoteLinked: string
  }
  dialog: {
    projectEyebrow: string
    editProject: string
    newProject: string
    sectionBasic: string
    sectionTime: string
    sectionStyle: string
    fieldColor: string
    fieldTitle: string
    titlePlaceholder: string
    fieldGoal: string
    goalPlaceholder: string
    fieldDescription: string
    descPlaceholder: string
    fieldStatus: string
    fieldPriority: string
    fieldOwner: string
    unassigned: string
    fieldStartDate: string
    fieldDueDate: string
    fieldNextAction: string
    nextActionPlaceholder: string
    fieldRiskSummary: string
    riskPlaceholder: string
    cancel: string
    saveChanges: string
    createProject: string
    done: string
    peopleEyebrow: string
    editPerson: string
    addPerson: string
    fromContacts: string
    searchContacts: string
    noContactsMatch: string
    orFillManually: string
    fieldName: string
    namePlaceholder: string
    fieldRole: string
    roleOwner: string
    roleCollaborator: string
    roleReviewer: string
    roleExternal: string
    fieldPhone: string
    phonePlaceholder: string
    fieldEmail: string
    emailPlaceholder: string
    fieldNote: string
    notePlaceholder: string
    savePerson: string
    tasksEyebrow: string
    editTask: string
    addTask: string
    taskTitlePlaceholder: string
    taskDescPlaceholder: string
    taskStatusTodo: string
    taskStatusInProgress: string
    taskStatusDone: string
    saveTask: string
    priorityHigh: string
    priorityMedium: string
    priorityLow: string
    statusPlanning: string
    statusActive: string
    statusBlocked: string
    statusDone: string
    statusArchived: string
    moreOptions: string
    fewerOptions: string
    dueQuickToday: string
    dueQuickTomorrow: string
    dueQuickWeekend: string
    dueQuickNextWeek: string
    dueQuickIn30Days: string
    dueCustom: string
    dueClear: string
    titleRequiredHint: string
    savedJustNow: string
    savedAgo: string
    pillStatus: string
    pillPriority: string
    pillOwner: string
    pillDue: string
    pillColor: string
    pillStart: string
    descriptionPlaceholderShort: string
    goalPlaceholderShort: string
    titlePlaceholderHero: string
  }
}

const messages: Record<LanguageCode, ProjectsMessages> = {
  en: {
    tabs: {
      overview: 'Overview',
      tasks: 'Tasks',
      timeline: 'Timeline',
      people: 'People',
      notes: 'Notes',
    },
    page: {
      title: 'Projects',
      subtitle: 'Dedicated workspace for complex projects with clear goals and timelines',
      newProject: 'New Project',
      searchPlaceholder: 'Search projects...',
      filter: 'Filter',
      loading: 'Loading projects…',
      emptyTitle: 'No projects yet',
      emptyDesc: 'Create your first project workspace to organize tasks, people, timelines, and notes in one place.',
      createFirst: 'Create First Project',
      cardOwner: 'Owner',
      cardUnassigned: 'Unassigned',
      cardTimeline: 'Timeline',
      cardTBD: 'TBD',
      cardProgress: 'Progress',
      cardNextAction: 'Next Action',
      cardNextActionDefault: 'Review current plan',
      cardOpenWorkspace: 'Open project workspace',
    },
    filter: {
      statusLabel: 'Status',
      priorityLabel: 'Priority',
      healthLabel: 'Health',
      all: 'All',
      planning: 'Planning',
      active: 'Active',
      blocked: 'Blocked',
      done: 'Done',
      archived: 'Archived',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      onTrack: 'On Track',
      atRisk: 'At Risk',
    },
    health: {
      onTrack: 'On Track',
      atRisk: 'At Risk',
      blocked: 'Blocked',
    },
    status: {
      planning: 'Planning',
      active: 'Active',
      blocked: 'Blocked',
      done: 'Done',
      archived: 'Archived',
    },
    detail: {
      back: 'Projects',
      editTitle: 'Edit project',
      edit: 'Edit',
      archiveTitle: 'Archive project',
      archive: 'Archive',
      deleteTitle: 'Delete project',
      delete: 'Delete',
      deleteConfirm: 'Delete “{title}”? This cannot be undone.',
      cancel: 'Cancel',
      addTask: 'Add Task',
      noDescription: 'No project description yet.',
      unassigned: 'Unassigned',
      statTotal: 'Total',
      statDone: 'Done',
      statActive: 'Active',
      statOverdue: 'Overdue',
      projectSections: 'Project sections',
      statTotalTasks: 'TOTAL TASKS',
      statCompleted: 'COMPLETED',
      statInProgress: 'IN PROGRESS',
      statOverdueLabel: 'OVERDUE',
      nextAction: 'Next Action',
      nextActionDefault: 'Define the next meaningful step to move this project forward.',
      update: 'Update →',
      risksBlockers: 'Risks & Blockers',
      overdueWarning: '{{count}} task(s) are overdue and need attention.',
      noRisks: 'No critical risks recorded. Looking good!',
      recentActivity: 'Recent Activity',
      noActivity: 'No activity recorded yet.',
      loading: 'Loading project…',
      notFound: 'Project not found',
      allStatus: 'All Status',
      inProgress: 'In Progress',
      allOwners: 'All Owners',
      noTasksFiltered: 'No tasks match the current filters.',
      timeline: 'Timeline',
      week: 'Week',
      month: 'Month',
      year: 'Year',
      noTasksScheduled: 'No tasks scheduled yet.',
      team: 'Team',
      addPerson: 'Add Person',
      tasks: 'tasks',
      noContactInfo: 'No contact info',
      noTeamMembers: 'No team members yet. Add people to assign tasks.',
      notes: 'Notes',
      searchNotes: 'Search notes…',
      open: 'Open',
      unlink: 'Unlink',
      noLinkedNotes: 'No linked notes yet. Tag a note with project:{{id}} to link it here.',
      progressComplete: '{{progress}}% complete',
      activityTaskCompleted: '{{title}} completed',
      activityTaskUpdated: 'Task updated: {{title}}',
      activityTeamMember: 'Team member: {{name}}',
      activityNoteLinked: 'Note linked: {{title}}',
    },
    dialog: {
      projectEyebrow: 'Project',
      editProject: 'Edit Project',
      newProject: 'New Project',
      sectionBasic: 'Basics',
      sectionTime: 'Time & Owner',
      sectionStyle: 'Status & Style',
      fieldColor: 'Project Color',
      fieldTitle: 'Title',
      titlePlaceholder: 'Focus&go v2 Launch',
      fieldGoal: 'Goal',
      goalPlaceholder: 'Launch the next major version smoothly',
      fieldDescription: 'Description',
      descPlaceholder: 'Describe the project and what success looks like.',
      fieldStatus: 'Status',
      fieldPriority: 'Priority',
      fieldOwner: 'Owner',
      unassigned: 'Unassigned',
      fieldStartDate: 'Start Date',
      fieldDueDate: 'Due Date',
      fieldNextAction: 'Next Action',
      nextActionPlaceholder: 'Complete API integration testing',
      fieldRiskSummary: 'Risk Summary',
      riskPlaceholder: 'Timeline may be tight for final user testing.',
      cancel: 'Cancel',
      done: 'Done',
      saveChanges: 'Save Changes',
      createProject: 'Create Project',
      peopleEyebrow: 'People',
      editPerson: 'Edit Person',
      addPerson: 'Add Person',
      fromContacts: 'From Contacts',
      searchContacts: 'Search contacts…',
      noContactsMatch: 'No contacts match',
      orFillManually: 'or fill in manually',
      fieldName: 'Name',
      namePlaceholder: 'Sarah Chen',
      fieldRole: 'Role',
      roleOwner: 'Owner',
      roleCollaborator: 'Collaborator',
      roleReviewer: 'Reviewer',
      roleExternal: 'External',
      fieldPhone: 'Phone',
      phonePlaceholder: '+1 (555) 123-4567',
      fieldEmail: 'Email',
      emailPlaceholder: 'sarah@focusgo.com',
      fieldNote: 'Note',
      notePlaceholder: 'Owns launch decisions',
      savePerson: 'Save Person',
      tasksEyebrow: 'Tasks',
      editTask: 'Edit Task',
      addTask: 'Add Task',
      taskTitlePlaceholder: 'Complete API integration testing',
      taskDescPlaceholder: 'Describe what needs to happen next.',
      taskStatusTodo: 'Todo',
      taskStatusInProgress: 'In Progress',
      taskStatusDone: 'Done',
      saveTask: 'Save Task',
      priorityHigh: 'High',
      priorityMedium: 'Medium',
      priorityLow: 'Low',
      statusPlanning: 'Planning',
      statusActive: 'Active',
      statusBlocked: 'Blocked',
      statusDone: 'Done',
      statusArchived: 'Archived',
      moreOptions: 'More options',
      fewerOptions: 'Fewer options',
      dueQuickToday: 'Today',
      dueQuickTomorrow: 'Tomorrow',
      dueQuickWeekend: 'This weekend',
      dueQuickNextWeek: 'Next Monday',
      dueQuickIn30Days: 'In 30 days',
      dueCustom: 'Pick a date',
      dueClear: 'Clear',
      titleRequiredHint: 'A title is needed',
      savedJustNow: 'Saved · just now',
      savedAgo: 'Saved · {{n}}s ago',
      pillStatus: 'Status',
      pillPriority: 'Priority',
      pillOwner: 'Owner',
      pillDue: 'Due date',
      pillColor: 'Color',
      pillStart: 'Start date',
      descriptionPlaceholderShort: 'What does success look like?',
      goalPlaceholderShort: 'Add a goal (optional)',
      titlePlaceholderHero: 'Untitled project',
    },
  },
  zh: {
    tabs: {
      overview: '概览',
      tasks: '任务',
      timeline: '时间线',
      people: '成员',
      notes: '笔记',
    },
    page: {
      title: '项目',
      subtitle: '专为复杂项目打造的专属工作区，目标清晰，时间线明确',
      newProject: '新建项目',
      searchPlaceholder: '搜索项目...',
      filter: '筛选',
      loading: '加载项目中…',
      emptyTitle: '还没有项目',
      emptyDesc: '创建第一个项目工作区，在一个地方管理任务、成员、时间线和笔记。',
      createFirst: '创建第一个项目',
      cardOwner: '负责人',
      cardUnassigned: '未分配',
      cardTimeline: '时间线',
      cardTBD: '待定',
      cardProgress: '进度',
      cardNextAction: '下一步',
      cardNextActionDefault: '回顾当前计划',
      cardOpenWorkspace: '打开项目工作区',
    },
    filter: {
      statusLabel: '状态',
      priorityLabel: '优先级',
      healthLabel: '健康度',
      all: '全部',
      planning: '规划中',
      active: '进行中',
      blocked: '受阻',
      done: '已完成',
      archived: '已归档',
      high: '高',
      medium: '中',
      low: '低',
      onTrack: '正常',
      atRisk: '有风险',
    },
    health: {
      onTrack: '正常',
      atRisk: '有风险',
      blocked: '受阻',
    },
    status: {
      planning: '规划中',
      active: '进行中',
      blocked: '受阻',
      done: '已完成',
      archived: '已归档',
    },
    detail: {
      back: '项目',
      editTitle: '编辑项目',
      edit: '编辑',
      archiveTitle: '归档项目',
      archive: '归档',
      deleteTitle: '删除项目',
      delete: '删除',
      deleteConfirm: '删除“{title}”？此操作不可撤销。',
      cancel: '取消',
      addTask: '添加任务',
      noDescription: '暂无项目描述。',
      unassigned: '未分配',
      statTotal: '总计',
      statDone: '已完成',
      statActive: '进行中',
      statOverdue: '已逾期',
      projectSections: '项目分区',
      statTotalTasks: '任务总数',
      statCompleted: '已完成',
      statInProgress: '进行中',
      statOverdueLabel: '已逾期',
      nextAction: '下一步',
      nextActionDefault: '明确推动项目向前的下一个关键步骤。',
      update: '更新 →',
      risksBlockers: '风险与阻碍',
      overdueWarning: '{{count}} 个任务已逾期，需要处理。',
      noRisks: '暂无严重风险，一切顺利！',
      recentActivity: '近期动态',
      noActivity: '暂无活动记录。',
      loading: '加载项目中…',
      notFound: '未找到项目',
      allStatus: '全部状态',
      inProgress: '进行中',
      allOwners: '全部负责人',
      noTasksFiltered: '没有符合当前筛选条件的任务。',
      timeline: '时间线',
      week: '周',
      month: '月',
      year: '年',
      noTasksScheduled: '暂无已排期的任务。',
      team: '团队',
      addPerson: '添加成员',
      tasks: '个任务',
      noContactInfo: '无联系方式',
      noTeamMembers: '还没有团队成员，添加成员后可分配任务。',
      notes: '笔记',
      searchNotes: '搜索笔记…',
      open: '打开',
      unlink: '取消关联',
      noLinkedNotes: '暂无关联笔记。在笔记中添加标签 project:{{id}} 即可关联。',
      progressComplete: '{{progress}}% 已完成',
      activityTaskCompleted: '{{title}} 已完成',
      activityTaskUpdated: '任务更新：{{title}}',
      activityTeamMember: '团队成员：{{name}}',
      activityNoteLinked: '已关联笔记：{{title}}',
    },
    dialog: {
      projectEyebrow: '项目',
      editProject: '编辑项目',
      newProject: '新建项目',
      sectionBasic: '基本信息',
      sectionTime: '时间与负责人',
      sectionStyle: '状态与样式',
      fieldColor: '项目颜色',
      fieldTitle: '标题',
      titlePlaceholder: 'Focus&go v2 发布',
      fieldGoal: '目标',
      goalPlaceholder: '顺利发布下一个重要版本',
      fieldDescription: '描述',
      descPlaceholder: '描述项目内容及成功的标准。',
      fieldStatus: '状态',
      fieldPriority: '优先级',
      fieldOwner: '负责人',
      unassigned: '未分配',
      fieldStartDate: '开始日期',
      fieldDueDate: '截止日期',
      fieldNextAction: '下一步',
      nextActionPlaceholder: '完成 API 集成测试',
      fieldRiskSummary: '风险摘要',
      riskPlaceholder: '最终用户测试的时间可能比较紧张。',
      cancel: '取消',
      done: '完成',
      saveChanges: '保存更改',
      createProject: '创建项目',
      peopleEyebrow: '成员',
      editPerson: '编辑成员',
      addPerson: '添加成员',
      fromContacts: '从联系人导入',
      searchContacts: '搜索联系人…',
      noContactsMatch: '没有匹配的联系人',
      orFillManually: '或手动填写',
      fieldName: '姓名',
      namePlaceholder: '陈晓明',
      fieldRole: '角色',
      roleOwner: '负责人',
      roleCollaborator: '协作者',
      roleReviewer: '审核者',
      roleExternal: '外部人员',
      fieldPhone: '电话',
      phonePlaceholder: '+86 138 0000 0000',
      fieldEmail: '邮箱',
      emailPlaceholder: 'example@focusgo.com',
      fieldNote: '备注',
      notePlaceholder: '负责发布决策',
      savePerson: '保存成员',
      tasksEyebrow: '任务',
      editTask: '编辑任务',
      addTask: '添加任务',
      taskTitlePlaceholder: '完成 API 集成测试',
      taskDescPlaceholder: '描述下一步需要做的事情。',
      taskStatusTodo: '待办',
      taskStatusInProgress: '进行中',
      taskStatusDone: '已完成',
      saveTask: '保存任务',
      priorityHigh: '高',
      priorityMedium: '中',
      priorityLow: '低',
      statusPlanning: '规划中',
      statusActive: '进行中',
      statusBlocked: '受阻',
      statusDone: '已完成',
      statusArchived: '已归档',
      moreOptions: '更多选项',
      fewerOptions: '收起',
      dueQuickToday: '今天',
      dueQuickTomorrow: '明天',
      dueQuickWeekend: '本周末',
      dueQuickNextWeek: '下周一',
      dueQuickIn30Days: '+30 天',
      dueCustom: '自定义',
      dueClear: '清除',
      titleRequiredHint: '需要一个标题',
      savedJustNow: '已保存 · 刚刚',
      savedAgo: '已保存 · {{n}} 秒前',
      pillStatus: '状态',
      pillPriority: '优先级',
      pillOwner: '负责人',
      pillDue: '截止日期',
      pillColor: '颜色',
      pillStart: '开始日期',
      descriptionPlaceholderShort: '怎样算成功？',
      goalPlaceholderShort: '加一个目标（可选）',
      titlePlaceholderHero: '未命名项目',
    },
  },
}

const interpolate = (template: string, values?: Record<string, string | number>) => {
  if (!values) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(values[key] ?? `{{${key}}}`))
}

export type ProjectsI18n = ProjectsMessages & {
  t: (template: string, values?: Record<string, string | number>) => string
}

export const useProjectsI18n = () => {
  const { language } = usePreferences()
  return useMemo(() => {
    const m = messages[language] ?? messages.en
    return { ...m, t: interpolate }
  }, [language])
}
