import { vertex, fragment } from './shader'
import { BRIDGE, makeBridge, makeTrain } from './trainModel'
import { createSteam } from './steam'
import type { TrainPalette, TrainSettings } from '../sceneSettings'

export type { TrainPalette } from '../sceneSettings'
export type TrainRenderOptions = TrainSettings & { palette: TrainPalette; paused: boolean }
export type TrainRenderer = { update: (options: TrainRenderOptions) => void; dispose: () => void }

/** One canvas owns its GPU resources and loop. No document-wide DOM queries. */
export function createTrainRenderer(
  canvas: HTMLCanvasElement,
  initial: TrainRenderOptions,
  onReady: (ready: boolean) => void,
): TrainRenderer {
  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, powerPreference: 'low-power',
  })
  if (!gl) { onReady(false); return { update() {}, dispose() {} } }
  let options = initial
  let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null
  let textures: WebGLTexture[] = []
  let uniforms: Record<string, WebGLUniformLocation | null> = {}
  let disposed = false, lost = false, ready = false, visible = true, raf = 0, last = 0
  let time = 0, travel = 0, viewportHeight = 1
  const steam = createSteam()
  steam.reset(options.speed * BRIDGE.worldWidth * BRIDGE.drift)

  function releaseResources() {
    gl!.useProgram(null)
    textures.forEach(texture => gl!.deleteTexture(texture)); textures = []
    if (buffer) gl!.deleteBuffer(buffer)
    if (program) gl!.deleteProgram(program)
    buffer = null; program = null
  }
  function compile(type: number, source: string) {
    const shader = gl!.createShader(type)
    if (!shader) throw new Error('Shader allocation failed')
    gl!.shaderSource(shader, source); gl!.compileShader(shader)
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      gl!.deleteShader(shader); throw new Error('Shader compilation failed')
    }
    return shader
  }
  function texture(source: HTMLCanvasElement | Uint8Array, unit: number, repeat = false) {
    const tex = gl!.createTexture()
    if (!tex) throw new Error('Texture allocation failed')
    textures.push(tex); gl!.activeTexture(gl!.TEXTURE0 + unit); gl!.bindTexture(gl!.TEXTURE_2D, tex)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, repeat ? gl!.REPEAT : gl!.CLAMP_TO_EDGE)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, repeat ? gl!.REPEAT : gl!.CLAMP_TO_EDGE)
    if (source instanceof Uint8Array) gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, 256, 256, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, source)
    else gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, source)
  }
  function draw() {
    if (!ready || lost || disposed) return
    gl!.uniform2f(uniforms.resolution, canvas.width, canvas.height)
    gl!.uniform1f(uniforms.time, time); gl!.uniform1f(uniforms.travel, travel)
    gl!.uniform1f(uniforms.billow, options.billow / 100); gl!.uniform1f(uniforms.detail, options.detail / 100)
    gl!.uniform1f(uniforms.steamAmount, options.steam / 100)
    gl!.uniform1f(uniforms.trainScale, options.trainScale / 100)
    gl!.uniform1f(uniforms.railOffset, options.railOffset / 100)
    gl!.uniform1f(uniforms.cloudLevel, options.cloudLevel / 100)
    gl!.uniform1f(uniforms.palette, { sunset: 0, morning: 1, night: 2 }[options.palette])
    gl!.uniform1f(uniforms.viewportHeight, viewportHeight)
    gl!.uniform1f(uniforms.compact, window.matchMedia('(max-width: 960px)').matches ? 1 : 0)
    gl!.uniform4fv(uniforms['steamParticles[0]'], steam.data)
    gl!.drawArrays(gl!.TRIANGLES, 0, 6)
  }
  function resize() {
    if (!ready || lost || disposed) return
    const bounds = canvas.getBoundingClientRect()
    viewportHeight = bounds.height
    const ratio = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(600000 / Math.max(1, bounds.width * bounds.height)))
    const width = Math.max(1, Math.round(bounds.width * ratio)), height = Math.max(1, Math.round(bounds.height * ratio))
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
    gl!.viewport(0, 0, width, height); draw()
  }
  const shouldRun = () => ready && !disposed && !lost && !options.paused && options.speed > 0 && visible && !document.hidden
  function tick(now: number) {
    raf = 0
    if (!shouldRun()) { last = 0; return }
    if (last && now - last < 1000 / 30 - 1) { raf = requestAnimationFrame(tick); return }
    const dt = last ? Math.min((now - last) / 1000, .08) : 0
    time += dt; travel += dt * options.speed
    steam.step(dt, options.speed * BRIDGE.worldWidth * BRIDGE.drift); last = now
    draw(); raf = requestAnimationFrame(tick)
  }
  function schedule() {
    if (shouldRun() && !raf) { last = 0; raf = requestAnimationFrame(tick) }
    else if (!shouldRun()) { cancelAnimationFrame(raf); raf = 0; last = 0 }
  }
  function initialize() {
    ready = false
    let vs: WebGLShader | null = null, fs: WebGLShader | null = null
    try {
      vs = compile(gl!.VERTEX_SHADER, vertex); fs = compile(gl!.FRAGMENT_SHADER, fragment)
      program = gl!.createProgram()
      if (!program) throw new Error('Program allocation failed')
      gl!.attachShader(program, vs); gl!.attachShader(program, fs); gl!.linkProgram(program)
      if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) throw new Error('Shader link failed')
      gl!.useProgram(program)
      buffer = gl!.createBuffer()
      if (!buffer) throw new Error('Buffer allocation failed')
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer)
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl!.STATIC_DRAW)
      const position = gl!.getAttribLocation(program, 'position')
      gl!.enableVertexAttribArray(position); gl!.vertexAttribPointer(position, 2, gl!.FLOAT, false, 0, 0)
      uniforms = Object.fromEntries(['resolution','time','travel','billow','detail','palette','viewportHeight','compact','steamAmount','trainScale','railOffset','cloudLevel','noiseMap','bridgeMap','trainMap','steamParticles[0]'].map(name => [name, gl!.getUniformLocation(program!, name)]))
      const noise = new Uint8Array(256 * 256 * 4)
      let seed = 89357
      for (let i = 0; i < noise.length; i += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        noise[i] = noise[i + 1] = noise[i + 2] = seed >>> 24; noise[i + 3] = 255
      }
      texture(noise, 0, true); texture(makeBridge(), 1); texture(makeTrain(), 2)
      gl!.uniform1i(uniforms.noiseMap, 0); gl!.uniform1i(uniforms.bridgeMap, 1); gl!.uniform1i(uniforms.trainMap, 2)
      ready = true; resize(); onReady(true)
    } catch {
      releaseResources(); onReady(false)
    } finally {
      if (vs) gl!.deleteShader(vs)
      if (fs) gl!.deleteShader(fs)
      schedule()
    }
  }
  const onLost = (event: Event) => {
    event.preventDefault(); lost = true; ready = false; schedule(); onReady(false)
    textures = []; program = null; buffer = null
  }
  const onRestored = () => { if (!disposed) { lost = false; initialize() } }
  const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true; schedule()
  }, { threshold: .01 })
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  intersection?.observe(canvas); observer?.observe(canvas)
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', schedule)
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  initialize()
  return {
    update(next) { if (disposed) return; options = next; draw(); schedule() },
    dispose() {
      disposed = true; ready = false; cancelAnimationFrame(raf)
      intersection?.disconnect(); observer?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', schedule)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      if (!lost) releaseResources()
    },
  }
}
