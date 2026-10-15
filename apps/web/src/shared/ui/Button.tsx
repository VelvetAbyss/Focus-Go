import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { typography } from '../theme/typography'
import './Button.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, disabled, style, ...props }, ref) => {
  const classes = ['btn', 'btn--pressable', className].filter(Boolean).join(' ')
  return <button ref={ref} className={classes} disabled={disabled} data-type-role="control" style={{ ...typography.control, ...style }} {...props} />
})

Button.displayName = 'Button'

export default Button
