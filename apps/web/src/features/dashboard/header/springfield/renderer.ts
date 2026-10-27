import { WORLD, createTerrain, createCloud, createPaper, createEdge, random, riverX, riverWidth, wrap } from './terrain'
import type { SpringSettings, SpringPalette } from '../sceneSettings'
export type SpringRenderOptions = Omit<SpringSettings, 'palette'> & { palette: SpringPalette }
export type SpringRenderer = { update: (options: SpringRenderOptions) => void; dispose: () => void }
let terrainCache: ReturnType<typeof createTerrain> | undefined
let spriteCache: ReturnType<typeof createCloud>[] | undefined

const TAU = Math.PI * 2
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function planeShape(ctx: CanvasRenderingContext2D, shadow = false) {
  ctx.beginPath(); ctx.moveTo(0, -27); ctx.bezierCurveTo(-4, -25, -4, -12, -3.5, -5)
  ctx.lineTo(-33, 3); ctx.lineTo(-34, 8); ctx.lineTo(-3, 4); ctx.lineTo(-2, 20)
  ctx.lineTo(-12, 24); ctx.lineTo(-12, 27); ctx.lineTo(0, 25); ctx.lineTo(12, 27); ctx.lineTo(12, 24)
  ctx.lineTo(2, 20); ctx.lineTo(3, 4); ctx.lineTo(34, 8); ctx.lineTo(33, 3); ctx.lineTo(3.5, -5)
  ctx.bezierCurveTo(4, -12, 4, -25, 0, -27); ctx.closePath()
  ctx.fillStyle = shadow ? '#365e634f' : '#faf7e7'; ctx.fill()
  if (shadow) return
  ctx.strokeStyle = '#778f8d77'; ctx.lineWidth = .6; ctx.stroke()
  ctx.strokeStyle = '#b7c5bd'; ctx.lineWidth = .8
  ctx.beginPath(); ctx.moveTo(-30, 5); ctx.lineTo(-5, 0); ctx.moveTo(30, 5); ctx.lineTo(5, 0); ctx.stroke()
  ctx.fillStyle = '#bdbfa6'; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(2, 21); ctx.lineTo(0, 25); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#668c98'; ctx.beginPath(); ctx.ellipse(0, -10, 2.25, 5, 0, 0, TAU); ctx.fill()
  ctx.fillStyle = '#9ebcc1'; ctx.beginPath(); ctx.ellipse(-.7, -12, .7, 2.5, 0, 0, TAU); ctx.fill()
  ctx.strokeStyle = '#b77e66'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-3, -19); ctx.lineTo(3, -19); ctx.moveTo(-10, 24); ctx.lineTo(10, 24); ctx.stroke()
}

export function createSpringRenderer(canvas: HTMLCanvasElement, initial: SpringRenderOptions, onReady: (ready: boolean) => void): SpringRenderer {
  const context = canvas.getContext('2d')
  if (!context) { onReady(false); return { update() {}, dispose() {} } }
  const ctx = context
  const terrain = terrainCache ??= createTerrain(), rng = random(98)
  const sprites = spriteCache ??= [createCloud(16), createCloud(37), createCloud(88)]
  const clouds = Array.from({length: 11}, (_, i) => ({ x: 140 + rng() * 850, y: i / 11 * WORLD.height, size: .55 + rng() * .5, sprite: i % 3, phase: rng() * TAU }))
  const ripples = Array.from({length: 70}, () => ({ y: rng() * WORLD.height, cross: (rng() - .5) * .7, phase: rng() * TAU, length: 2 + rng() * 5 }))
  let options = { ...initial }, width = 1, height = 1, dpr = 1
  let paper: HTMLCanvasElement | null = null, edge: HTMLCanvasElement | null = null
  let travel = 0, elapsed = 0, frames = 0, frame = 0, lastTime = 0, disposed = false, visible = true
  let resizeObserver: ResizeObserver | undefined, intersectionObserver: IntersectionObserver | undefined
  const running = () => !disposed && !options.paused && options.speed > 0 && !document.hidden && visible

  function draw() {
    if (disposed || !paper || !edge) return
    const zoom = options.zoom / 100
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#bad0b5'; ctx.fillRect(0, 0, width, height)
    const scale = Math.max(height / 460 * zoom, height / 720)
    const along = width / scale
    const centerX = 718
    const centerY = wrap(670 - travel, WORLD.height)
    const first = Math.floor((centerY - along / 2 - 230) / WORLD.height), last = Math.ceil((centerY + along / 2 + 230) / WORLD.height)
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.rotate(-Math.PI / 2)
    ctx.scale(scale, scale); ctx.translate(-centerX, -centerY)
    for (let tile = first; tile <= last; tile++) ctx.drawImage(terrain.canvas, 0, tile * WORLD.height)
    // Small glints move with the river, while all paper and pigment noise stays fixed.
    for (let tile = first; tile <= last; tile++) {
      for (const p of ripples) {
        const y = wrap(p.y + elapsed * 3, WORLD.height)
        const x = riverX(y) + p.cross * riverWidth(y)
        ctx.strokeStyle = `rgba(230,241,224,${.18 + .10 * Math.sin(elapsed * .7 + p.phase)})`; ctx.lineWidth = .9
        ctx.beginPath(); ctx.moveTo(x, y + tile * WORLD.height); ctx.lineTo(x + .5, y + p.length + tile * WORLD.height); ctx.stroke()
      }
      for (let i = 0; i < terrain.trees.length; i += 2) {
        const t = terrain.trees[i], life = wrap(elapsed * .042 + i * .137, 1)
        ctx.fillStyle = `rgba(248,216,219,${Math.sin(life * Math.PI) * .65})`
        ctx.beginPath(); ctx.ellipse(t.x + life * 24 + Math.sin(life * 9 + i) * 6, t.y + life * 30 + tile * WORLD.height, .9, 1.4, life * 4, 0, TAU); ctx.fill()
      }
    }
    const cloudPositions = clouds.map(c => ({ ...c, x: c.x + Math.sin(elapsed * .018 + c.phase) * 23, y: wrap(c.y - elapsed * 10, WORLD.height) }))
    ctx.globalAlpha = options.clouds / 100
    for (let tile = first; tile <= last; tile++) for (const c of cloudPositions) {
      ctx.drawImage(sprites[c.sprite].shadow, c.x - 150 * c.size + 29, c.y - 95 * c.size + 42 + tile * WORLD.height, 300 * c.size, 190 * c.size)
    }
    ctx.globalAlpha = 1; ctx.restore()
    // The aircraft banks gently in screen space; its shadow shares the cloud light direction.
    const px = width * .54 + Math.sin(elapsed * .13) * width * .13
    const py = height * .51 + Math.sin(elapsed * .085 + .4) * height * .035
    const bank = Math.cos(elapsed * .13) * .16
    const angle = -Math.PI / 2 + bank * .5
    const pscale = clamp(height / 170, .45, .95) * zoom
    if (options.plane) {
      ctx.save(); ctx.translate(px + 18 * pscale, py + (-18) * pscale); ctx.rotate(angle); ctx.scale(pscale, pscale); ctx.filter = 'blur(3px)'; planeShape(ctx, true); ctx.restore()
      ctx.save(); ctx.translate(px, py); ctx.rotate(angle); ctx.scale(pscale, pscale); planeShape(ctx)
      ctx.strokeStyle = '#eef0dd9c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -27, 8, 1.5, Math.sin(elapsed * 60) * .15, 0, TAU); ctx.stroke(); ctx.restore()
    }
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.rotate(-Math.PI / 2)
    ctx.scale(scale, scale); ctx.translate(-centerX, -centerY)
    ctx.globalAlpha = options.clouds / 100 * .93
    for (let tile = first; tile <= last; tile++) for (const c of cloudPositions) ctx.drawImage(sprites[c.sprite].cloud, c.x - 150 * c.size, c.y - 95 * c.size + tile * WORLD.height, 300 * c.size, 190 * c.size)
    ctx.restore()
    ctx.globalAlpha = options.texture / 100 * .8; ctx.drawImage(paper, 0, 0, width, height); ctx.globalAlpha = 1
    const sunlight = ctx.createLinearGradient(0, 0, width, height); sunlight.addColorStop(0, '#fff3ce14'); sunlight.addColorStop(1, '#d3ded700')
    ctx.fillStyle = sunlight; ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(edge, 0, 0, width, height); ctx.globalCompositeOperation = 'source-over'
    frames++
    if (import.meta.env.DEV) { canvas.dataset.frame = String(frames); canvas.dataset.time = elapsed.toFixed(3); canvas.dataset.running = String(running()); canvas.dataset.view = 'header' }
  }
  function tick(now: number) {
    frame = 0
    if (!running()) { lastTime = 0; draw(); return }
    const delta = lastTime ? now - lastTime : 1000 / 30
    if (delta >= 1000 / 30 - .5) {
      const dt = Math.min(delta / 1000, .08); elapsed += dt * options.speed; travel += dt * options.speed * 28
      lastTime = now; draw()
    }
    frame = requestAnimationFrame(tick)
  }
  function reconcile() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0
    draw()
    if (running()) frame = requestAnimationFrame(tick)
  }
  function resize() {
    if (disposed) return
    try {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      width = rect.width; height = rect.height
      dpr = Math.max(.75, Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1000000 / (width * height))))
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
      paper = createPaper(canvas.width, canvas.height); edge = createEdge(Math.ceil(width), Math.ceil(height), 'header')
      reconcile(); onReady(true)
    } catch { dispose(); onReady(false) }
  }
  function dispose() {
    disposed = true; cancelAnimationFrame(frame); resizeObserver?.disconnect(); intersectionObserver?.disconnect()
    document.removeEventListener('visibilitychange', reconcile); paper = null; edge = null
  }
  try {
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas)
    intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; reconcile() }); intersectionObserver.observe(canvas)
    document.addEventListener('visibilitychange', reconcile)
    resize()
  } catch { dispose(); onReady(false) }
  return {
    update(next) { if (!disposed) { options = { ...next }; reconcile() } },
    dispose
  }
}
