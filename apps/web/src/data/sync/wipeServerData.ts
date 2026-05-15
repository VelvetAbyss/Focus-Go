import { fetchApi } from '../../shared/apiBase'
import { getAuth } from '../../store/auth'

export type WipeServerDataResult = {
  ok: true
  wipedAt: number
  rowsDeleted: number
}

// Wipes all sync rows + blobs for the authenticated user on the server, and
// resets the server-side initial seed marker. The local DB and storage MUST be
// cleared by the caller AFTER this resolves — otherwise the next sync cycle
// would push local data back up and undo the wipe.
export const wipeServerData = async (): Promise<WipeServerDataResult> => {
  const auth = getAuth()
  const headers: HeadersInit = auth?.accessToken
    ? { Authorization: `Bearer ${auth.accessToken}` }
    : {}
  const res = await fetchApi('/user/data', {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'wipe-my-data' }),
  })
  if (!res.ok) {
    let detail = `${res.status}`
    try {
      const body = await res.json() as { error?: string }
      if (body?.error) detail = `${res.status} ${body.error}`
    } catch { /* body not json */ }
    throw new Error(`wipe failed: ${detail}`)
  }
  return res.json() as Promise<WipeServerDataResult>
}
