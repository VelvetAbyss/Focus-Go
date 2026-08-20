import { fetchApi } from '../../shared/apiBase'

export type SeedClaimResult = {
  shouldSeed: boolean
  seededAt: string | null
}

export const claimInitialSeed = async (): Promise<SeedClaimResult> => {
  const res = await fetchApi('/seed/claim', { method: 'POST' })
  if (!res.ok) throw new Error(`seed claim failed: ${res.status}`)
  return res.json() as Promise<SeedClaimResult>
}
