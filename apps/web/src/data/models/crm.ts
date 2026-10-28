import type { BaseEntity } from './types'

export type CrmMode = 'b2b' | 'b2c'
export type CrmStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type CrmContact = { id: string; name: string; role: string; email: string; phone: string }
export type CrmCustomer = BaseEntity & {
  mode: CrmMode
  name: string
  email: string
  phone: string
  source: string
  industry: string
  needs: string
  owner: string
  tags: string[]
  contacts: CrmContact[]
  doNotContact: boolean
  archivedAt: number | null
}
export type CrmDeal = BaseEntity & {
  customerId: string
  title: string
  stage: CrmStage
  amount: number
  currency: string
  expectedCloseDate: string
  lossReason: string
  closedAt: number | null
}
export type CrmActivity = BaseEntity & {
  customerId: string
  kind: 'call' | 'email' | 'meeting' | 'note' | 'followup' | 'stage'
  body: string
  occurredAt: number
  taskId?: string
  noteId?: string
  dealId?: string
}
