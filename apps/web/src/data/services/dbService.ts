import type { IDatabaseService } from '@focus-go/core'
import { createDexieDatabaseService } from './DexieDatabaseService'
import { createIPCDatabaseService, type ElectronDatabaseApi } from './IPCDatabaseService'

const getElectronApi = (): ElectronDatabaseApi | undefined =>
  typeof window === 'undefined' ? undefined : window.electronAPI

export const resolveDatabaseService = (
  electronApi: ElectronDatabaseApi | undefined = getElectronApi()
): IDatabaseService => {
  if (electronApi?.invokeDb) {
    return createIPCDatabaseService(electronApi)
  }
  return createDexieDatabaseService()
}

export const dbService: IDatabaseService = resolveDatabaseService()
