import { enMessages } from './messages/en'
import { primeMessages } from './loader'

// Keep EN primed for any unit/integration test that touches `t()`.
primeMessages('en', enMessages as Record<string, string>)

export function createMockT() {
  return (key: string, values?: Record<string, string | number>) => {
    const msg = (enMessages as Record<string, string>)[key]
    if (!msg) return key
    if (!values) return msg
    return msg.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, k: string) => String(values[k] ?? `{{${k}}}`))
  }
}

export const mockUseI18n = () => ({
  t: createMockT(),
  language: 'en' as const,
})
