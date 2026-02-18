import type { ReactNode } from 'react'

type FadeContentProps = {
  children: ReactNode
  className?: string
}

const FadeContent = ({ children, className }: FadeContentProps) => {
  return <div className={`fade-content ${className ?? ''}`}>{children}</div>
}

export default FadeContent
