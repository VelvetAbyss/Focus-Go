// Notifications are hints. Checkpoint pull remains authoritative, including
// after restart, reconnect or when another API process accepted the write.
export const createSyncEvents = () => {
  const accounts = new Map()
  return {
    subscribe(userId, listener) {
      const listeners = accounts.get(userId) ?? new Set()
      if (listeners.size >= 8) throw new Error('sync_stream_limit')
      listeners.add(listener)
      accounts.set(userId, listeners)
      return () => {
        listeners.delete(listener)
        if (!listeners.size) accounts.delete(userId)
      }
    },
    publish(userId, entityType) {
      for (const listener of accounts.get(userId) ?? []) {
        try { listener({ type: 'changed', entityType }) } catch { accounts.get(userId)?.delete(listener) }
      }
    },
  }
}
