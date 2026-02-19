import { createContext } from 'react'
import type { EcosystemAdapterBundle } from '@focus-go/core'
import { createHttpEcosystemAdaptersFromEnv } from './createHttpEcosystemAdapters'

export type EcosystemAdaptersContextValue = {
  adapters: EcosystemAdapterBundle | null
  error: Error | null
}

export const resolveEcosystemAdaptersContextValue = (
  adapters?: EcosystemAdapterBundle,
): EcosystemAdaptersContextValue => {
  if (adapters) {
    return { adapters, error: null }
  }

  try {
    return {
      adapters: createHttpEcosystemAdaptersFromEnv(),
      error: null,
    }
  } catch (error) {
    return {
      adapters: null,
      error: error as Error,
    }
  }
}

export const EcosystemAdaptersContext = createContext<EcosystemAdaptersContextValue>(
  resolveEcosystemAdaptersContextValue(),
)
