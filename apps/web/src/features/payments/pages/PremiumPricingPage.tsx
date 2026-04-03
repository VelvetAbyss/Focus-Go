import { useState } from 'react'
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ROUTES } from '../../../app/routes/routes'
import { startPremiumCheckout } from '../paymentFlow'

const PremiumPricingPage = () => {
  const [loading, setLoading] = useState<'alipay' | 'wxpay' | null>(null)

  const handleCheckout = async (payType: 'alipay' | 'wxpay') => {
    setLoading(payType)
    try {
      await startPremiumCheckout(payType)
    } finally {
      setLoading(null)
    }
  }

  return (
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
              <h1 className="text-4xl font-semibold tracking-[-0.04em]">测试价月付</h1>
              <p className="max-w-2xl text-sm leading-7 text-[#3A3733]/72">
                第一版先打通 Z-Pay 支付链路。支付成功后立即延长 1 个月会员。
              </p>
            </div>
          </div>
          <div className="rounded-[28px] border border-[#3A3733]/10 bg-white/70 px-5 py-4 text-right shadow-[0_18px_60px_rgba(58,55,51,0.08)]">
            <div className="text-xs uppercase tracking-[0.16em] text-[#3A3733]/56">当前测试价</div>
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
                <p className="text-sm text-[#3A3733]/68">下单后跳转到 Z-Pay 收银台。</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                className="h-12 rounded-full bg-[#3A3733] text-[#F5F3F0] hover:bg-[#3A3733]/92"
                disabled={loading !== null}
                onClick={() => void handleCheckout('alipay')}
              >
                {loading === 'alipay' ? '跳转中…' : '支付宝'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-full border-[#3A3733]/14 bg-transparent text-[#3A3733]"
                disabled={loading !== null}
                onClick={() => void handleCheckout('wxpay')}
              >
                {loading === 'wxpay' ? '跳转中…' : '微信支付'}
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
  )
}

export default PremiumPricingPage
