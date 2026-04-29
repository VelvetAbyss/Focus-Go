import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowUpRight,
  CheckCircle2,
  Crown,
  Globe2,
  Infinity as InfinityIcon,
  LoaderCircle,
  Lock,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import QRCode from 'react-qr-code'
import { ROUTES } from '../../../app/routes/routes'
import { useI18n } from '../../../shared/i18n/useI18n'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import { getAuth, refreshAuthProfile, useAuthPlan } from '../../../store/auth'
import {
  capturePaypalOrder,
  createPaymentOrder,
  fetchPaymentOrderStatus,
  type CreatePaymentOrderResponse,
  type PlanId,
} from '../paymentApi'

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        createOrder: () => Promise<string>
        onApprove: (data: { orderID: string }) => Promise<void>
        onError?: (error: unknown) => void
      }) => { render: (selector: string) => Promise<void> }
    }
  }
}

const POLL_INTERVAL_MS = 2000

type Channel = 'alipay' | 'paypal'
type Lang = 'en' | 'zh'

type PlanCopy = {
  id: PlanId
  number: string
  badge: { en: string; zh: string }
  title: { en: string; zh: string }
  cadence: { en: string; zh: string }
  cny: string
  usd: string
  cnyEach?: { en: string; zh: string }
  blurb: { en: string; zh: string }
  perks: Array<{ en: string; zh: string }>
  recommended?: boolean
}

const PLANS: PlanCopy[] = [
  {
    id: 'pro_monthly',
    number: 'N° 01',
    badge: { en: 'Monthly', zh: '月付' },
    title: { en: 'Pro · Monthly', zh: 'Pro 月付' },
    cadence: { en: 'per month', zh: '每月' },
    cny: '15',
    usd: '4.99',
    blurb: {
      en: 'Try Pro on a short leash. Cancel anytime, prorate-friendly renewal.',
      zh: '短期体验 Pro。续费自动顺延，随时停用。',
    },
    perks: [
      { en: 'Cloud sync across devices', zh: '多设备云端同步' },
      { en: 'Habit Tracker · Project workspace', zh: '习惯追踪与项目工作区' },
      { en: 'Premium dashboard widgets', zh: '高级仪表盘组件' },
    ],
  },
  {
    id: 'pro_yearly',
    number: 'N° 02',
    badge: { en: 'Yearly · Save 33%', zh: '年付 · 立省 33%' },
    title: { en: 'Pro · Yearly', zh: 'Pro 年付' },
    cadence: { en: 'per year, billed once', zh: '一次开通 · 12 个月' },
    cny: '150',
    usd: '39.99',
    cnyEach: { en: '≈ ¥12.5 / month', zh: '≈ ¥12.5 / 月' },
    blurb: {
      en: 'The chosen one. A full season of focus, plus everything in Monthly.',
      zh: '推荐选择。一整年的专注节奏，包含 Monthly 全部权益。',
    },
    perks: [
      { en: 'All Monthly perks', zh: 'Monthly 全部权益' },
      { en: 'Priority feature access in Labs', zh: '实验室新功能优先体验' },
      { en: 'Annual review · year-in-focus report', zh: '年度回顾 · Year-in-Focus 报告' },
      { en: 'Founder-line support', zh: '创始人直邮支持' },
    ],
    recommended: true,
  },
  {
    id: 'lifetime',
    number: 'N° 03',
    badge: { en: 'Limited · Early supporter', zh: '限定 · 早期支持者' },
    title: { en: 'Lifetime', zh: '终身买断' },
    cadence: { en: 'one-time payment', zh: '一次买断 · 永久' },
    cny: '399',
    usd: '129',
    blurb: {
      en: 'Buy it once. Stays with the account for as long as the lights stay on.',
      zh: '一次买断，账号在则权益在。仅作为早期支持限时发售。',
    },
    perks: [
      { en: 'Everything in Yearly', zh: '包含年付全部权益' },
      { en: 'Lifetime entitlement, no renewals', zh: '终身权益，无需续费' },
      { en: 'Early supporter badge', zh: '早期支持者徽章' },
      { en: 'Priority on roadmap requests', zh: '路线图请求优先级' },
    ],
  },
]

const CHANNELS: Array<{
  id: Channel
  label: { en: string; zh: string }
  hint: { en: string; zh: string }
  currency: 'CNY' | 'USD'
  symbol: string
}> = [
  { id: 'alipay', label: { en: 'Alipay', zh: '支付宝' }, hint: { en: 'QR scan in Alipay', zh: '支付宝扫码完成支付' }, currency: 'CNY', symbol: '¥' },
  { id: 'paypal', label: { en: 'PayPal', zh: 'PayPal' }, hint: { en: 'PayPal Checkout · cards welcome', zh: 'PayPal Checkout · 支持信用卡' }, currency: 'USD', symbol: '$' },
]

const ASSURANCES = [
  { icon: ShieldCheck, en: 'Secure payment · server-verified webhooks', zh: '安全支付 · 服务端校验回调' },
  { icon: Lock, en: 'No card info touches our servers', zh: '我们不接触你的卡片信息' },
  { icon: InfinityIcon, en: 'Cancel renewal anytime in Settings', zh: '随时在设置中关闭续费' },
]

const detectInitialChannel = (lang: Lang): Channel => {
  if (typeof navigator === 'undefined') return lang === 'zh' ? 'alipay' : 'paypal'
  const navLang = [navigator.language, ...Array.from(navigator.languages ?? [])].join(',').toLowerCase()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (lang === 'zh' || navLang.includes('zh-cn') || navLang.includes('zh-hans') || tz === 'Asia/Shanghai') return 'alipay'
  return 'paypal'
}

const getPaypalClientId = () => (import.meta.env.VITE_PAYPAL_CLIENT_ID ?? '').trim()

const ensurePaypalSdk = async () => {
  if (window.paypal) return
  const clientId = getPaypalClientId()
  if (!clientId) throw new Error('missing PayPal client id')
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-focusgo-paypal]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`
    script.async = true
    script.dataset.focusgoPaypal = 'true'
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
}

const pickLang = (l: string): Lang => (l === 'zh' ? 'zh' : 'en')

const COPY = {
  eyebrow: { en: 'Membership', zh: '会员方案' },
  edition: { en: 'Edition · 2026', zh: '辑刊 · 2026' },
  headline: {
    en: 'A quieter way\nto pay for focus.',
    zh: '为专注\n安静地付费。',
  },
  lede: {
    en: 'Three calmly-priced ways into Focus & Go Pro. Pick the cadence that matches the season you are in — your data, your rhythm, all the way through.',
    zh: '三档定价、一种节奏。选择与你当下生活相称的方案，云端同步、专注计时、深度回顾，一路相随。',
  },
  perks: { en: 'What you unlock', zh: '解锁的内容' },
  choose: { en: 'Choose this plan', zh: '选择该方案' },
  recommended: { en: 'Recommended', zh: '推荐' },
  channelTitle: { en: 'Checkout channel', zh: '支付通道' },
  channelLede: {
    en: 'We auto-suggest a channel by your locale. Switch any time before paying.',
    zh: '已根据当前地区自动选择通道，可随时切换。',
  },
  pay: { en: 'Continue to pay', zh: '前往支付' },
  paying: { en: 'Opening…', zh: '请求中…' },
  loginRequired: { en: 'Sign in to continue', zh: '请先登录' },
  alipayHeading: { en: 'Scan to pay', zh: '请扫码支付' },
  awaitingPay: { en: 'Waiting for payment…', zh: '等待支付确认…' },
  paid: { en: 'Paid · redirecting', zh: '支付成功，正在跳转…' },
  pollFailed: { en: 'Status check failed. Refresh and retry.', zh: '查询失败，请刷新重试。' },
  alreadyPro: {
    en: 'You are already Pro. Plans below stack on top of your current entitlement.',
    zh: '你已是 Pro 会员，新订单将在当前权益基础上叠加。',
  },
  fineprint: {
    en: 'All prices include applicable taxes. Refund per published policy.',
    zh: '价格含适用税费。退款依据已公布的退款政策处理。',
  },
  back: { en: 'Back to dashboard', zh: '返回仪表盘' },
}

const QrModal = ({ order, onClose, lang }: { order: CreatePaymentOrderResponse; onClose: () => void; lang: Lang }) => {
  const navigate = useNavigate()
  const [pollStatus, setPollStatus] = useState<'polling' | 'paid' | 'error'>('polling')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const result = await fetchPaymentOrderStatus(order.orderNo)
        if (cancelled) return
        if (result.status === 'paid') {
          setPollStatus('paid')
          await refreshAuthProfile()
          navigate(`${ROUTES.PREMIUM_SUCCESS}?out_trade_no=${order.orderNo}`)
          return
        }
        timerRef.current = window.setTimeout(() => { void poll() }, POLL_INTERVAL_MS)
      } catch {
        if (!cancelled) setPollStatus('error')
      }
    }
    void poll()
    return () => {
      cancelled = true
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [navigate, order.orderNo])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1815]/55 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="relative w-full max-w-[380px] overflow-hidden rounded-[8px] border border-[#3A3733]/12 bg-[#F5F3F0] p-7 text-[#3A3733] shadow-[0_40px_120px_rgba(26,24,21,0.32)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#3A3733]/50 transition hover:bg-[#3A3733]/8 hover:text-[#3A3733]"
          aria-label="close"
        >
          <X size={16} />
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#C2532E]">
          {lang === 'zh' ? '支付宝 · 扫码' : 'Alipay · QR'}
        </p>
        <h2 className="mt-2 font-display text-[34px] leading-none tracking-tight">
          ¥{order.amount}
          <span className="ml-2 text-[14px] font-normal tracking-[0.18em] text-[#3A3733]/55">{order.currency}</span>
        </h2>
        <p className="mt-1.5 text-[13px] leading-6 text-[#3A3733]/64">{COPY.alipayHeading[lang]}</p>
        <div className="mt-5 grid place-items-center rounded-[6px] border border-[#3A3733]/12 bg-white p-5">
          <QRCode value={order.qrcode!} size={184} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-[12px] text-[#3A3733]/60">
          {pollStatus === 'polling' && (
            <>
              <LoaderCircle size={13} className="shrink-0 animate-spin" />
              {COPY.awaitingPay[lang]}
            </>
          )}
          {pollStatus === 'paid' && (
            <>
              <CheckCircle2 size={13} className="shrink-0 text-[#1f7a4a]" />
              {COPY.paid[lang]}
            </>
          )}
          {pollStatus === 'error' && COPY.pollFailed[lang]}
        </div>
        <div className="mt-4 border-t border-dashed border-[#3A3733]/15 pt-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[#3A3733]/40">
          ORDER · {order.orderNo}
        </div>
      </motion.div>
    </div>
  )
}

const PayPalCheckoutButton = ({ planId }: { planId: PlanId }) => {
  const containerId = `mp-paypal-${planId}`
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const mount = async () => {
      try {
        await ensurePaypalSdk()
        if (cancelled || !window.paypal) return
        document.getElementById(containerId)?.replaceChildren()
        await window.paypal.Buttons({
          createOrder: async () => {
            const auth = getAuth()
            if (!auth?.accessToken) {
              window.location.href = '/'
              throw new Error('missing access token')
            }
            const order = await createPaymentOrder(planId, 'paypal_checkout')
            if (!order.paypalOrderId) throw new Error('missing paypal order id')
            sessionStorage.setItem(`focusgo.paypal.${order.paypalOrderId}`, order.orderNo)
            return order.paypalOrderId
          },
          onApprove: async (data) => {
            const orderNo = sessionStorage.getItem(`focusgo.paypal.${data.orderID}`)
            if (!orderNo) throw new Error('missing local order')
            await capturePaypalOrder(orderNo, data.orderID)
            await refreshAuthProfile()
            window.location.assign(`${ROUTES.PREMIUM_SUCCESS}?out_trade_no=${orderNo}`)
          },
          onError: (err) => setError(err instanceof Error ? err.message : 'PayPal checkout failed'),
        }).render(`#${containerId}`)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'PayPal unavailable')
      }
    }
    void mount()
    return () => {
      cancelled = true
    }
  }, [containerId, planId])

  return (
    <div>
      <div id={containerId} className="min-h-[46px]" />
      {error ? <p className="mt-2 text-[12px] text-[#9E4036]">{error}</p> : null}
    </div>
  )
}

const MembershipPage = () => {
  const { language } = usePreferences()
  const lang = pickLang(language)
  const { t } = useI18n()
  const plan = useAuthPlan()
  const isPro = plan === 'premium'
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('pro_yearly')
  const [channel, setChannel] = useState<Channel>(() => detectInitialChannel(lang))
  const [loading, setLoading] = useState(false)
  const [qrOrder, setQrOrder] = useState<CreatePaymentOrderResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const selectedPlan = useMemo(() => PLANS.find((p) => p.id === selectedPlanId)!, [selectedPlanId])
  const selectedChannel = useMemo(() => CHANNELS.find((c) => c.id === channel)!, [channel])
  const displayPrice = channel === 'alipay' ? selectedPlan.cny : selectedPlan.usd
  const displaySymbol = selectedChannel.symbol

  // Avoid unused-import warning while still keeping the i18n hook available for shell strings.
  void t

  const handleAlipay = async () => {
    const auth = getAuth()
    if (!auth?.accessToken) {
      window.location.href = '/'
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const order = await createPaymentOrder(selectedPlan.id, 'zpay_alipay')
      if (order.qrcode) setQrOrder(order)
      else if (order.payUrl || order.img) window.location.assign(order.payUrl ?? order.img!)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to open Alipay checkout')
    } finally {
      setLoading(false)
    }
  }

  const fadeUp = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
  }

  return (
    <>
      <section className="relative min-h-full overflow-hidden bg-[#F5F3F0] text-[#3A3733]">
        {/* warm vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 60% at 80% -10%, rgba(194,83,46,0.10), transparent 55%), radial-gradient(120% 80% at -10% 110%, rgba(58,55,51,0.08), transparent 60%)' }}
        />

        <div className="relative mx-auto flex max-w-[1180px] flex-col gap-16 px-8 pb-24 pt-12 lg:px-14">
          {/* masthead */}
          <header className="flex items-center justify-between border-b border-[#3A3733]/15 pb-5">
            <Link
              to={ROUTES.DASHBOARD}
              className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#3A3733]/60 transition hover:text-[#3A3733]"
            >
              ← {COPY.back[lang]}
            </Link>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-[#3A3733]/45">
              <span>{COPY.edition[lang]}</span>
              <span className="h-1 w-1 rounded-full bg-[#3A3733]/40" />
              <span>FG · MEMBERSHIP</span>
            </div>
          </header>

          {/* hero */}
          <motion.div
            initial="initial"
            animate="animate"
            transition={{ staggerChildren: 0.08, delayChildren: 0.05 }}
            className="flex flex-col gap-6"
          >
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-[#C2532E]"
            >
              <span className="inline-flex items-center gap-1.5">
                <Crown size={12} strokeWidth={2.2} />
                {COPY.eyebrow[lang]}
              </span>
              <span className="h-px flex-1 bg-[#3A3733]/15" />
              <span className="font-mono text-[10px] tracking-[0.28em] text-[#3A3733]/45">03 PLANS</span>
            </motion.p>

            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.55 }}
              className="max-w-[14ch] whitespace-pre-line font-display text-[58px] leading-[0.96] tracking-[-0.025em] text-[#3A3733] md:text-[88px]"
              style={{ fontFamily: 'var(--font-display, "Fraunces", serif)', fontVariationSettings: '"opsz" 144' }}
            >
              {COPY.headline[lang]}
            </motion.h1>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end"
            >
              <p className="max-w-[58ch] text-[15px] leading-7 text-[#3A3733]/70">
                {COPY.lede[lang]}
              </p>
              {isPro ? (
                <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#1f7a4a]/25 bg-[#1f7a4a]/8 px-3 py-1.5 text-[12px] text-[#1f7a4a]">
                  <CheckCircle2 size={14} />
                  {COPY.alreadyPro[lang]}
                </div>
              ) : null}
            </motion.div>
          </motion.div>

          {/* plans */}
          <motion.div
            initial="initial"
            animate="animate"
            transition={{ staggerChildren: 0.1, delayChildren: 0.15 }}
            className="grid gap-5 lg:grid-cols-3"
          >
            {PLANS.map((p) => {
              const active = p.id === selectedPlanId
              const recommended = Boolean(p.recommended)
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  whileHover={{ y: -3 }}
                  className={[
                    'group relative flex flex-col items-stretch rounded-[6px] border bg-[#FBFAF7] p-7 text-left transition-all',
                    'shadow-[0_2px_0_rgba(58,55,51,0.04),0_18px_46px_-28px_rgba(58,55,51,0.35)]',
                    active
                      ? 'border-[#3A3733] ring-1 ring-[#3A3733]'
                      : 'border-[#3A3733]/12 hover:border-[#3A3733]/30',
                    recommended ? 'lg:-translate-y-3 lg:py-9' : '',
                  ].join(' ')}
                >
                  {recommended ? (
                    <div className="absolute -right-3 -top-3 rotate-[8deg] select-none rounded-[2px] border border-[#C2532E] bg-[#C2532E] px-3.5 py-1 font-mono text-[10px] uppercase tracking-[0.32em] text-[#F5F3F0] shadow-[0_10px_24px_rgba(194,83,46,0.35)]">
                      ★ {COPY.recommended[lang]}
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#3A3733]/45">{p.number}</span>
                    <span className="rounded-full border border-[#3A3733]/15 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#3A3733]/60">
                      {p.badge[lang]}
                    </span>
                  </div>

                  <h2
                    className="mt-7 font-display text-[34px] leading-[1.05] tracking-[-0.015em]"
                    style={{ fontFamily: 'var(--font-display, "Fraunces", serif)', fontVariationSettings: '"opsz" 96' }}
                  >
                    {p.title[lang]}
                  </h2>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span
                      className="font-display text-[52px] leading-none tracking-[-0.03em]"
                      style={{ fontFamily: 'var(--font-display, "Fraunces", serif)', fontVariationSettings: '"opsz" 144' }}
                    >
                      {channel === 'alipay' ? `¥${p.cny}` : `$${p.usd}`}
                    </span>
                    <span className="text-[12px] uppercase tracking-[0.18em] text-[#3A3733]/55">
                      {p.cadence[lang]}
                    </span>
                  </div>
                  {p.cnyEach && channel === 'alipay' ? (
                    <p className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[#3A3733]/50">{p.cnyEach[lang]}</p>
                  ) : null}

                  <p className="mt-5 text-[13.5px] leading-6 text-[#3A3733]/68">{p.blurb[lang]}</p>

                  <div className="mt-6 border-t border-dashed border-[#3A3733]/15 pt-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#3A3733]/45">
                      {COPY.perks[lang]}
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {p.perks.map((perk) => (
                        <li key={perk.en} className="flex items-start gap-2.5 text-[13.5px] leading-6 text-[#3A3733]/82">
                          <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-[#C2532E]" />
                          {perk[lang]}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-7 flex items-center justify-between">
                    <span
                      className={[
                        'inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.24em]',
                        active ? 'text-[#3A3733]' : 'text-[#3A3733]/50',
                      ].join(' ')}
                    >
                      {active ? (
                        <>
                          <CheckCircle2 size={13} />
                          {lang === 'zh' ? '已选定' : 'Selected'}
                        </>
                      ) : (
                        <>
                          {COPY.choose[lang]}
                          <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </>
                      )}
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </motion.div>

          {/* checkout */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.45 }}
            className="grid overflow-hidden rounded-[8px] border border-[#3A3733]/12 bg-[#FBFAF7] shadow-[0_30px_80px_-60px_rgba(58,55,51,0.45)]"
            style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)' }}
          >
              {/* left: channel picker + summary */}
              <div className="border-r border-[#3A3733]/10 p-8">
                <div className="flex items-baseline justify-between">
                  <h3
                    className="font-display text-[28px] leading-none tracking-[-0.01em]"
                    style={{ fontFamily: 'var(--font-display, "Fraunces", serif)', fontVariationSettings: '"opsz" 96' }}
                  >
                    {COPY.channelTitle[lang]}
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#3A3733]/45">02 / 02</span>
                </div>
                <p className="mt-2 max-w-[44ch] text-[13px] leading-6 text-[#3A3733]/64">
                  {COPY.channelLede[lang]}
                </p>

                {/* tabs */}
                <div className="mt-6 inline-flex rounded-[6px] border border-[#3A3733]/15 bg-[#F5F3F0] p-1">
                  {CHANNELS.map((c) => {
                    const active = channel === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setChannel(c.id)}
                        className={[
                          'inline-flex items-center gap-2 rounded-[4px] px-4 py-2 text-[12px] uppercase tracking-[0.2em] transition',
                          active
                            ? 'bg-[#3A3733] text-[#F5F3F0] shadow-[0_4px_14px_-6px_rgba(58,55,51,0.55)]'
                            : 'text-[#3A3733]/55 hover:text-[#3A3733]',
                        ].join(' ')}
                      >
                        {c.id === 'alipay' ? <ScanLine size={13} /> : <Globe2 size={13} />}
                        {c.label[lang]}
                      </button>
                    )
                  })}
                </div>

                <p className="mt-3 text-[12px] text-[#3A3733]/55">{selectedChannel.hint[lang]}</p>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  {ASSURANCES.map((a) => (
                    <div key={a.en} className="flex items-start gap-2.5 text-[12px] leading-5 text-[#3A3733]/68">
                      <a.icon size={14} className="mt-0.5 shrink-0 text-[#3A3733]/55" />
                      <span>{a[lang]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* right: summary + cta */}
              <div className="relative flex flex-col justify-between bg-[#3A3733] p-8 text-[#F5F3F0]">
                <div className="relative">
                  <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#F5F3F0]/55">
                    {lang === 'zh' ? '订单摘要' : 'Order summary'}
                  </p>
                  <h4
                    className="mt-4 font-display text-[30px] leading-[1.05] tracking-[-0.01em]"
                    style={{ fontFamily: 'var(--font-display, "Fraunces", serif)', fontVariationSettings: '"opsz" 96' }}
                  >
                    {selectedPlan.title[lang]}
                  </h4>
                  <p className="mt-1 text-[12.5px] text-[#F5F3F0]/62">{selectedPlan.cadence[lang]}</p>

                  <div className="mt-7 flex items-end justify-between border-t border-dashed border-[#F5F3F0]/22 pt-5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#F5F3F0]/55">
                      {selectedChannel.label[lang]} · {selectedChannel.currency}
                    </span>
                    <span
                      className="font-display text-[44px] leading-none tracking-[-0.03em]"
                      style={{ fontFamily: 'var(--font-display, "Fraunces", serif)', fontVariationSettings: '"opsz" 144' }}
                    >
                      {displaySymbol}{displayPrice}
                    </span>
                  </div>
                </div>

                <div className="relative mt-8">
                  {channel === 'alipay' ? (
                    <button
                      type="button"
                      onClick={handleAlipay}
                      disabled={loading}
                      className="group inline-flex w-full items-center justify-between gap-3 rounded-[4px] bg-[#F5F3F0] px-5 py-4 text-[#3A3733] transition hover:bg-white disabled:opacity-70"
                    >
                      <span className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.24em]">
                        {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} className="text-[#C2532E]" />}
                        {loading ? COPY.paying[lang] : COPY.pay[lang]}
                      </span>
                      <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  ) : (
                    <div className="rounded-[4px] bg-[#F5F3F0] p-3">
                      <PayPalCheckoutButton planId={selectedPlan.id} />
                    </div>
                  )}

                  {errorMsg ? <p className="mt-3 text-[12px] text-[#F1A488]">{errorMsg}</p> : null}

                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F5F3F0]/45">
                    {COPY.fineprint[lang]}
                  </p>
                </div>
              </div>
          </motion.div>
        </div>
      </section>
      {qrOrder ? <QrModal order={qrOrder} onClose={() => setQrOrder(null)} lang={lang} /> : null}
    </>
  )
}

export default MembershipPage
