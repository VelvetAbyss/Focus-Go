import type { CrmActivity, CrmCustomer, CrmDeal, CrmMode, CrmStage } from '../../data/models/crm'
import type { TaskItem } from '../../data/models/types'

export const STAGES: CrmStage[] = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
export const CURRENCIES = ['CNY', 'USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'CHF', 'HKD', 'SGD']
export const stageLabel = (stage: CrmStage, mode: CrmMode, zh: boolean) => ({
  b2b: { new: ['新线索', 'New lead'], qualified: ['需求确认', 'Qualified'], proposal: ['方案报价', 'Proposal'], negotiation: ['商务洽谈', 'Negotiation'], won: ['已赢单', 'Won'], lost: ['已流失', 'Lost'] },
  b2c: { new: ['新咨询', 'New enquiry'], qualified: ['了解需求', 'Discovery'], proposal: ['推荐方案', 'Offer'], negotiation: ['购买意向', 'Decision'], won: ['已成交', 'Purchased'], lost: ['未成交', 'Not purchased'] },
}[mode][stage][zh ? 0 : 1])
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const isOpenTask = (task: TaskItem) => !['done', 'dropped'].includes(task.status)
export const isOpenDeal = (deal: CrmDeal) => !['won', 'lost'].includes(deal.stage)
export const customerRoute = (customer: Pick<CrmCustomer, 'id' | 'mode'>) => `/crm?mode=${customer.mode}&customer=${encodeURIComponent(customer.id)}`
export const nextTasks = (id: string, activities: CrmActivity[], tasks: TaskItem[]) => {
  const linked = new Set(activities.filter(a => a.customerId === id && a.taskId).map(a => a.taskId))
  return tasks.filter(t => linked.has(t.id) && isOpenTask(t)).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt - b.createdAt)
}
export const matchesCustomer = (c: CrmCustomer, query: string) => [c.name, c.email, c.phone, c.source, c.owner, c.industry, c.needs, ...c.tags, ...c.contacts.flatMap(p => [p.name, p.email, p.phone, p.role])].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
export const totalsByCurrency = (deals: CrmDeal[]) => deals.reduce<Record<string, number>>((totals, deal) => {
  totals[deal.currency] = (totals[deal.currency] ?? 0) + deal.amount
  return totals
}, {})
export const duplicateCustomer = (candidate: Pick<CrmCustomer, 'mode' | 'name' | 'email' | 'phone'>, existing: CrmCustomer[]) => {
  const email = candidate.email.trim().toLowerCase()
  const phone = candidate.phone.replace(/[^\d+]/g, '')
  return existing.find(c => c.mode === candidate.mode && (
    (email && c.email.trim().toLowerCase() === email) ||
    (phone && c.phone.replace(/[^\d+]/g, '') === phone) ||
    (candidate.mode === 'b2b' && c.name.trim().toLowerCase() === candidate.name.trim().toLowerCase())
  ))
}

// RFC 4180-style CSV, including multiline quoted fields. Never evaluate spreadsheet formulas.
export const parseCsv = (source: string): string[][] => {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false; let afterQuote = false
  const text = source.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (afterQuote && char !== ',' && char !== '\n' && char !== '\r') throw new Error('invalidCsv')
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else if (quoted || !field) { afterQuote = quoted; quoted = !quoted }
      else throw new Error('invalidCsv')
    } else if (char === ',' && !quoted) { row.push(field); field = ''; afterQuote = false }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ''; afterQuote = false
    } else field += char
  }
  if (quoted) throw new Error('invalidCsv')
  row.push(field); if (row.some(Boolean)) rows.push(row)
  return rows
}
export const CSV_HEADERS = ['mode', 'name', 'email', 'phone', 'source', 'industry', 'needs', 'owner', 'tags', 'doNotContact']
export const csvCell = (value: string) => `"${(/^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`
export const exportCustomers = (customers: CrmCustomer[]) => '\uFEFF' + [CSV_HEADERS, ...customers.map(c => [c.mode, c.name, c.email, c.phone, c.source, c.industry, c.needs, c.owner, c.tags.join(';'), String(c.doNotContact)])].map(row => row.map(csvCell).join(',')).join('\r\n')

export type ActivityDraft = { body: string; kind: 'call' | 'email' | 'meeting' | 'note'; nextAction: string; dueDate: string; reminderTime: string; requestId: string }
export const freshDraft = (): ActivityDraft => ({ body: '', kind: 'call', nextAction: '', dueDate: dayKey(), reminderTime: '', requestId: crypto.randomUUID() })
