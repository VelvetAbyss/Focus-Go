import { useMemo } from 'react'
import { useI18n } from '../../shared/i18n/useI18n'

type AdminLanguage = 'en' | 'zh'

type Messages = {
  title: string
  subtitle: string
  refresh: string
  refreshing: string
  autoRefresh: string
  updatedAt: string
  loadFailed: string
  loading: string
  noUsers: string
  overview: string
  users: string
  orders: string
  server: string
  feedback: string
  tabAria: string
  allPlans: string
  allStatuses: string
  searchEmail: string
  sortBy: string
  sortRecords: string
  sortNewest: string
  sortSyncSize: string
  email: string
  plan: string
  status: string
  joined: string
  lastActive: string
  active7d: string
  active30d: string
  records: string
  syncSize: string
  health: string
  details: string
  collapse: string
  noSyncDetails: string
  noOrders: string
  searchOrders: string
  allChannels: string
  exportCsv: string
  orderNo: string
  amount: string
  channel: string
  paidAt: string
  providerOrder: string
  providerPayment: string
  netAmount: string
  feeAmount: string
  abnormalReason: string
  abnormalReasonPrompt: string
  markAbnormal: string
  grantPro: string
  grantProYearly: string
  grantLifetime: string
  grantReason: string
  revokeEntitlement: string
  revokeWarning: string
  totalUsers: string
  premiumUsers: string
  activeUsers7d: string
  activeUsers30d: string
  payload: string
  blobs: string
  dbSize: string
  uptime: string
  loadAvg: string
  memory: string
  processRss: string
  dbFileSize: string
  free: string
  premium: string
  active: string
  inactive: string
  suspended: string
  deletionPending: string
  unknownError: string
  yes: string
  no: string
  healthy: string
  dormant: string
  risk: string
  empty: string
  suspend: string
  unsuspend: string
  suspendReason: string
  requestDeletion: string
  cancelDeletion: string
  deletionPreview: string
  purge: string
  purgeConfirmPrompt: string
  deletionPendingAt: string
  deletionEligibleAt: string
  coolingWindow: string
  notes: string
  addNote: string
  noteBodyPlaceholder: string
  deleteNote: string
  tags: string
  tagsPlaceholder: string
  diagnostics: string
  auditLogs: string
  entitlements: string
  noEntitlements: string
  noNotes: string
  noAuditLogs: string
  feedbackInbox: string
  noFeedback: string
  feedbackType: string
  feedbackStatusLabel: string
  feedbackPriority: string
  feedbackNew: string
  feedbackReviewing: string
  feedbackPlanned: string
  feedbackShipped: string
  feedbackClosed: string
  typeFeatureRequest: string
  typeBug: string
  typeConfusion: string
  typePraise: string
  allTypes: string
  loadingDetail: string
  viewDetail: string
  source: string
  expiresAt: string
  lifetime: string
}

const messages: Record<AdminLanguage, Messages> = {
  en: {
    title: 'Command Deck',
    subtitle: 'Warm, calm, all-day operational view.',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    autoRefresh: 'Auto refresh',
    updatedAt: 'Updated',
    loadFailed: 'Failed to load',
    loading: 'Loading command deck…',
    noUsers: 'No users yet.',
    overview: 'Overview',
    users: 'Users',
    orders: 'Orders',
    server: 'Server',
    feedback: 'Feedback',
    tabAria: 'Admin sections',
    allPlans: 'All plans',
    allStatuses: 'All statuses',
    searchEmail: 'Search by email',
    sortBy: 'Sort by',
    sortRecords: 'Most records',
    sortNewest: 'Newest join',
    sortSyncSize: 'Largest sync',
    email: 'Email',
    plan: 'Plan',
    status: 'Status',
    joined: 'Joined',
    lastActive: 'Last active',
    active7d: '7d',
    active30d: '30d',
    records: 'Records',
    syncSize: 'Sync size',
    health: 'Health',
    details: 'Details',
    collapse: 'Collapse',
    noSyncDetails: 'No sync type details.',
    noOrders: 'No orders match the current filters.',
    searchOrders: 'Search order, email, provider id',
    allChannels: 'All channels',
    exportCsv: 'Export CSV',
    orderNo: 'Order no.',
    amount: 'Amount',
    channel: 'Channel',
    paidAt: 'Paid at',
    providerOrder: 'Provider order',
    providerPayment: 'Provider payment',
    netAmount: 'Net amount',
    feeAmount: 'Fee',
    abnormalReason: 'Abnormal reason',
    abnormalReasonPrompt: 'Reason for marking this order abnormal',
    markAbnormal: 'Mark abnormal',
    grantPro: 'Grant Pro',
    grantProYearly: 'Grant Yearly',
    grantLifetime: 'Grant Lifetime',
    grantReason: 'Reason (optional)',
    revokeEntitlement: 'Revoke',
    revokeWarning: 'This will not cancel any active payment orders.',
    totalUsers: 'Total users',
    premiumUsers: 'Premium users',
    activeUsers7d: 'Active 7d',
    activeUsers30d: 'Active 30d',
    payload: 'Payload',
    blobs: 'Blobs',
    dbSize: 'DB size',
    uptime: 'Uptime',
    loadAvg: 'Load avg (1/5/15m)',
    memory: 'Memory',
    processRss: 'Process RSS',
    dbFileSize: 'DB file size',
    free: 'Free',
    premium: 'Premium',
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    deletionPending: 'Deletion Pending',
    unknownError: 'Unknown error',
    yes: 'Yes',
    no: 'No',
    healthy: 'Healthy',
    dormant: 'Dormant',
    risk: 'Risk',
    empty: 'Empty',
    suspend: 'Suspend',
    unsuspend: 'Unsuspend',
    suspendReason: 'Reason for suspension',
    requestDeletion: 'Request Deletion',
    cancelDeletion: 'Cancel Deletion',
    deletionPreview: 'Preview Deletion Impact',
    purge: 'Hard Purge',
    purgeConfirmPrompt: 'Type user email to confirm',
    deletionPendingAt: 'Pending since',
    deletionEligibleAt: 'Eligible for purge after',
    coolingWindow: '7-day cooling window',
    notes: 'Admin Notes',
    addNote: 'Add note',
    noteBodyPlaceholder: 'e.g. test account, manually granted — promo campaign',
    deleteNote: 'Delete',
    tags: 'Tags',
    tagsPlaceholder: 'e.g. test-account, vip, spam-risk',
    diagnostics: 'Diagnostics',
    auditLogs: 'Audit Log',
    entitlements: 'Entitlements',
    noEntitlements: 'No entitlements.',
    noNotes: 'No notes yet.',
    noAuditLogs: 'No audit log entries.',
    feedbackInbox: 'Feedback Inbox',
    noFeedback: 'No feedback yet.',
    feedbackType: 'Type',
    feedbackStatusLabel: 'Status',
    feedbackPriority: 'Priority',
    feedbackNew: 'New',
    feedbackReviewing: 'Reviewing',
    feedbackPlanned: 'Planned',
    feedbackShipped: 'Shipped',
    feedbackClosed: 'Closed',
    typeFeatureRequest: 'Feature Request',
    typeBug: 'Bug',
    typeConfusion: 'Confusion',
    typePraise: 'Praise',
    allTypes: 'All types',
    loadingDetail: 'Loading user details…',
    viewDetail: 'Manage',
    source: 'Source',
    expiresAt: 'Expires',
    lifetime: 'Lifetime',
  },
  zh: {
    title: '管理指挥台',
    subtitle: '温和、稳定、可全天候运行的管理视图。',
    refresh: '刷新',
    refreshing: '刷新中…',
    autoRefresh: '自动刷新',
    updatedAt: '更新于',
    loadFailed: '加载失败',
    loading: '正在加载管理指挥台…',
    noUsers: '暂无用户。',
    overview: '总览',
    users: '用户',
    orders: '订单',
    server: '服务端',
    feedback: '用户反馈',
    tabAria: '管理分区',
    allPlans: '全部套餐',
    allStatuses: '全部状态',
    searchEmail: '按邮箱搜索',
    sortBy: '排序',
    sortRecords: '记录数最多',
    sortNewest: '最新加入',
    sortSyncSize: '同步体积最大',
    email: '邮箱',
    plan: '套餐',
    status: '状态',
    joined: '加入时间',
    lastActive: '最近活跃',
    active7d: '7天',
    active30d: '30天',
    records: '记录数',
    syncSize: '同步体积',
    health: '健康度',
    details: '详情',
    collapse: '收起',
    noSyncDetails: '暂无按类型同步明细。',
    noOrders: '当前筛选条件下暂无订单。',
    searchOrders: '搜索订单、邮箱、渠道订单号',
    allChannels: '全部渠道',
    exportCsv: '导出 CSV',
    orderNo: '订单号',
    amount: '金额',
    channel: '渠道',
    paidAt: '支付时间',
    providerOrder: '渠道订单',
    providerPayment: '渠道支付号',
    netAmount: '实际到账',
    feeAmount: '手续费',
    abnormalReason: '异常原因',
    abnormalReasonPrompt: '请输入标记异常的原因',
    markAbnormal: '标记异常',
    grantPro: '补发 Pro',
    grantProYearly: '补发年付',
    grantLifetime: '授予 Lifetime',
    grantReason: '授权原因（可选）',
    revokeEntitlement: '撤销',
    revokeWarning: '撤销权益不会取消任何有效的支付订单。',
    totalUsers: '总用户',
    premiumUsers: '高级用户',
    activeUsers7d: '7天活跃',
    activeUsers30d: '30天活跃',
    payload: '同步载荷',
    blobs: 'Blob 数量',
    dbSize: '数据库体积',
    uptime: '运行时长',
    loadAvg: '负载均值 (1/5/15m)',
    memory: '内存',
    processRss: '进程 RSS',
    dbFileSize: '数据库文件',
    free: '免费版',
    premium: '高级版',
    active: '活跃',
    inactive: '不活跃',
    suspended: '已封禁',
    deletionPending: '待删除',
    unknownError: '未知错误',
    yes: '是',
    no: '否',
    healthy: '健康',
    dormant: '休眠',
    risk: '风险',
    empty: '空账号',
    suspend: '封禁账号',
    unsuspend: '解除封禁',
    suspendReason: '封禁原因',
    requestDeletion: '申请删除',
    cancelDeletion: '取消删除',
    deletionPreview: '预览删除影响',
    purge: '彻底删除',
    purgeConfirmPrompt: '输入用户邮箱以确认',
    deletionPendingAt: '申请时间',
    deletionEligibleAt: '可删除时间',
    coolingWindow: '7天冷静期',
    notes: '管理员备注',
    addNote: '添加备注',
    noteBodyPlaceholder: '例：测试账号、手动赠送 — 活动赠送',
    deleteNote: '删除',
    tags: '标签',
    tagsPlaceholder: '例：测试账号、vip、疑似垃圾',
    diagnostics: '诊断信息',
    auditLogs: '操作日志',
    entitlements: '权益记录',
    noEntitlements: '暂无权益记录。',
    noNotes: '暂无备注。',
    noAuditLogs: '暂无操作日志。',
    feedbackInbox: '反馈收件箱',
    noFeedback: '暂无反馈。',
    feedbackType: '类型',
    feedbackStatusLabel: '状态',
    feedbackPriority: '优先级',
    feedbackNew: '新建',
    feedbackReviewing: '审核中',
    feedbackPlanned: '已计划',
    feedbackShipped: '已上线',
    feedbackClosed: '已关闭',
    typeFeatureRequest: '功能建议',
    typeBug: 'Bug',
    typeConfusion: '使用困惑',
    typePraise: '正向反馈',
    allTypes: '全部类型',
    loadingDetail: '正在加载用户详情…',
    viewDetail: '管理',
    source: '来源',
    expiresAt: '到期',
    lifetime: '永久',
  },
}

export const useAdminI18n = () => {
  const { language } = useI18n()
  const lang: AdminLanguage = language === 'zh' ? 'zh' : 'en'
  return useMemo(() => ({ lang, t: messages[lang] }), [lang])
}
