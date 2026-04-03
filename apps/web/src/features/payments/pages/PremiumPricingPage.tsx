import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, CreditCard, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { ROUTES } from '../../../app/routes/routes'
import { startPremiumCheckout } from '../paymentFlow'
import { fetchPaymentOrderStatus } from '../paymentApi'
import { refreshAuthProfile } from '../../../store/auth'
import type { CreateZpayOrderResponse } from '../paymentApi'

const POLL_INTERVAL_MS = 2000

const QrModal = ({
  order,
  payType,
  onClose,
}: {
  order: CreateZpayOrderResponse
  payType: 'alipay' | 'wxpay'
  onClose: () => void
}) => {
  const navigate = useNavigate()
  const [pollStatus, setPollStatus] = useState<'polling' | 'paid' | 'error'>('polling')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const result = await fetchPaymentOrderStatus(order.outTradeNo)
        if (cancelled) return
        if (result.status === 'paid') {
          setPollStatus('paid')
          await refreshAuthProfile()
          navigate(`${ROUTES.PREMIUM_SUCCESS}?out_trade_no=${order.outTradeNo}`)
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
  }, [order.outTradeNo, navigate])

  const label = payType === 'alipay' ? '支付宝' : '微信'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-sm rounded-[32px] border border-[#3A3733]/10 bg-[#F5F3F0] p-7 shadow-[0_30px_100px_rgba(58,55,51,0.20)] text-[#3A3733]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-[#3A3733]/40 hover:bg-[#3A3733]/8 hover:text-[#3A3733]"
        >
          <X size={16} />
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3A3733]/56">扫码支付</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{label} · ¥0.01</h2>
        <p className="mt-1 text-sm text-[#3A3733]/64">用 {label} 扫描下方二维码完成支付</p>

        <div className="mt-5 flex items-center justify-center rounded-[20px] border border-[#3A3733]/10 bg-white p-5">
          <QRCode value={order.qrcode!} size={176} />
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-[#3A3733]/60">
          {pollStatus === 'polling' && (
            <>
              <LoaderCircle size={14} className="animate-spin shrink-0" />
              等待支付确认…
            </>
          )}
          {pollStatus === 'paid' && (
            <>
              <CheckCircle2 size={14} className="shrink-0 text-green-600" />
              支付成功，正在跳转…
            </>
          )}
          {pollStatus === 'error' && '查询失败，请稍后重试或刷新页面。'}
        </div>
      </div>
    </div>
  )
}

const PremiumPricingPage = () => {
  const [loading, setLoading] = useState<'alipay' | 'wxpay' | null>(null)
  const [qrOrder, setQrOrder] = useState<{ order: CreateZpayOrderResponse; payType: 'alipay' | 'wxpay' } | null>(null)

  const handleCheckout = async (payType: 'alipay' | 'wxpay') => {
    setLoading(payType)
    try {
      const order = await startPremiumCheckout(payType)
      if (order) setQrOrder({ order, payType })
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <section className="min-h-full bg-[#F5F3F0] px-6 py-10 text-[#3A3733]">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-3">
              <Link to={ROUTES.LABS} className="inline-flex items-center gap-2 text-sm text-[#3A3733]/68">
                <ArrowLeft size={14} />
                返回 Labs
              </Link>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3A3733]/56">Premium</p>
                <h1 className="text-4xl font-semibold tracking-[-0.04em]">Pro 月付会员</h1>
                <p className="max-w-2xl text-sm leading-7 text-[#3A3733]/72">
                  支付成功后立即开通 Pro 会员，解锁全部高级功能，有效期 1 个月。
                </p>
              </div>
            </div>
            <div className="rounded-[28px] border border-[#3A3733]/10 bg-white/70 px-5 py-4 text-right shadow-[0_18px_60px_rgba(58,55,51,0.08)]">
              <div className="text-xs uppercase tracking-[0.16em] text-[#3A3733]/56">月付</div>
              <div className="mt-2 text-4xl font-semibold tracking-[-0.05em]">¥0.01</div>
              <div className="text-sm text-[#3A3733]/68">/ 月</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[32px] border border-[#3A3733]/10 bg-white/76 p-7 shadow-[0_24px_80px_rgba(58,55,51,0.08)]">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#3A3733] p-2 text-[#F5F3F0]">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">选择支付方式</h2>
                  <p className="text-sm text-[#3A3733]/68">下单后扫码或跳转 Z-Pay 收银台。</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  className="h-12 rounded-full bg-[#3A3733] text-[#F5F3F0] hover:bg-[#3A3733]/92"
                  disabled={loading !== null}
                  onClick={() => void handleCheckout('alipay')}
                >
                  {loading === 'alipay' ? '请求中…' : '支付宝'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full border-[#3A3733]/14 bg-transparent text-[#3A3733]"
                  disabled={loading !== null}
                  onClick={() => void handleCheckout('wxpay')}
                >
                  {loading === 'wxpay' ? '请求中…' : '微信支付'}
                </Button>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#3A3733]/10 bg-[#EDE7DF] p-7">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} />
                <h2 className="text-lg font-semibold">本次包含</h2>
              </div>
              <ul className="mt-5 space-y-4 text-sm text-[#3A3733]/78">
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  支付成功后立刻开通 Premium。
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  若已有未到期会员，将在当前到期时间基础上顺延 1 个月。
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  首版仅支持手动续费，不做自动续订。
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {qrOrder && (
        <QrModal
          order={qrOrder.order}
          payType={qrOrder.payType}
          onClose={() => setQrOrder(null)}
        />
      )}
    </>
  )
}

export default PremiumPricingPage
