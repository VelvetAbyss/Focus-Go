export const installReactScan = async () => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  if (window.localStorage.getItem('focusgo.perf.reactScan') !== '1') return

  const { scan } = await import('react-scan')
  scan({
    enabled: true,
    showToolbar: true,
    showFPS: true,
    trackUnnecessaryRenders: false,
  })
}
