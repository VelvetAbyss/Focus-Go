import type { IDatabaseService } from '@focus-go/core'
import { createDexieDatabaseService } from './DexieDatabaseService'

export const dbService: IDatabaseService = createDexieDatabaseService()
