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
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>(outTradeNo ? 'pending' : 'failed')
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
    <section className="flex min-h-full items-center justify-center bg-[#F5F3F0] px-6 py-12 text-[#3A3733]">
      <div className="w-full max-w-xl rounded-[32px] border border-[#3A3733]/10 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(58,55,51,0.08)]">
        {status === 'paid' ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#3A3733] text-[#F5F3F0]">
              <CheckCircle2 size={24} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Premium 已开通</h1>
            <p className="mt-3 text-sm leading-7 text-[#3A3733]/72">
              支付已经确认，会员状态已刷新。你现在可以返回 Labs 或直接继续使用受限功能。
            </p>
          </>
        ) : status === 'pending' ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EDE7DF] text-[#3A3733]">
              <LoaderCircle size={24} className="animate-spin" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">等待支付确认</h1>
            <p className="mt-3 text-sm leading-7 text-[#3A3733]/72">
              已收到支付返回，正在轮询订单状态。若已完成支付，请稍候几秒。
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">支付状态未确认</h1>
            <p className="mt-3 text-sm leading-7 text-[#3A3733]/72">
              未拿到有效订单号，或订单查询失败。你可以返回定价页重新发起一次支付。
            </p>
          </>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button type="button" asChild className="rounded-full bg-[#3A3733] text-[#F5F3F0] hover:bg-[#3A3733]/92">
            <Link to={ROUTES.LABS}>返回 Labs</Link>
          </Button>
          <Button type="button" asChild variant="outline" className="rounded-full border-[#3A3733]/14 bg-transparent text-[#3A3733]">
            <Link to={ROUTES.PREMIUM}>返回定价页</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export default PaymentSuccessPage
