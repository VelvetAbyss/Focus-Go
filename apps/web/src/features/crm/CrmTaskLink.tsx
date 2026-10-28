import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { Link, useLocation } from 'react-router-dom'
import { Users } from 'lucide-react'
import { db } from '../../data/db'
import type { CrmCustomer } from '../../data/models/crm'
import { useI18n } from '../../shared/i18n/useI18n'
import { readCrmReturnPath } from '../../shared/navigation/returnPath'
import { customerRoute } from './crmModel'

/** A real reverse link, even when the task is opened from Calendar or Tasks. */
export default function CrmTaskLink({ taskId }: { taskId: string }) {
  const [customer, setCustomer] = useState<CrmCustomer>()
  const { language } = useI18n()
  const location = useLocation()
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const installed = await db.featureInstallations.where('featureKey').equals('crm').filter(row => row.state === 'installed').first()
      if (!installed) return undefined
      const activity = await db.crmActivities.where('taskId').equals(taskId).first()
      return activity ? db.crmCustomers.get(activity.customerId) : undefined
    }).subscribe({ next: setCustomer, error: () => setCustomer(undefined) })
    return () => subscription.unsubscribe()
  }, [taskId])
  if (!customer || readCrmReturnPath(location.search)) return null
  return <Link className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[var(--rule)] px-3 text-meta text-[var(--ink-2)] hover:bg-[var(--paper-sunken)]" to={customerRoute(customer)}>
    <Users className="h-3.5 w-3.5 shrink-0" />
    <span className="truncate">{language === 'zh' ? '客户' : 'Customer'} · {customer.name}</span>
  </Link>
}
