import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type AnimatedPlanCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  className?: string
}

const AnimatedPlanCheckbox = ({ className, ...props }: AnimatedPlanCheckboxProps) => {
  const isChecked = props.checked === true

  return (
    <span className={cn('widget-plan-checkbox-wrap', className)} data-checked={isChecked ? 'true' : 'false'}>
      <input type="checkbox" className="widget-plan-checkbox-input" {...props} />
      <svg className="widget-plan-checkbox-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 8.5L6.8 11.2L12 5.5" />
      </svg>
    </span>
  )
}

export default AnimatedPlanCheckbox
