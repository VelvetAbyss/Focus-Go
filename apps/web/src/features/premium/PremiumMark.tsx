import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

type PremiumMarkProps = {
  className?: string
  variant?: 'pill' | 'dot'
}

const PremiumMark = ({ className, variant = 'pill' }: PremiumMarkProps) => (
  <span
    aria-hidden="true"
    className={cn(
      'premium-mark',
      variant === 'dot' ? 'premium-mark--dot' : 'premium-mark--pill',
      className,
    )}
  >
    <Crown size={variant === 'dot' ? 9 : 10} strokeWidth={1.8} />
  </span>
)

export default PremiumMark
