import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, CreditCard, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { ROUTES } from '../../../app/routes/routes'
import { getAuth, refreshAuthProfile } from '../../../store/auth'
import { capturePaypalOrder, createPaymentOrder, fetchPaymentOrderStatus, type CreatePaymentOrderResponse, type PlanId } from '../paymentApi'

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

type PricingPlan = {
  id: PlanId
  title: string
  description: string
  cny: string
  usd: string
  badge: string
  highlights?: string[]
}

const plans: PricingPlan[] = [
  { id: 'pro_monthly', title: 'Pro 月付', description: '支付成功后开通 1 个月，已有有效期会自动顺延。', cny: '¥15', usd: '$4.99', badge: 'Monthly' },
  { id: 'pro_yearly', title: 'Pro 年付', description: '一次开通 12 个月，适合长期使用。', cny: '¥150', usd: '$39.99', badge: 'Yearly', highlights: ['Most Popular', 'Save 33%'] },
  { id: 'lifetime', title: 'Early Supporter Plan', description: '限时买断权益，不作为常驻套餐销售。', cny: '¥399', usd: '$129', badge: 'Limited Offer', highlights: ['Early Supporter Plan'] },
]

const getPreferredMarket = () => {
  if (typeof navigator === 'undefined') return 'global'
  const language = [navigator.language, ...Array.from(navigator.languages ?? [])].join(',').toLowerCase()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (language.includes('zh-cn') || language.includes('zh-hans') || timeZone === 'Asia/Shanghai') return 'domestic'
  return 'global'
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

const QrModal = ({
  order,
  onClose,
}: {
  order: CreatePaymentOrderResponse
  onClose: () => void
}) => {
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
  }, [order.orderNo, navigate])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--text-primary)_40%,transparent)] px-4">
      <div className="relative w-full max-w-sm rounded-[28px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] p-7 shadow-[var(--shadow-card-lg)] text-[var(--text-primary)]">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full p-1.5 text-[color-mix(in_srgb,var(--text-primary)_44%,transparent)] hover:bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)]">
          <X size={16} />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--text-primary)_56%,transparent)]">支付宝</p>
        <h2 className="mt-1 text-2xl font-semibold">{order.amount} {order.currency}</h2>
        <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--text-primary)_64%,transparent)]">用支付宝扫描下方二维码完成支付</p>
        <div className="mt-5 flex items-center justify-center rounded-[20px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] p-5">
          <QRCode value={order.qrcode!} size={176} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-[color-mix(in_srgb,var(--text-primary)_60%,transparent)]">
          {pollStatus === 'polling' && <><LoaderCircle size={14} className="animate-spin shrink-0" />等待支付确认…</>}
          {pollStatus === 'paid' && <><CheckCircle2 size={14} className="shrink-0 text-green-600" />支付成功，正在跳转…</>}
          {pollStatus === 'error' && '查询失败，请稍后重试或刷新页面。'}
        </div>
      </div>
    </div>
  )
}

const PayPalButton = ({ planId, disabled }: { planId: PlanId; disabled: boolean }) => {
  const id = `paypal-buttons-${planId}`
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (disabled) return
    let cancelled = false
    const mount = async () => {
      try {
        await ensurePaypalSdk()
        if (cancelled || !window.paypal) return
        document.getElementById(id)?.replaceChildren()
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
        }).render(`#${id}`)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'PayPal unavailable')
      }
    }
    void mount()
    return () => { cancelled = true }
  }, [disabled, id, planId])

  return (
    <div>
      <div id={id} className="min-h-[46px]" />
      {error ? <p className="mt-2 text-xs text-[#9E4036]">{error}</p> : null}
    </div>
  )
}

const PremiumPricingPage = () => {
  const [loading, setLoading] = useState<PlanId | null>(null)
  const [qrOrder, setQrOrder] = useState<CreatePaymentOrderResponse | null>(null)
  const [market] = useState<'domestic' | 'global'>(() => getPreferredMarket())
  const isDomestic = market === 'domestic'

  const handleAlipay = async (planId: PlanId) => {
    const auth = getAuth()
    if (!auth?.accessToken) {
      window.location.href = '/'
      return
    }
    setLoading(planId)
    try {
      const order = await createPaymentOrder(planId, 'zpay_alipay')
      if (order.qrcode) setQrOrder(order)
      else if (order.payUrl || order.img) window.location.assign(order.payUrl ?? order.img!)
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <section className="min-h-full bg-[var(--bg-elevated)] px-6 py-10 text-[var(--text-primary)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Link to={ROUTES.LABS} className="inline-flex items-center gap-2 text-sm text-[color-mix(in_srgb,var(--text-primary)_68%,transparent)]">
                <ArrowLeft size={14} />返回 Labs
              </Link>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--text-primary)_56%,transparent)]">Premium</p>
                <h1 className="text-4xl font-semibold">选择会员套餐</h1>
                <p className="max-w-2xl text-sm leading-7 text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">
                  {isDomestic ? '已根据地区为你显示人民币价格和支付宝支付。' : 'Prices are shown in USD for PayPal Checkout.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.id} className="rounded-[8px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_78%,transparent)] p-6 shadow-[var(--shadow-card-lg)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--text-primary)_56%,transparent)]">{plan.badge}</span>
                    {plan.highlights?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {plan.highlights.map((item) => (
                          <span key={item} className="rounded-[6px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--text-primary)] px-2 py-1 text-xs font-semibold text-[var(--bg-elevated)]">{item}</span>
                        ))}
                      </div>
                    ) : null}
                    <h2 className="mt-2 text-2xl font-semibold">{plan.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[color-mix(in_srgb,var(--text-primary)_68%,transparent)]">{plan.description}</p>
                  </div>
                  <ShieldCheck size={20} />
                </div>
                <div className="mt-6">
                  {isDomestic ? (
                    <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] p-4">
                      <div className="text-xs text-[color-mix(in_srgb,var(--text-primary)_56%,transparent)]">支付宝</div>
                      <div className="mt-1 text-2xl font-semibold">{plan.cny}</div>
                      <Button type="button" className="mt-4 h-11 w-full rounded-[8px] bg-[var(--text-primary)] text-[var(--bg-elevated)] hover:bg-[color-mix(in_srgb,var(--text-primary)_92%,transparent)]" disabled={loading !== null} onClick={() => void handleAlipay(plan.id)}>
                        {loading === plan.id ? '请求中…' : '支付宝支付'}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] p-4">
                      <div className="flex items-center gap-2 text-xs text-[color-mix(in_srgb,var(--text-primary)_56%,transparent)]"><CreditCard size={14} />PayPal</div>
                      <div className="mt-1 text-2xl font-semibold">{plan.usd}</div>
                      <div className="mt-4">
                        <PayPalButton planId={plan.id} disabled={loading !== null} />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      {qrOrder ? <QrModal order={qrOrder} onClose={() => setQrOrder(null)} /> : null}
    </>
  )
}

export default PremiumPricingPage
