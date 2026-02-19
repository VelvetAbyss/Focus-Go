import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type CaptureArtifact = {
  captureId: string
  monitorId: number | null
  monitorX: number
  monitorY: number
  width: number
  height: number
  pixelFormat: string
  transferMode: string
  imagePath: string
  bytesLen: number
}

export type WindowInfo = {
  id: number
  monitorId: number | null
  appName: string
  title: string
  x: number
  y: number
  width: number
  height: number
  z: number
  isFocused: boolean
}

export type MonitorBounds = {
  monitorId: number | null
  x: number
  y: number
  width: number
  height: number
  isPrimary: boolean
}

export type ShortcutTriggeredPayload = {
  shortcut: string
}

export type SelectionRectInput = {
  x: number
  y: number
  width: number
  height: number
}

export type CompleteCaptureOutputRequest = {
  captureId: string
  imagePath: string
  selection: SelectionRectInput
}

export type CompleteCaptureOutputResult = {
  captureId: string
  savedPath: string
  fileName: string
  outputDirectory: string
  copiedToClipboard: boolean
}

const CAPTURE_SHORTCUT_EVENT = 'focusgo://capture-shortcut'

const ensureTauri = (): void => {
  if (!isTauri()) {
    throw new Error('Tauri runtime is required for native screenshot commands')
  }
}

export const captureScreen = async (monitorId?: number): Promise<CaptureArtifact> => {
  ensureTauri()
  return invoke<CaptureArtifact>('capture_screen', { monitorId })
}

export const getWindows = async (): Promise<WindowInfo[]> => {
  ensureTauri()
  return invoke<WindowInfo[]>('get_windows')
}

export const getMonitors = async (): Promise<MonitorBounds[]> => {
  ensureTauri()
  return invoke<MonitorBounds[]>('get_monitors')
}

export const getMonitorAtCursor = async (): Promise<MonitorBounds> => {
  ensureTauri()
  return invoke<MonitorBounds>('get_monitor_at_cursor')
}

export const showOverlay = async (monitorId?: number): Promise<MonitorBounds> => {
  ensureTauri()
  return invoke<MonitorBounds>('show_overlay', { monitorId })
}

export const hideOverlay = async (): Promise<void> => {
  ensureTauri()
  await invoke('hide_overlay')
}

export const getCaptureShortcut = async (): Promise<string> => {
  ensureTauri()
  return invoke<string>('get_capture_shortcut')
}

export const registerCaptureShortcut = async (shortcut: string): Promise<string> => {
  ensureTauri()
  return invoke<string>('register_capture_shortcut', { shortcut })
}

export const getOutputDirectory = async (): Promise<string | null> => {
  ensureTauri()
  return invoke<string | null>('get_output_directory')
}

export const completeCaptureOutput = async (
  request: CompleteCaptureOutputRequest,
): Promise<CompleteCaptureOutputResult> => {
  ensureTauri()
  return invoke<CompleteCaptureOutputResult>('complete_capture_output', { request })
}

export const listenCaptureShortcut = async (
  handler: (payload: ShortcutTriggeredPayload) => void,
): Promise<UnlistenFn> => {
  ensureTauri()
  return listen<ShortcutTriggeredPayload>(CAPTURE_SHORTCUT_EVENT, (event) => {
    handler(event.payload)
  })
}

export const resolveCaptureImageSrc = (artifact: CaptureArtifact): string =>
  isTauri() ? convertFileSrc(artifact.imagePath) : artifact.imagePath
