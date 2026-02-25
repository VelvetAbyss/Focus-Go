import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type FocusPortalProps = {
  immersive: boolean
  onExitImmersion: () => void
  onToggleSidebar: () => void
  children: ReactNode
}

const FocusPortal = ({ immersive, onExitImmersion, onToggleSidebar, children }: FocusPortalProps) => {
  return (
    <section className={`focus-portal ${immersive ? 'is-immersive' : ''}`}>
      {immersive ? <div className="focus-portal__veil" /> : null}

      <div className="focus-portal__controls">
        <Button type="button" variant="outline" onClick={onToggleSidebar}>
          Toggle Nav
        </Button>
        {immersive ? (
          <Button type="button" variant="outline" onClick={onExitImmersion}>
            Exit Immersion
          </Button>
        ) : null}
      </div>

      <div className="focus-portal__content">{children}</div>
    </section>
  )
}

export default FocusPortal
