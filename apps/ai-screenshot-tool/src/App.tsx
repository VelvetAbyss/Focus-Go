import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import './App.css'
import { StatusCard } from './components/StatusCard'
import {
  captureScreen,
  completeCaptureOutput,
  getCaptureShortcut,
  getMonitors,
  getMonitorAtCursor,
  getOutputDirectory,
  getWindows,
  hideOverlay,
  listenCaptureShortcut,
  registerCaptureShortcut,
  resolveCaptureImageSrc,
  showOverlay,
  type CaptureArtifact,
  type CompleteCaptureOutputResult,
  type MonitorBounds,
  type WindowInfo,
} from './native/screenshotCommands'
import { useRuntimePlatform } from './hooks/useRuntimePlatform'
import { useEcosystemAdapters } from './integrations/useEcosystemAdapters'
import {
  findSnapWindow,
  rectFromPoints,
  toLocalRect,
  type Point,
  type Rect,
} from './features/selection/selectionMath'

const formatError = (value: unknown): string =>
  value instanceof Error ? value.message : String(value)

const getPointerPoint = (event: PointerEvent<HTMLDivElement>): Point => {
  const bounds = event.currentTarget.getBoundingClientRect()
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  }
}

function App() {
  const nativeRuntime = isTauri()
  const runtimePlatform = useRuntimePlatform()
  const { adapters, error: adapterError } = useEcosystemAdapters()

  const [capture, setCapture] = useState<CaptureArtifact | null>(null)
  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [monitors, setMonitors] = useState<MonitorBounds[]>([])
  const [overlayBounds, setOverlayBounds] = useState<MonitorBounds | null>(null)
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null)
  const [snappedWindowId, setSnappedWindowId] = useState<number | null>(null)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [currentShortcut, setCurrentShortcut] = useState('CommandOrControl+Shift+X')
  const [shortcutInput, setShortcutInput] = useState('CommandOrControl+Shift+X')
  const [outputDirectory, setOutputDirectory] = useState<string | null>(null)
  const [lastOutput, setLastOutput] = useState<CompleteCaptureOutputResult | null>(null)
  const isBusyRef = useRef(false)

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
  }, [])

  useEffect(() => {
    if (!nativeRuntime) return

    let active = true
    Promise.all([getMonitors(), getOutputDirectory()])
      .then(([monitorItems, savedOutputDirectory]) => {
        if (!active) return
        setMonitors(monitorItems)
        setOutputDirectory(savedOutputDirectory)
      })
      .catch(() => {
        if (!active) return
        setMonitors([])
      })

    return () => {
      active = false
    }
  }, [nativeRuntime])

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => {
      setToastMessage(null)
    }, 2800)

    return () => window.clearTimeout(timer)
  }, [toastMessage])

  const captureImageSrc = useMemo(
    () => (capture ? resolveCaptureImageSrc(capture) : null),
    [capture],
  )

  const selectionLabel = useMemo(() => {
    if (!selectionRect) return 'No selection'
    const { x, y, width, height } = selectionRect
    const snapLabel = snappedWindowId ? ` | snapped to window ${snappedWindowId}` : ''
    return `x:${Math.round(x)} y:${Math.round(y)} w:${Math.round(width)} h:${Math.round(height)}${snapLabel}`
  }, [selectionRect, snappedWindowId])

  const handleCaptureFlow = useCallback(async (source: 'manual' | 'shortcut' = 'manual') => {
    if (isBusyRef.current) return
    isBusyRef.current = true
    setIsBusy(true)
    setCommandError(null)

    try {
      const monitorId =
        source === 'shortcut'
          ? (await getMonitorAtCursor()).monitorId ?? undefined
          : undefined

      const [artifact, windowItems] = await Promise.all([
        captureScreen(monitorId),
        getWindows(),
      ])
      const bounds = await showOverlay(artifact.monitorId ?? monitorId)
      setCapture(artifact)
      setWindows(windowItems)
      setOverlayBounds(bounds)
      setSelectionRect(null)
      setSnappedWindowId(null)
      setLastOutput(null)
    } catch (error) {
      setCommandError(formatError(error))
      showToast(formatError(error))
    } finally {
      isBusyRef.current = false
      setIsBusy(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!nativeRuntime) return

    let unlisten: (() => void) | undefined
    let active = true

    const setupShortcut = async () => {
      try {
        const shortcut = await getCaptureShortcut()
        if (!active) return
        setCurrentShortcut(shortcut)
        setShortcutInput(shortcut)
      } catch (error) {
        if (!active) return
        setCommandError(formatError(error))
      }

      try {
        unlisten = await listenCaptureShortcut(() => {
          void handleCaptureFlow('shortcut')
        })
      } catch (error) {
        if (!active) return
        setCommandError(formatError(error))
      }
    }

    void setupShortcut()

    return () => {
      active = false
      if (unlisten) {
        unlisten()
      }
    }
  }, [handleCaptureFlow, nativeRuntime])

  const handleUpdateShortcut = async () => {
    if (!nativeRuntime) return

    try {
      const updated = await registerCaptureShortcut(shortcutInput)
      setCurrentShortcut(updated)
      setShortcutInput(updated)
      setCommandError(null)
      showToast(`Shortcut updated: ${updated}`)
    } catch (error) {
      const message = formatError(error)
      setCommandError(message)
      showToast(message)
    }
  }

  const handleExitOverlay = async () => {
    try {
      await hideOverlay()
      setCapture(null)
      setOverlayBounds(null)
      setSelectionRect(null)
      setSnappedWindowId(null)
      setDragStart(null)
    } catch (error) {
      const message = formatError(error)
      setCommandError(message)
      showToast(message)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!capture) return
    const point = getPointerPoint(event)
    setDragStart(point)
    setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 })
    setSnappedWindowId(null)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!capture || !dragStart) return
    const point = getPointerPoint(event)

    const globalPointer: Point = {
      x: capture.monitorX + point.x,
      y: capture.monitorY + point.y,
    }
    const snappedWindow = findSnapWindow(windows, globalPointer, capture.monitorId)

    if (snappedWindow) {
      setSelectionRect(
        toLocalRect(snappedWindow, {
          x: capture.monitorX,
          y: capture.monitorY,
        }),
      )
      setSnappedWindowId(snappedWindow.id)
      return
    }

    setSelectionRect(rectFromPoints(dragStart, point))
    setSnappedWindowId(null)
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragStart(null)
  }

  const handleClearSelection = () => {
    setSelectionRect(null)
    setSnappedWindowId(null)
  }

  const handleCompleteSelection = useCallback(async () => {
    if (!capture || !selectionRect) {
      showToast('Please create a selection first')
      return
    }

    setIsBusy(true)
    isBusyRef.current = true

    try {
      const result = await completeCaptureOutput({
        captureId: capture.captureId,
        imagePath: capture.imagePath,
        selection: {
          x: selectionRect.x,
          y: selectionRect.y,
          width: selectionRect.width,
          height: selectionRect.height,
        },
      })

      setLastOutput(result)
      setOutputDirectory(result.outputDirectory)
      showToast(`Saved ${result.fileName} and copied to clipboard`)
      await hideOverlay()
      setCapture(null)
      setOverlayBounds(null)
      setSelectionRect(null)
      setSnappedWindowId(null)
      setDragStart(null)
    } catch (error) {
      const message = formatError(error)
      setCommandError(message)
      showToast(message)
    } finally {
      isBusyRef.current = false
      setIsBusy(false)
    }
  }, [capture, selectionRect, showToast])

  useEffect(() => {
    if (!capture || !selectionRect) return

    const handleWindowKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void handleCompleteSelection()
      }
    }

    window.addEventListener('keydown', handleWindowKeydown)
    return () => window.removeEventListener('keydown', handleWindowKeydown)
  }, [capture, selectionRect, handleCompleteSelection])

  const toolbarPosition = useMemo(() => {
    if (!capture || !selectionRect) return null
    const baseLeft = selectionRect.x + selectionRect.width - 250
    const baseTop = selectionRect.y + selectionRect.height + 10

    return {
      left: Math.max(8, Math.min(baseLeft, capture.width - 258)),
      top: Math.max(8, Math.min(baseTop, capture.height - 52)),
    }
  }, [capture, selectionRect])

  return (
    <main className="app">
      <header>
        <p className="eyebrow">Focus&Go Ecosystem</p>
        <h1>AI Screenshot Tool</h1>
        <p className="subtitle">
          Capture screen with native Rust commands, snap to detected windows, and run overlay
          interaction in one flow.
        </p>
      </header>

      <section className="status-grid">
        <StatusCard title="Runtime" value={runtimePlatform} />
        <StatusCard title="Hotkey" value={currentShortcut} />
        <StatusCard
          title="Ecosystem Adapters"
          value={adapters ? 'Configured' : `Blocked: ${adapterError?.message ?? 'Unknown error'}`}
        />
        <StatusCard
          title="Monitors"
          value={monitors.length > 0 ? `${monitors.length} detected` : 'Unavailable in web runtime'}
        />
      </section>

      <section className="control-panel">
        <button
          className="action-btn"
          type="button"
          onClick={() => void handleCaptureFlow('manual')}
          disabled={isBusy}
        >
          {isBusy ? 'Running capture flow...' : 'Capture + Overlay + Snap'}
        </button>
        <button className="action-btn ghost" type="button" onClick={handleExitOverlay}>
          Exit Overlay Mode
        </button>
        <div className="shortcut-row">
          <input
            className="shortcut-input"
            type="text"
            value={shortcutInput}
            onChange={(event) => setShortcutInput(event.target.value)}
            placeholder="CommandOrControl+Shift+X"
          />
          <button
            className="action-btn ghost"
            type="button"
            onClick={handleUpdateShortcut}
            disabled={!nativeRuntime}
          >
            Update Shortcut
          </button>
        </div>
        <p className="inline-note">{selectionLabel}</p>
        {capture ? (
          <p className="inline-note">
            Capture {capture.captureId.slice(0, 8)} | {capture.width}x{capture.height} | transfer:
            {' '}
            {capture.transferMode}
          </p>
        ) : null}
        {overlayBounds ? (
          <p className="inline-note">
            Overlay monitor origin: ({overlayBounds.x}, {overlayBounds.y}) size:
            {' '}
            {overlayBounds.width}x{overlayBounds.height}
          </p>
        ) : null}
        {outputDirectory ? (
          <p className="inline-note">Output directory: {outputDirectory}</p>
        ) : (
          <p className="inline-note">Output directory: not selected yet (will prompt on first complete)</p>
        )}
        {lastOutput ? (
          <p className="inline-note">Last output: {lastOutput.savedPath}</p>
        ) : null}
        {commandError ? <p className="inline-error">{commandError}</p> : null}
      </section>

      <section className="overlay-shell">
        {capture && captureImageSrc ? (
          <div
            className="overlay-stage"
            style={{ width: capture.width, height: capture.height }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <img className="capture-image" src={captureImageSrc} alt="Screen capture" />
            {selectionRect ? (
              <>
                <div
                  className={`selection-rect ${snappedWindowId ? 'snapped' : ''}`}
                  style={{
                    left: selectionRect.x,
                    top: selectionRect.y,
                    width: selectionRect.width,
                    height: selectionRect.height,
                  }}
                />
                {toolbarPosition ? (
                  <div
                    className="overlay-toolbar"
                    style={{ left: toolbarPosition.left, top: toolbarPosition.top }}
                  >
                    <button
                      className="toolbar-btn primary"
                      type="button"
                      onClick={() => void handleCompleteSelection()}
                      disabled={isBusy}
                    >
                      完成 (Enter)
                    </button>
                    <button className="toolbar-btn" type="button" onClick={handleClearSelection}>
                      Cancel
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <div className="overlay-placeholder">
            Run <code>Capture + Overlay + Snap</code> or press your global shortcut to begin.
          </div>
        )}
      </section>
      {toastMessage ? <div className="toast">{toastMessage}</div> : null}
    </main>
  )
}

export default App
