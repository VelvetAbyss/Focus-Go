import { useEffect, useMemo, useState } from 'react'
import type { LifeSubscription } from '../../../data/models/types'
import { subscriptionsRepo } from '../../../data/repositories/subscriptionsRepo'
import { SubscriptionCardSurface } from '../components/SubscriptionCardSurface'
import { buildSubscriptionPresentationModel } from './lifeDesignAdapters'

export type SubscriptionDraft = Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>

const SubscriptionsCard = () => {
  const [open, setOpen] = useState(false)
  const [subscriptions, setSubscriptions] = useState<LifeSubscription[]>([])
  const [loading, setLoading] = useState(false)

  const designModel = useMemo(() => buildSubscriptionPresentationModel(subscriptions), [subscriptions])

  useEffect(() => {
    const loadSubscriptions = async () => {
      setLoading(true)
      const rows = await subscriptionsRepo.list()
      setSubscriptions(rows)
      setLoading(false)
    }
    void loadSubscriptions()
  }, [])

  const handleCreate = async (draft: SubscriptionDraft) => {
    const created = await subscriptionsRepo.create(draft)
    setSubscriptions((current) => [created, ...current.filter((item) => item.id !== created.id)])
    return created
  }

  const handlePatch = async (id: string, patch: Partial<LifeSubscription>) => {
    const updated = await subscriptionsRepo.update(id, patch)
    if (!updated) return
    setSubscriptions((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
    return updated
  }

  const handleRemove = async (id: string) => {
    await subscriptionsRepo.remove(id)
    setSubscriptions((current) => current.filter((item) => item.id !== id))
  }

  return (
    <SubscriptionCardSurface
      model={designModel}
      subscriptions={subscriptions}
      open={open}
      loading={loading}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onCreateSubscription={(draft) => handleCreate(draft)}
      onPatchSubscription={(id, patch) => handlePatch(id, patch)}
      onRemoveSubscription={(id) => void handleRemove(id)}
    />
  )
}

export default SubscriptionsCard
