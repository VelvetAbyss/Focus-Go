import { useContext } from 'react'
import { EcosystemAdaptersContext, type EcosystemAdaptersContextValue } from './EcosystemAdaptersState'

export const useEcosystemAdapters = (): EcosystemAdaptersContextValue => useContext(EcosystemAdaptersContext)
