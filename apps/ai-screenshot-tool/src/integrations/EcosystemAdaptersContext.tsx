import { useMemo, type PropsWithChildren } from 'react'
import type { EcosystemAdapterBundle } from '@focus-go/core'
import { EcosystemAdaptersContext, resolveEcosystemAdaptersContextValue } from './EcosystemAdaptersState'

type EcosystemAdaptersProviderProps = PropsWithChildren<{
  adapters?: EcosystemAdapterBundle
}>

export const EcosystemAdaptersProvider = ({ adapters, children }: EcosystemAdaptersProviderProps) => {
  const value = useMemo(() => resolveEcosystemAdaptersContextValue(adapters), [adapters])

  return <EcosystemAdaptersContext.Provider value={value}>{children}</EcosystemAdaptersContext.Provider>
}
