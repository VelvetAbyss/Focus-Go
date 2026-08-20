import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode, SyntheticEvent } from 'react'
import { useAuthGate } from './AuthGateContext'

const interactiveSelector = [
  'button',
  'input',
  'select',
  'textarea',
  'a[href]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const previewAllowedSelector = '[data-auth-preview-allowed="true"]'

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(interactiveSelector))

const isPreviewAllowedTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(previewAllowedSelector))

type AuthInteractionGateProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

const stopAndPrompt = (event: SyntheticEvent, requireAuth: (action: () => void) => void) => {
  event.preventDefault()
  event.stopPropagation()
  requireAuth(() => {})
}

const AuthInteractionGate = ({ children, className, style }: AuthInteractionGateProps) => {
  const { isGated, requireAuth } = useAuthGate()

  const guard = (event: SyntheticEvent) => {
    if (!isGated || isPreviewAllowedTarget(event.target)) return
    stopAndPrompt(event, requireAuth)
  }

  const guardKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['Enter', ' '].includes(event.key)) return
    if (!isInteractiveTarget(event.target)) return
    guard(event)
  }

  const guardPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (isGated && !isPreviewAllowedTarget(event.target) && isInteractiveTarget(event.target)) stopAndPrompt(event, requireAuth)
  }

  return (
    <div
      className={className}
      style={style}
      onClickCapture={guard}
      onChangeCapture={guard}
      onFocusCapture={guard}
      onKeyDownCapture={guardKeyboard}
      onPointerDownCapture={guardPointer}
    >
      {children}
    </div>
  )
}

export default AuthInteractionGate
