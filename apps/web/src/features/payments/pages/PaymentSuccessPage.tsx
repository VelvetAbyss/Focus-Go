import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ROUTES } from '../../../app/routes/routes'
import { fetchPaymentOrderStatus } from '../paymentApi'
import { refreshAuthProfile } from '../../../store/auth'

const PAYMENT_STATUS_POLL_MS = 300

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams()
  const outTradeNo = searchParams.get('out_trade_no')
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed' | 'expired' | 'abnormal' | 'refunded'>(outTradeNo ? 'pending' : 'failed')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!outTradeNo) return

    let cancelled = false
    const poll = async () => {
      try {
        const result = await fetchPaymentOrderStatus(outTradeNo)
        if (cancelled) return
        setStatus(result.status)
        if (result.status === 'paid') {
          await refreshAuthProfile()
          return
        }
        if (result.status === 'pending') {
          timerRef.current = window.setTimeout(() => {
            void poll()
          }, PAYMENT_STATUS_POLL_MS)
        }
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [outTradeNo])

  return (
    <section className="flex min-h-full items-center justify-center bg-[var(--bg-elevated)] px-6 py-12 text-[var(--text-primary)]">
      <div className="w-full max-w-xl rounded-[32px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] p-8 text-center shadow-[var(--shadow-card-lg)]">
        {status === 'paid' ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-elevated)]">
              <CheckCircle2 size={24} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Premium 已开通</h1>
            <p className="mt-3 text-sm leading-7 text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">
              支付已经确认，会员状态已刷新。你现在可以返回 Labs 或直接继续使用受限功能。
            </p>
          </>
        ) : status === 'pending' ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-primary)]">
              <LoaderCircle size={24} className="animate-spin" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">等待支付确认</h1>
            <p className="mt-3 text-sm leading-7 text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">
              已收到支付返回，正在轮询订单状态。若已完成支付，请稍候几秒。
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">支付状态未确认</h1>
            <p className="mt-3 text-sm leading-7 text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">
              未拿到有效订单号，或订单查询失败。你可以返回定价页重新发起一次支付。
            </p>
          </>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button type="button" asChild className="rounded-full bg-[var(--text-primary)] text-[var(--bg-elevated)] hover:bg-[color-mix(in_srgb,var(--text-primary)_92%,transparent)]">
            <Link to={ROUTES.LABS}>返回 Labs</Link>
          </Button>
          <Button type="button" asChild variant="outline" className="rounded-full border-[color-mix(in_srgb,var(--text-primary)_14%,transparent)] bg-transparent text-[var(--text-primary)]">
            <Link to={ROUTES.PREMIUM}>返回定价页</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export default PaymentSuccessPage
