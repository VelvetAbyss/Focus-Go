/**
 * Motion visibility controller
 *
 * Pauses all CSS animations / transitions when the browser tab is hidden by
 * setting `data-animations="paused"` on <html>. CSS in styles.css picks this
 * up via:
 *   html[data-animations='paused'] *, html[data-animations='paused'] *::before,
 *   html[data-animations='paused'] *::after { animation-play-state: paused !important }
 *
 * Why this matters for low-end devices + battery:
 *   - Each infinite CSS animation still consumes GPU compositor time even when
 *     the tab is in the background.
 *   - On a dashboard with 15+ concurrent infinite animations, this adds up to
 *     continuous GPU/CPU drain that the user never sees.
 *   - Pausing via animation-play-state (not display:none) preserves animation
 *     progress so it resumes exactly where it left off — no visual discontinuity.
 */

let installed = false

function sync() {
  if (document.visibilityState === 'hidden') {
    document.documentElement.setAttribute('data-animations', 'paused')
  } else {
    document.documentElement.removeAttribute('data-animations')
  }
}

export function installMotionVisibilityController() {
  if (installed) return
  installed = true
  document.addEventListener('visibilitychange', sync)
  // Apply immediately in case the page was restored into background.
  sync()
}
