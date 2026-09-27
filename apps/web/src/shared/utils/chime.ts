/**
 * A soft two-note chime (E5 → A5), synthesized with Web Audio so it needs no asset.
 * Used when a focus session ends. Silently does nothing where audio isn't available
 * or the browser still blocks playback.
 */
let context: AudioContext | null = null

const getContext = () => {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context ??= new Ctor()
  return context
}

export const playChime = (volume = 0.18) => {
  try {
    const ctx = getContext()
    if (!ctx) return
    void ctx.resume().catch(() => {})
    const start = ctx.currentTime + 0.02
    ;[659.25, 880].forEach((frequency, index) => {
      const at = start + index * 0.22
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(volume, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 1.15)
    })
  } catch {
    // Audio is a nicety; never let it break completing a session.
  }
}
