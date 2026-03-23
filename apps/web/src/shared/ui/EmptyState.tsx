import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type EmptyStateProps = {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'default' | 'onboarding'
  className?: string
}

const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[28px] border border-[#3A3733]/8 px-6 py-10 text-center text-[#3A3733]',
        variant === 'onboarding' ? 'bg-[#F5F3F0] shadow-[0_20px_60px_rgba(58,55,51,0.08)]' : 'bg-white/88',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#3A3733]/6 text-[#3A3733]">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[#3A3733]/72">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" className="mt-5 rounded-full bg-[#3A3733] px-5 text-[#F5F3F0] hover:bg-[#3A3733]/90" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export default EmptyState
