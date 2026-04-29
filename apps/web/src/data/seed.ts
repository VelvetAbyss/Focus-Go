import { dashboardRepo } from './repositories/dashboardRepo'
import { diaryRepo } from './repositories/diaryRepo'
import { focusRepo } from './repositories/focusRepo'
import { lifeDashboardRepo } from './repositories/lifeDashboardRepo'
import { notesRepo } from './repositories/notesRepo'
import { projectPeopleRepo } from './repositories/projectPeopleRepo'
import { projectsRepo, projectTagName } from './repositories/projectsRepo'
import { spendRepo } from './repositories/spendRepo'
import { syncedPreferencesRepo } from './repositories/syncedPreferencesRepo'
import { tasksRepo } from './repositories/tasksRepo'
import { widgetTodoRepo } from './repositories/widgetTodoRepo'
import { toDateKey } from '../shared/utils/time'
import { createId } from '../shared/utils/ids'
import { readLanguage } from '../shared/prefs/preferences'
import { ensureLabsSeed } from '../features/labs/labsApi'
import { getAuth } from '../store/auth'
import { claimInitialSeed } from './sync/seedClaim'
import type { LanguageCode } from '../shared/i18n/types'
import type { TaskPriority, TaskStatus } from './models/types'
import {
  DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
  DEFAULT_DASHBOARD_LAYOUT_ITEMS,
  DEFAULT_DASHBOARD_THEME_OVERRIDE,
} from './defaultDashboardLayout'

const DEFAULT_LIFE_LAYOUT_ITEMS = [
  { key: 'library', x: 5, y: 3, w: 6, h: 8 },
  { key: 'media_card', x: 5, y: 17, w: 6, h: 7 },
  { key: 'subscriptions_card', x: 18, y: 24, w: 6, h: 7 },
  { key: 'daily_review', x: 11, y: 32, w: 7, h: 7 },
  { key: 'trips_card', x: 18, y: 7, w: 6, h: 8 },
  { key: 'podcast_card', x: 0, y: 24, w: 5, h: 15 },
  { key: 'people_card', x: 11, y: 39, w: 7, h: 8 },
]

const DEFAULT_LIFE_HIDDEN_CARD_IDS = ['stocks']

const addDaysKey = (base: Date, days: number) => {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return toDateKey(next)
}

const makeSubtask = (title: string, done = false) => ({
  id: createId(),
  title,
  done,
})

type ProjectTaskSeed = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  ownerIndex?: number
  startOffset: number
  dueOffset: number
  tags: string[]
  subtasks: Array<{ title: string; done?: boolean }>
  isBlocked?: boolean
}

const getSeedCopy = (language: LanguageCode) => {
  if (language === 'zh') {
    return {
      onboardingTask: {
        title: '开始使用 Focus&go',
        description: '按顺序完成这份清单，快速体验任务、专注、日记、笔记、项目和设置。',
        note: [
          '欢迎来到 Focus&go。',
          '',
          '这条任务会带你体验核心工作流。打开任务详情后，你可以编辑描述、优先级、今天标记、日期、提醒、项目、标签、子任务和这块富文本备注。',
          '',
          '建议做法：先勾掉已经完成的子任务，再把这条任务拖到进行中或完成。'
        ].join('\n'),
        subtasks: [
          '在任务看板中新建或整理一条任务',
          '把重要任务加入 Today',
          '设置截止日期和提醒',
          '添加标签与子任务',
          '进入 Focus 开始一次 25 分钟专注',
          '在 Diary 写下今天的复盘',
          '回到 Dashboard 查看你的日程和组件',
          '打开 Note，创建或编辑一条笔记',
          '进入 Project，查看示例项目的任务、时间线、成员和笔记',
          '到 Settings 调整语言、主题和数据偏好',
        ],
      },
      widgetTodoTitle: '今天保持轻量：一个重点任务，一次专注，一段复盘。',
      diaryContent: '## 今天\n- 选择一件值得完成的事\n- 预留一次专注时间\n- 晚上写一段复盘',
      spendCategory: '生活',
      spendNote: '任务间隙的简餐',
      project: {
        title: '示例项目：个人效率系统上线',
        description: '这个示例项目展示目标、状态、优先级、时间线、成员、任务进度、风险和关联笔记如何协同工作。',
        goal: '用 Focus&go 搭建一套从计划、执行到复盘的个人工作流。',
        nextAction: '完成任务清单梳理，并把关键事项安排到本周时间线。',
        riskSummary: '时间安排偏紧；如果任务过多，先保留最重要的三件事。',
      },
      people: [
        { name: '你', roleType: 'owner' as const, email: 'you@example.com', note: '项目负责人，决定目标和优先级。' },
        { name: 'Alex Chen', roleType: 'collaborator' as const, email: 'alex@example.com', note: '协助整理流程和检查体验。' },
        { name: 'Mia Wang', roleType: 'reviewer' as const, email: 'mia@example.com', note: '负责在发布前做一次快速评审。' },
      ],
      projectTasks: [
        {
          title: '定义本周最重要的结果',
          description: '写下这个项目完成后应该出现的可观察结果。',
          status: 'done' as const,
          priority: 'high' as const,
          ownerIndex: 0,
          startOffset: -2,
          dueOffset: -1,
          tags: ['project', 'planning'],
          subtasks: [
            { title: '写出项目目标', done: true },
            { title: '确认完成标准', done: true },
          ],
        },
        {
          title: '整理任务看板和时间线',
          description: '把待办拆成可执行任务，并为每个任务设置负责人和日期。',
          status: 'doing' as const,
          priority: 'high' as const,
          ownerIndex: 1,
          startOffset: 0,
          dueOffset: 3,
          tags: ['project', 'timeline'],
          subtasks: [
            { title: '创建项目任务', done: true },
            { title: '检查时间线视图' },
            { title: '补充下一步行动' },
          ],
        },
        {
          title: '记录一次项目会议笔记',
          description: '用 project 标签把 Note 关联到项目，方便在项目详情里回看。',
          status: 'todo' as const,
          priority: 'medium' as const,
          ownerIndex: 0,
          startOffset: 2,
          dueOffset: 5,
          tags: ['project', 'note'],
          subtasks: [
            { title: '创建会议笔记' },
            { title: '添加项目标签' },
          ],
        },
        {
          title: '等待评审反馈',
          description: '这条任务用于展示项目中的阻塞状态和风险提示。',
          status: 'todo' as const,
          priority: 'medium' as const,
          ownerIndex: 2,
          startOffset: 5,
          dueOffset: 7,
          tags: ['project', 'review'],
          subtasks: [{ title: '收集评审意见' }],
          isBlocked: true,
        },
      ] satisfies ProjectTaskSeed[],
      projectNote: {
        title: '项目笔记：个人效率系统上线',
        content: [
          '# 项目笔记：个人效率系统上线',
          '',
          '这条笔记通过项目标签关联到示例项目。',
          '',
          '## 会议摘要',
          '- 先完成任务拆解和时间线',
          '- 用成员列表记录负责人和评审人',
          '- 每周用 Note 沉淀关键决策',
          '',
          '## 风险',
          '> 如果任务太多，先保留最重要的三件事。',
        ].join('\n'),
      },
      welcomeNote: {
        title: '欢迎使用 Note',
        content: [
          '# 欢迎使用 Note',
          '',
          'Note 适合记录想法、会议、研究、清单和项目资料。你可以写 Markdown，也可以在编辑器里直接排版。',
          '',
          '## 你可以这样用',
          '- 用标题建立结构',
          '- 用标签整理主题',
          '- 置顶重要笔记',
          '- 在信息面板查看字数、段落和目录',
          '- 调整外观、字体、宽度和纸张背景',
          '- 导出 Markdown，或把不用的笔记移入回收站',
          '',
          '## 清单示例',
          '- [ ] 写一个想法',
          '- [ ] 添加一个标签',
          '- [ ] 试试导出',
          '',
          '## 表格示例',
          '| 功能 | 用途 |',
          '| --- | --- |',
          '| 标签 | 归类笔记 |',
          '| 项目标签 | 关联到 Project |',
          '| 外观 | 调整阅读体验 |',
          '',
          '> 给笔记添加 project:<项目ID> 标签后，它会出现在对应项目的 Notes 标签页。',
        ].join('\n'),
      },
    }
  }

  return {
    onboardingTask: {
      title: 'Get started with Focus&go',
      description: 'Work through this checklist to try tasks, focus, diary, notes, projects, and settings.',
      note: [
        'Welcome to Focus&go.',
        '',
        'This task walks you through the core workflow. In task details, you can edit the description, priority, Today state, dates, reminders, project, tags, subtasks, and this rich-text note.',
        '',
        'Suggested flow: check off completed subtasks, then move this task into Doing or Done.',
      ].join('\n'),
      subtasks: [
        'Create or organize a task on the board',
        'Add an important task to Today',
        'Set a due date and reminder',
        'Add tags and subtasks',
        'Start a 25-minute Focus session',
        'Write a quick Diary review',
        'Return to Dashboard and review your widgets',
        'Open Note and create or edit a note',
        'Open Project and inspect tasks, timeline, people, and notes',
        'Visit Settings to adjust language, theme, and data preferences',
      ],
    },
    widgetTodoTitle: 'Keep today light: one key task, one focus session, one review.',
    diaryContent: '## Today\n- Chose one thing worth finishing\n- Left room for a focused session later\n- Wrote a short evening review',
    spendCategory: 'Life',
    spendNote: 'Quick lunch between tasks',
    project: {
      title: 'Sample Project: Launch a Personal Productivity System',
      description: 'This sample project shows how goals, status, priority, timeline, people, task progress, risks, and linked notes work together.',
      goal: 'Build a Focus&go workflow that carries work from planning, through execution, into review.',
      nextAction: 'Finish the task breakdown and place the key actions on this week timeline.',
      riskSummary: 'The schedule is tight; if the list grows, keep only the three highest-leverage actions.',
    },
    people: [
      { name: 'You', roleType: 'owner' as const, email: 'you@example.com', note: 'Project owner; sets goals and priorities.' },
      { name: 'Alex Chen', roleType: 'collaborator' as const, email: 'alex@example.com', note: 'Helps shape the workflow and check the experience.' },
      { name: 'Mia Wang', roleType: 'reviewer' as const, email: 'mia@example.com', note: 'Runs a quick review before launch.' },
    ],
    projectTasks: [
      {
        title: 'Define the most important outcome',
        description: 'Write the observable result this project should produce.',
        status: 'done' as const,
        priority: 'high' as const,
        ownerIndex: 0,
        startOffset: -2,
        dueOffset: -1,
        tags: ['project', 'planning'],
        subtasks: [
          { title: 'Write the project goal', done: true },
          { title: 'Confirm the completion criteria', done: true },
        ],
      },
      {
        title: 'Organize the task board and timeline',
        description: 'Break the work into actionable tasks, then assign owners and dates.',
        status: 'doing' as const,
        priority: 'high' as const,
        ownerIndex: 1,
        startOffset: 0,
        dueOffset: 3,
        tags: ['project', 'timeline'],
        subtasks: [
          { title: 'Create project tasks', done: true },
          { title: 'Check the timeline view' },
          { title: 'Add the next action' },
        ],
      },
      {
        title: 'Capture one project meeting note',
        description: 'Use a project tag to link a Note back into this project workspace.',
        status: 'todo' as const,
        priority: 'medium' as const,
        ownerIndex: 0,
        startOffset: 2,
        dueOffset: 5,
        tags: ['project', 'note'],
        subtasks: [
          { title: 'Create the meeting note' },
          { title: 'Add the project tag' },
        ],
      },
      {
        title: 'Wait for review feedback',
        description: 'This task demonstrates blocked work and project risk signals.',
        status: 'todo' as const,
        priority: 'medium' as const,
        ownerIndex: 2,
        startOffset: 5,
        dueOffset: 7,
        tags: ['project', 'review'],
        subtasks: [{ title: 'Collect review comments' }],
        isBlocked: true,
      },
    ] satisfies ProjectTaskSeed[],
    projectNote: {
      title: 'Project Note: Personal Productivity System',
      content: [
        '# Project Note: Personal Productivity System',
        '',
        'This note is linked to the sample project through a project tag.',
        '',
        '## Meeting summary',
        '- Finish task breakdown and timeline first',
        '- Use people to track owners and reviewers',
        '- Capture key decisions in Notes each week',
        '',
        '## Risk',
        '> If the task list grows, keep only the three highest-leverage actions.',
      ].join('\n'),
    },
    welcomeNote: {
      title: 'Welcome to Notes',
      content: [
        '# Welcome to Notes',
        '',
        'Notes are useful for ideas, meetings, research, lists, and project material. You can write Markdown or format directly in the editor.',
        '',
        '## Ways to use Notes',
        '- Structure writing with headings',
        '- Organize topics with tags',
        '- Pin important notes',
        '- Open the info panel for word count, paragraphs, and outline',
        '- Adjust appearance, font, width, and paper background',
        '- Export Markdown or move unused notes to trash',
        '',
        '## Checklist example',
        '- [ ] Write an idea',
        '- [ ] Add a tag',
        '- [ ] Try export',
        '',
        '## Table example',
        '| Feature | Use |',
        '| --- | --- |',
        '| Tags | Group notes |',
        '| Project tags | Link notes to Project |',
        '| Appearance | Tune the reading experience |',
        '',
        '> Add a project:<projectId> tag to make a note appear in the matching Project Notes tab.',
      ].join('\n'),
    },
  }
}

const hasExistingSeedSurfaceData = async () => {
  const [tasks, widgetTodos, diaryEntries, spendEntries, spendCategories, focusSettings, projects, notes] = await Promise.all([
    tasksRepo.list(),
    widgetTodoRepo.list(),
    diaryRepo.list(),
    spendRepo.listEntries(),
    spendRepo.listCategories(),
    focusRepo.get(),
    projectsRepo.list(),
    notesRepo.list(),
  ])
  return (
    tasks.length > 0 ||
    widgetTodos.length > 0 ||
    diaryEntries.length > 0 ||
    spendEntries.length > 0 ||
    spendCategories.length > 0 ||
    focusSettings !== null ||
    projects.length > 0 ||
    notes.length > 0
  )
}

export const seedDatabase = async () => {
  await ensureLabsSeed()
  const initialSeedCompletedAt = await syncedPreferencesRepo.getInitialSeedCompletedAt()
  if (initialSeedCompletedAt) return false

  if (await hasExistingSeedSurfaceData()) {
    await syncedPreferencesRepo.markInitialSeedCompleted()
    return false
  }

  // Server-authoritative gate: only the first claim across all devices/sessions
  // wins. Skips entirely for logged-out users (no account = no demo seed),
  // which prevents anonymous local writes from being pushed as duplicates the
  // moment the user signs in.
  if (!getAuth()?.user) return false
  try {
    const { shouldSeed } = await claimInitialSeed()
    if (!shouldSeed) {
      await syncedPreferencesRepo.markInitialSeedCompleted()
      return false
    }
  } catch (err) {
    // If the claim endpoint is unreachable, do not seed — better to show an
    // empty state than to risk re-seeding after a transient network error.
    console.warn('[seed] claim failed, skipping seed:', err)
    return false
  }

  const language = readLanguage()
  const copy = getSeedCopy(language)
  const today = new Date()
  const todayKey = addDaysKey(today, 0)
  const tomorrowKey = addDaysKey(today, 1)

  await tasksRepo.add({
    title: copy.onboardingTask.title,
    description: copy.onboardingTask.description,
    status: 'todo',
    priority: 'high',
    dueDate: tomorrowKey,
    reminderAt: Date.now() + 3 * 60 * 60 * 1000,
    tags: ['today', 'onboarding'],
    isToday: true,
    subtasks: copy.onboardingTask.subtasks.map((title) => makeSubtask(title)),
    taskNoteContentMd: copy.onboardingTask.note,
  })

  const project = await projectsRepo.create({
    title: copy.project.title,
    description: copy.project.description,
    goal: copy.project.goal,
    status: 'active',
    priority: 'high',
    startDate: todayKey,
    dueDate: addDaysKey(today, 14),
    nextAction: copy.project.nextAction,
    riskSummary: copy.project.riskSummary,
  })

  const people = await Promise.all(
    copy.people.map((person) => projectPeopleRepo.create({
      projectId: project.id,
      ...person,
    })),
  )

  await Promise.all(
    copy.projectTasks.map((task) => tasksRepo.add({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      projectId: project.id,
      ownerId: typeof task.ownerIndex === 'number' ? people[task.ownerIndex]?.id : undefined,
      startDate: addDaysKey(today, task.startOffset),
      dueDate: addDaysKey(today, task.dueOffset),
      tags: task.tags,
      isBlocked: task.isBlocked,
      subtasks: task.subtasks.map((subtask) => makeSubtask(subtask.title, 'done' in subtask ? subtask.done === true : false)),
    })),
  )

  await notesRepo.create({
    title: copy.projectNote.title,
    contentMd: copy.projectNote.content,
    contentJson: null,
    tags: [projectTagName(project.id), 'Projects'],
  })

  await notesRepo.create({
    title: copy.welcomeNote.title,
    contentMd: copy.welcomeNote.content,
    contentJson: null,
    tags: ['Ideas'],
    pinned: true,
  })

  await widgetTodoRepo.add({
    scope: 'day',
    title: copy.widgetTodoTitle,
    priority: 'medium',
    dueDate: tomorrowKey,
    done: false,
  })

  await diaryRepo.add({
    dateKey: todayKey,
    entryAt: Date.now(),
    contentMd: copy.diaryContent,
    contentJson: null,
    tags: ['daily'],
    weatherSnapshot: null,
    deletedAt: null,
    expiredAt: null,
  })

  const lifeCategory = await spendRepo.addCategory({ name: copy.spendCategory, icon: 'WalletCards' })

  await spendRepo.addEntry({
    amount: 32,
    currency: 'CNY',
    categoryId: lifeCategory.id,
    note: copy.spendNote,
    dateKey: todayKey,
  })

  await focusRepo.upsert({
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    noise: {
      playing: false,
      loop: true,
      masterVolume: 0.6,
      tracks: {
        cafe: { enabled: false, volume: 0.3 },
        fireplace: { enabled: false, volume: 0.3 },
        rain: { enabled: false, volume: 0.3 },
        wind: { enabled: false, volume: 0.3 },
        thunder: { enabled: false, volume: 0.3 },
        ocean: { enabled: false, volume: 0.3 },
      },
    },
    noisePreset: {
      presetId: 'default',
      presetName: 'Default',
      scope: 'focus-center',
      isPlaying: false,
      loop: true,
      tracks: {
        cafe: { enabled: false, volume: 0.6 },
        fireplace: { enabled: true, volume: 0.6 },
        rain: { enabled: true, volume: 0.6 },
        wind: { enabled: true, volume: 0.6 },
        thunder: { enabled: true, volume: 0.6 },
        ocean: { enabled: true, volume: 0.6 },
      },
    },
  })

  await dashboardRepo.upsert({
    items: DEFAULT_DASHBOARD_LAYOUT_ITEMS,
    hiddenCardIds: DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
    themeOverride: DEFAULT_DASHBOARD_THEME_OVERRIDE,
  })

  await lifeDashboardRepo.upsert({
    items: DEFAULT_LIFE_LAYOUT_ITEMS,
    hiddenCardIds: DEFAULT_LIFE_HIDDEN_CARD_IDS,
  })

  await syncedPreferencesRepo.markInitialSeedCompleted()
  return true
}
