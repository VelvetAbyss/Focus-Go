import type { ComponentProps } from 'react'
import {
  Circle,
  Coffee,
  CreditCard,
  Home,
  ShoppingBag,
  Toolbox,
  UtensilsCrossed,
} from 'lucide-react'

const ICONS = {
  Circle,
  Coffee,
  CreditCard,
  Home,
  ShoppingBag,
  Toolbox,
  UtensilsCrossed,
} as const

export type SpendIconKey = keyof typeof ICONS

export const EMOJI_TO_ICON_KEY: Record<string, SpendIconKey> = {
  '🍜': 'UtensilsCrossed',
  '🍔': 'UtensilsCrossed',
  '☕️': 'Coffee',
  '☕': 'Coffee',
  '🧰': 'Toolbox',
  '🛍️': 'ShoppingBag',
  '🛍': 'ShoppingBag',
  '🏠': 'Home',
  '💳': 'CreditCard',
}

export function renderSpendIcon(
  iconKey: string | undefined,
  props: Omit<ComponentProps<'svg'>, 'ref'> & { size?: number } = {}
) {
  const resolvedKey =
    iconKey && iconKey in EMOJI_TO_ICON_KEY ? EMOJI_TO_ICON_KEY[iconKey] : (iconKey as SpendIconKey | undefined)
  const Icon = resolvedKey && resolvedKey in ICONS ? ICONS[resolvedKey] : ICONS.Circle
  return <Icon aria-hidden focusable={false} {...props} />
}
