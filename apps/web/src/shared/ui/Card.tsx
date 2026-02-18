import type { ReactNode, ComponentProps } from 'react'

type CardProps = {
  title?: string
  eyebrow?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
} & ComponentProps<'section'>

const Card = ({ title, eyebrow, actions, children, className, ...props }: CardProps) => {
  return (
    <section className={`card ${className ?? ''}`} {...props}>
      {(title || eyebrow || actions) && (
        <header className="card__header">
          <div>
            {eyebrow && <span className="card__eyebrow">{eyebrow}</span>}
            {title && <h3 className="card__title">{title}</h3>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  )
}

export default Card
