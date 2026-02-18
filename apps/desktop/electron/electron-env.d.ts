/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string
    VITE_PUBLIC: string
  }
}

interface Window {
  electronAPI: {
    invokeDb: (channel: import('@focus-go/db-contracts').IpcChannel, payload?: unknown) => Promise<unknown>
    selectImportFile: () => Promise<{ canceled: true } | { canceled: false; filePath: string }>
    readImportFile: (filePath: string) => Promise<string>
    importDexieJsonFromFile: (filePath: string) => Promise<{ backupPath: string; importedRows: number }>
    onMainProcessMessage: (listener: (message: string) => void) => () => void
  }
}
