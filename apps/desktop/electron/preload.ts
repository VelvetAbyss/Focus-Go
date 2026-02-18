import { contextBridge, ipcRenderer } from 'electron'
import { isWhitelistedChannel, type IpcChannel } from '@focus-go/db-contracts'

type ImportSelection =
  | { canceled: true }
  | {
      canceled: false
      filePath: string
    }

const electronAPI = {
  invokeDb(channel: IpcChannel, payload: unknown = {}) {
    if (!isWhitelistedChannel(channel)) {
      throw new Error(`Channel not allowed: ${channel}`)
    }
    return ipcRenderer.invoke(channel, payload)
  },
  selectImportFile() {
    return ipcRenderer.invoke('fs:selectImportFile') as Promise<ImportSelection>
  },
  readImportFile(filePath: string) {
    return ipcRenderer.invoke('fs:readImportFile', { filePath }) as Promise<string>
  },
  importDexieJsonFromFile(filePath: string) {
    return ipcRenderer.invoke('db:importDexieJsonFromFile', { filePath }) as Promise<{
      backupPath: string
      importedRows: number
    }>
  },
  onMainProcessMessage(listener: (message: string) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, message: string) => listener(message)
    ipcRenderer.on('main-process-message', wrapped)
    return () => {
      ipcRenderer.removeListener('main-process-message', wrapped)
    }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
