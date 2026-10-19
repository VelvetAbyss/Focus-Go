import { useI18n } from '../../shared/i18n/useI18n'
const messages = {
  localSaveFailed: ['本机无法保存，请检查可用存储空间后重试。', 'Unable to save locally. Check available storage and retry.'],
  recentDays: ['最近7天', 'Last 7 days'], focusHours: ['专注时间', 'Focus time'],
  settings: ['账户设置', 'Account settings'], growth: ['成长回顾', 'Growth review'], data: ['数据与隐私', 'Data & privacy'], preferences: ['使用偏好', 'Preferences'],
  pending: ['已存本机，等待上传', 'Saved locally, waiting to upload'], saving: ['正在同步资料…', 'Syncing profile…'], saved: ['资料已同步', 'Profile synced'], error: ['暂时无法同步，本机改动仍保留', 'Unable to sync. Local changes are kept.'], retry: ['重试', 'Retry'],
  loading: ['正在读取账号信息…', 'Loading account…'], failed: ['暂时无法读取，请重试', 'Unable to load. Please retry.'], verified: ['已验证', 'Verified'], unverified: ['未验证', 'Not verified'],
  credential: ['邮箱与密码', 'Email & password'], loginMethods: ['已绑定的登录方式', 'Linked sign-in methods'], emailHint: ['邮箱变更与两步验证尚未配置，当前不开放这些操作。', 'Email changes and two-step verification are not configured.'],
  password: ['密码', 'Password'], currentPassword: ['当前密码', 'Current password'], newPassword: ['新密码（8–128字符）', 'New password (8–128 characters)'], changePassword: ['修改密码', 'Change password'], passwordChanged: ['密码已更新，其他设备已退出', 'Password updated. Other sessions were signed out.'], oauthPassword: ['此账号通过第三方登录，请在对应平台管理登录安全。', 'This account uses a linked provider. Manage its sign-in security there.'],
  sessions: ['登录设备', 'Active sessions'], currentSession: ['当前设备', 'This device'], unknownDevice: ['未知设备', 'Unknown device'], lastActive: ['最近活动', 'Last active'], revoke: ['退出此设备', 'Sign out device'], revokeOthers: ['退出其他设备', 'Sign out other devices'], revokeConfirm: ['确定退出这个设备？', 'Sign out this device?'], revokeOthersConfirm: ['确定退出其他设备？', 'Sign out all other devices?'],
  deleteTitle: ['申请注销账号', 'Request account deletion'], deleteWarning: ['账号将立即停用，所有登录设备及集成令牌会失效。云端数据进入7天冷静期，期满后由支持人员清理。', 'Your account will be disabled and all sessions and integration tokens revoked. Cloud data enters a 7-day cooling period before support can purge it.'], deleteNote: ['7天内如需取消，请联系 support@nestflow.art。申请成功后才会清理这台设备的本地数据。', 'To cancel within 7 days, contact support@nestflow.art. Local data is cleared only after the server accepts your request.'], deleteConfirm: ['输入账号邮箱确认', 'Enter your account email to confirm'], deleteSubmit: ['停用账号并申请注销', 'Disable account & request deletion'],
  actionFailed: ['操作未完成，请重试；账号和本地数据未被清理。', 'The action failed. Your account and local data were not cleared.'], invalidPassword: ['当前密码不正确，或新密码不符合要求', 'Check your current password and new password requirements.'], recentLogin: ['请重新登录后，在5分钟内申请注销', 'Sign in again, then request deletion within 5 minutes.'], tooMany: ['尝试次数过多，请10分钟后再试', 'Too many attempts. Try again in 10 minutes.'], nameRequired: ['请输入显示名称', 'Enter a display name'], unsaved: ['资料尚未保存。确定离开？', 'Your profile has unsaved changes. Leave anyway?'],
  dataHint: ['导出包括这台设备已有的任务、笔记和设置。账号注销与数据导出是独立操作。', 'Export includes tasks, notes and settings stored on this device. Account deletion is a separate action.'], totalNotes: ['全部笔记', 'All notes'], earned: ['已获得', 'Earned'],
} as const
export const useAccountCopy = () => { const { language } = useI18n(); return (key: keyof typeof messages) => messages[key][language === 'zh' ? 0 : 1] }
export type AccountCopy = ReturnType<typeof useAccountCopy>
export const accountError = (error: unknown, copy: AccountCopy) => {
  const code = error instanceof Error ? error.message : ''
  return copy(code === 'recent_login_required' ? 'recentLogin' : code === 'invalid_password' ? 'invalidPassword' : code === 'too_many_attempts' ? 'tooMany' : 'actionFailed')
}
