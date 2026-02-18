import type { IpcChannel } from '@focus-go/db-contracts'

declare global {
  interface Window {
    electronAPI?: {
      invokeDb: (channel: IpcChannel, payload?: unknown) => Promise<unknown>
      selectImportFile: () => Promise<{ canceled: true } | { canceled: false; filePath: string }>
      readImportFile: (filePath: string) => Promise<string>
      importDexieJsonFromFile: (filePath: string) => Promise<{ backupPath: string; importedRows: number }>
    }
  }
}

export {}
