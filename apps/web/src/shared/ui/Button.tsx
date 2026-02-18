import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import './Button.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, disabled, ...props }, ref) => {
  const classes = ['btn', 'btn--pressable', className].filter(Boolean).join(' ')
  return <button ref={ref} className={classes} disabled={disabled} {...props} />
})

Button.displayName = 'Button'

export default Button
