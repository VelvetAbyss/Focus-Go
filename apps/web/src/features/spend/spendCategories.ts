import type { SpendCategory } from '../../data/models/types'

const presets = [
  { id: 'food', zh: '餐饮', en: 'Food', icon: 'UtensilsCrossed' },
  { id: 'transport', zh: '交通', en: 'Transport', icon: 'Bus' },
  { id: 'shopping', zh: '购物', en: 'Shopping', icon: 'ShoppingBag' },
  { id: 'leisure', zh: '娱乐', en: 'Entertainment', icon: 'Gamepad2' },
  { id: 'bills', zh: '账单', en: 'Bills', icon: 'Home' },
  { id: 'health', zh: '健康', en: 'Health', icon: 'HeartPulse' },
  { id: 'other', zh: '其他', en: 'Other', icon: 'Circle' },
] as const

export type SpendCategoryOption = Pick<SpendCategory, 'id' | 'name' | 'icon'> & { preset?: true }

export function getSpendCategoryOptions(categories: SpendCategory[], language: 'zh' | 'en') {
  const options: SpendCategoryOption[] = categories.map(category => ({ ...category }))
  let fallbackId = ''
  for (const preset of presets) {
    const existing = options.find(option => {
      const name = option.name.trim().toLowerCase()
      return name === preset.zh || name === preset.en.toLowerCase()
    })
    const id = existing?.id ?? `preset:${preset.id}`
    if (!existing) options.push({ id, name: preset[language], icon: preset.icon, preset: true })
    if (preset.id === 'other') fallbackId = id
  }
  return { options, fallbackId }
}
