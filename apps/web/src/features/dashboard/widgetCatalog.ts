import { BookOpen, CalendarDays, CheckCheck, CheckSquare2, CloudSun, Compass, CreditCard, Globe2, Headphones, HeartHandshake, Languages, ListChecks, Moon, Play, Sparkles, Timer, TrendingUp, Wallet, Coffee, Coins, ArrowLeftRight, type LucideIcon } from 'lucide-react'

type WidgetProfile = { zh: string; en: string; hintZh: string; hintEn: string; icon: LucideIcon; minWidth: number; minHeight: number; tone?: string }
export const widgetProfiles: Record<string, WidgetProfile> = {
  tasks: { zh: '任务', en: 'Tasks', hintZh: '从下一件小事开始', hintEn: 'Your next small step', icon: CheckSquare2, minWidth: 340, minHeight: 300 },
  'task-progress-summary': { zh: '进度总结', en: 'Progress', hintZh: '看看这一段的积累', hintEn: 'See how far you’ve come', icon: TrendingUp, minWidth: 360, minHeight: 280, tone: 'blue' },
  weather: { zh: '天气', en: 'Weather', hintZh: '窗外的此时此刻', hintEn: 'Outside, right now', icon: CloudSun, minWidth: 260, minHeight: 220, tone: 'blue' },
  world_clock: { zh: '世界时钟', en: 'World clock', hintZh: '与远方保持同频', hintEn: 'A moment around the world', icon: Globe2, minWidth: 300, minHeight: 290 },
  'widget-todos': { zh: '日常清单', en: 'Routines', hintZh: '日、周、月的小习惯', hintEn: 'Daily, weekly, monthly', icon: ListChecks, minWidth: 320, minHeight: 270 },
  spend: { zh: '日常开销', en: 'Spending', hintZh: '记下今天的一笔', hintEn: 'Make a little note of today', icon: Wallet, minWidth: 320, minHeight: 270, tone: 'clay' },
  translation: { zh: '翻译', en: 'Translate', hintZh: '随手译一段', hintEn: 'Across languages', icon: Languages, minWidth: 360, minHeight: 350 },
  'salary-earned': { zh: '今日收入', en: 'Paid today', hintZh: '工作时间的价值', hintEn: 'The value of your time', icon: Coins, minWidth: 280, minHeight: 260, tone: 'clay' },
  'salary-price': { zh: '时间价格', en: 'Time price', hintZh: '用工作时间衡量价格', hintEn: 'A price, in working time', icon: Timer, minWidth: 300, minHeight: 320 },
  'salary-breaks': { zh: '带薪休息', en: 'Paid breaks', hintZh: '给自己留一点空白', hintEn: 'Leave a little breathing room', icon: Coffee, minWidth: 300, minHeight: 300 },
  bazi: { zh: '八字 · 今日', en: 'BaZi today', hintZh: '今日的观察与思考', hintEn: 'A daily reflection', icon: Compass, minWidth: 300, minHeight: 280 },
  astrology: { zh: '星座 · 今日', en: 'Astrology', hintZh: '星空下的一点灵感', hintEn: 'A little celestial inspiration', icon: Moon, minWidth: 300, minHeight: 280 },
  tarot: { zh: '每日一张', en: 'Daily tarot', hintZh: '留一个问题给自己', hintEn: 'A question for yourself', icon: Sparkles, minWidth: 300, minHeight: 280, tone: 'clay' },
  library: { zh: '阅读', en: 'Reading', hintZh: '下一页，新的发现', hintEn: 'Another page, another discovery', icon: BookOpen, minWidth: 300, minHeight: 330, tone: 'clay' },
  media_card: { zh: '影视', en: 'Watchlist', hintZh: '留给闲暇的故事', hintEn: 'Stories for your downtime', icon: Play, minWidth: 300, minHeight: 330 },
  daily_review: { zh: '每日回顾', en: 'Daily review', hintZh: '给今天一个收尾', hintEn: 'Bring today to a close', icon: CheckCheck, minWidth: 340, minHeight: 330, tone: 'blue' },
  trips_card: { zh: '旅行', en: 'Trips', hintZh: '下一站，去哪里', hintEn: 'Where to next?', icon: CalendarDays, minWidth: 300, minHeight: 330, tone: 'blue' },
  subscriptions_card: { zh: '订阅', en: 'Subscriptions', hintZh: '记住每一次续期', hintEn: 'Keep renewals in view', icon: CreditCard, minWidth: 320, minHeight: 310 },
  podcast_card: { zh: '播客', en: 'Podcasts', hintZh: '把时间交给声音', hintEn: 'Something worth listening to', icon: Headphones, minWidth: 300, minHeight: 350 },
  people_card: { zh: '人际', en: 'People', hintZh: '记得联系在意的人', hintEn: 'Keep your people close', icon: HeartHandshake, minWidth: 300, minHeight: 330, tone: 'clay' },
  fx_card: { zh: '汇率', en: 'Currency', hintZh: '换算眼前的数字', hintEn: 'A quick conversion', icon: ArrowLeftRight, minWidth: 300, minHeight: 280 },
  stocks: { zh: '自选股', en: 'Watchlist', hintZh: '关注市场的变化', hintEn: 'Your market at a glance', icon: TrendingUp, minWidth: 320, minHeight: 330 },
}
