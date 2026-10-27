// Original procedural artwork. Expensive brushwork is cached once, never per frame.
export const WORLD = { width: 1120, height: 2240 }
const TAU = Math.PI * 2
export function random(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
export const wrap = (v: number, period: number) => ((v % period) + period) % period
export function makeCanvas(w: number, h: number) { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; return canvas }
export function riverX(y: number) { const a = y / WORLD.height * TAU; return 748 + Math.sin(a) * 27 + Math.sin(a * 3 + .7) * 11 }
export function riverWidth(y: number) { return 78 + 8 * Math.sin(y / WORLD.height * TAU * 2) }
function polygon(ctx: CanvasRenderingContext2D, points: number[][]) { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath() }
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill() }

function field(ctx: CanvasRenderingContext2D, rng: () => number, x: number, y: number, w: number, h: number) {
  const colors = ['#91bfc0', '#7cabb8', '#a4c4a6', '#8fb69e', '#a2c68e', '#81b1ab', '#9dc4c5', '#a6c8a3', '#afc291', '#8ebbc3', '#b5b48b']
  const tone = Math.floor(rng() * colors.length)
  const pts = [[x + 2, y], [x + w - 2, y + rng() * 4], [x + w - 3, y + h], [x + 2, y + h - rng() * 3]]
  ctx.save(); polygon(ctx, pts); ctx.fillStyle = colors[tone]; ctx.fill(); ctx.clip()
  const wash = ctx.createLinearGradient(x, y, x + w * .8, y + h)
  wash.addColorStop(0, '#f2ecc33a'); wash.addColorStop(.45, '#f5f7dd08'); wash.addColorStop(1, '#426d7718')
  ctx.fillStyle = wash; ctx.fillRect(x, y, w, h)
  // Long, translucent strokes leave the quiet irregularity of a wet brush.
  for (let i = 0; i < 16; i++) {
    ctx.strokeStyle = i % 3 ? '#eef2cc13' : '#487b7e0c'; ctx.lineWidth = 1 + rng() * 5
    const xx = x + rng() * w
    ctx.beginPath(); ctx.moveTo(xx, y - 5); ctx.bezierCurveTo(xx + 3, y + h * .4, xx - 2, y + h * .6, xx + rng() * 3, y + h + 6); ctx.stroke()
  }
  for (let i = 0; i < w * h / 90; i++) {
    const px = x + rng() * w, py = y + rng() * h
    ellipse(ctx, px, py, .35 + rng() * .75, .3 + rng() * 1.6, rng() > .5 ? '#f5f3d12a' : '#3d7e7210')
  }
  if (tone === 4 || tone === 7 || tone === 10) {
    ctx.lineWidth = .6; ctx.strokeStyle = tone === 10 ? '#777f631c' : '#587f5920'
    for (let xx = x + 5; xx < x + w; xx += 5.5) {
      ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx + 1.5, y + h); ctx.stroke()
    }
  } else if (rng() > .4) {
    ctx.fillStyle = '#e2edd727'
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 5 + rng() * (w - 10), y + 10 + rng() * (h - 20), .7, 4 + rng() * 7)
  }
  ctx.restore()
  polygon(ctx, pts); ctx.lineWidth = 2.8; ctx.strokeStyle = '#b4c992'; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + 2, y + h); ctx.lineTo(x + 2, y); ctx.lineTo(x + w - 2, y + 1); ctx.lineWidth = 1; ctx.strokeStyle = '#dce0bca0'; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + w - 1, y); ctx.lineTo(x + w - 1, y + h); ctx.lineWidth = .8; ctx.strokeStyle = '#68958a65'; ctx.stroke()
}

function riverPath(ctx: CanvasRenderingContext2D, expand = 0) {
  ctx.beginPath()
  for (let y = 0; y <= WORLD.height; y += 8) { const x = riverX(y) - riverWidth(y) / 2 - expand; if (!y) ctx.moveTo(x, y); else ctx.lineTo(x, y) }
  for (let y = WORLD.height; y >= 0; y -= 8) ctx.lineTo(riverX(y) + riverWidth(y) / 2 + expand, y)
  ctx.closePath()
}

function treeSprite(seed: number, dark = false) {
  const rng = random(seed), c = makeCanvas(128, 144), ctx = c.getContext('2d')!
  if (dark) {
    ctx.filter = 'blur(4px)'; ellipse(ctx, 72, 86, 30, 22, '#3c5e5440'); ellipse(ctx, 79, 99, 14, 18, '#3c5e5428'); return c
  }
  ctx.strokeStyle = '#73735f'; ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(64, 96); ctx.lineTo(63, 62); ctx.moveTo(63, 78); ctx.lineTo(44, 53); ctx.moveTo(63, 71); ctx.lineTo(78, 49); ctx.stroke()
  const petals = ['#d49aa2', '#dda5ac', '#e7b7bc', '#e9c0c1', '#edc8c8', '#f1d2ca', '#f0c8c7']
  const clumps = []
  for (let i = 0; i < 13; i++) { const a = i / 13 * TAU; clumps.push({x: 62 + Math.cos(a) * (16 + rng() * 6), y: 61 + Math.sin(a) * (16 + rng() * 4), r: 10 + rng() * 6}) }
  clumps.push({ x: 62, y: 61, r: 21 })
  ctx.filter = 'blur(1.3px)'
  for (const p of clumps) ellipse(ctx, p.x, p.y + 4, p.r + 1, p.r * .9, '#c98c9d40')
  ctx.filter = 'none'
  for (const p of clumps) {
    const g = ctx.createRadialGradient(p.x - 4, p.y - 5, 0, p.x, p.y, p.r)
    g.addColorStop(0, '#f0cac8'); g.addColorStop(.7, '#e6b3bd'); g.addColorStop(1, '#d59caaad')
    ellipse(ctx, p.x, p.y, p.r, p.r * .9, g)
  }
  // Individual pigment blooms, fixed in the tree's texture.
  for (let i = 0; i < 1450; i++) {
    const a = rng() * TAU, r = Math.sqrt(rng()) * 33, x = 62 + Math.cos(a) * r, y = 61 + Math.sin(a) * r * .91
    if (!clumps.some(p => (x - p.x) ** 2 + (y - p.y) ** 2 < p.r ** 2)) continue
    const shade = Math.max(0, Math.min(6, Math.floor(3 - (x - 62 + y - 61) / 25 + rng() * 3)))
    ctx.globalAlpha = .17 + rng() * .42; ellipse(ctx, x, y, .5 + rng() * 1.1, .4 + rng() * .9, petals[shade])
  }
  ctx.globalAlpha = 1
  return c
}

export function createTerrain(seed = 27) {
  const rng = random(seed), canvas = makeCanvas(WORLD.width, WORLD.height), ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b6ca9e'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  let x = -5
  while (x < WORLD.width) {
    const w = 35 + rng() * 36
    // The top and bottom share a boundary, so the painted world can tile vertically.
    const count = 12 + Math.floor(rng() * 5), step = WORLD.height / count
    for (let j = 0; j < count; j++) field(ctx, rng, x, j * step, w, step)
    x += w
  }
  // Small irrigation channels carry a little of the sky between the paddies.
  for (const yy of [185, 580, 1110, 1510, 1960]) {
    ctx.fillStyle = '#729e9c7a'; ctx.fillRect(0, yy - 1, WORLD.width, 3)
    ctx.fillStyle = '#d7ddbaaf'; ctx.fillRect(0, yy - 3, WORLD.width, 1)
  }
  ctx.fillStyle = '#b3c794'; ctx.fillRect(315, 0, 25, WORLD.height)
  ctx.fillStyle = '#d2ceb3'; ctx.fillRect(321, 0, 13, WORLD.height)
  ctx.fillStyle = '#e1debf'; ctx.fillRect(322, 0, 1, WORLD.height)
  ctx.setLineDash([7, 15]); ctx.strokeStyle = '#eeead570'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(328, 0); ctx.lineTo(328, WORLD.height); ctx.stroke(); ctx.setLineDash([])
  riverPath(ctx, 10); ctx.fillStyle = '#a8c28e'; ctx.fill()
  riverPath(ctx, 5); ctx.fillStyle = '#d0d2a2'; ctx.fill()
  riverPath(ctx); ctx.fillStyle = '#709fb6'; ctx.fill()
  ctx.save(); riverPath(ctx); ctx.clip()
  for (let i = 0; i < 14; i++) {
    const t = i / 13
    ctx.strokeStyle = i % 4 === 0 ? '#d7e5dc20' : '#426d9b13'; ctx.lineWidth = 3 + rng() * 8
    ctx.beginPath()
    for (let y = 0; y <= WORLD.height; y += 8) {
      const xx = riverX(y) + (t - .5) * riverWidth(y) + Math.sin(y * .03 + i) * 3
      if (!y) ctx.moveTo(xx, y); else ctx.lineTo(xx, y)
    }
    ctx.stroke()
  }
  ctx.restore()
  for (const y of [365, 1080, 1820]) {
    ctx.fillStyle = '#c2cd9a'; ctx.fillRect(0, y - 7, WORLD.width, 15)
    ctx.fillStyle = '#ddd5b6'; ctx.fillRect(0, y - 3, WORLD.width, 7)
    const rx = riverX(y), rw = riverWidth(y)
    ctx.fillStyle = '#446b7150'; ctx.fillRect(rx - rw / 2 - 6, y + 6, rw + 15, 6)
    ctx.fillStyle = '#b49775'; ctx.fillRect(rx - rw / 2 - 8, y - 6, rw + 16, 12)
    ctx.fillStyle = '#d6b996'; ctx.fillRect(rx - rw / 2 - 8, y - 6, rw + 16, 3)
    ctx.strokeStyle = '#887e6450'; ctx.lineWidth = .8
    for (let bx = rx - rw / 2 - 4; bx < rx + rw / 2 + 8; bx += 5) { ctx.beginPath(); ctx.moveTo(bx, y - 2); ctx.lineTo(bx, y + 5); ctx.stroke() }
  }
  const treeImages = Array.from({ length: 7 }, (_, i) => treeSprite(210 + i * 37))
  const shade = treeSprite(1, true), trees = []
  for (let i = 0; i < 46; i++) {
    const y = 50 + rng() * (WORLD.height - 100)
    const cluster = i < 25, x = cluster ? riverX(y) - 75 - rng() * 92 : 55 + rng() * (WORLD.width - 110)
    if (Math.abs(x - riverX(y)) < 65 || Math.abs(x - 328) < 21) continue
    trees.push({ x, y, scale: .46 + rng() * .26, sprite: i % 7 })
  }
  // A few deliberate clusters by the bridges make recognisable landmarks.
  for (const yy of [320, 1005, 1740]) for (let i = 0; i < 5; i++) trees.push({ x: riverX(yy) - 83 - (i % 2) * 35, y: yy + i * 23, scale: .55 + rng() * .15, sprite: i })
  for (const tree of trees) {
    const s = tree.scale
    ctx.drawImage(shade, tree.x - 64 * s + 16, tree.y - 66 * s + 17, 128 * s, 144 * s)
    // Petals scatter predominantly downwind rather than forming a regular halo.
    for (let j = 0; j < 48; j++) {
      const a = rng() * TAU, r = 17 + rng() * 22
      ellipse(ctx, tree.x + Math.cos(a) * r * s + 8, tree.y + Math.sin(a) * r * s + 14, .4 + rng() * .7, .5 + rng() * .9, ['#f2dfcfb0', '#f1d2d1b0', '#e8b5c097'][j % 3])
    }
  }
  trees.sort((a, b) => a.y - b.y)
  for (const tree of trees) ctx.drawImage(treeImages[tree.sprite], tree.x - 64 * tree.scale, tree.y - 66 * tree.scale, 128 * tree.scale, 144 * tree.scale)
  // Sparse, tiny field markers add scale without competing with the trees.
  for (let i = 0; i < 85; i++) {
    const x = rng() * WORLD.width, y = rng() * WORLD.height
    if (Math.abs(x - riverX(y)) < 58) continue
    ellipse(ctx, x + 2, y + 3, 1.4, 2.5, '#50796529'); ellipse(ctx, x, y, .9, 1.5, '#e1e0bb')
  }
  return { canvas, trees }
}

export function createCloud(seed: number) {
  const rng = random(seed), c = makeCanvas(300, 190), ctx = c.getContext('2d')!
  const clumps = [{x:145,y:97,r:47},{x:100,y:100,r:32},{x:184,y:103,r:37},{x:127,y:66,r:32},{x:166,y:64,r:37},{x:207,y:99,r:23},{x:77,y:111,r:19}]
  ctx.filter = 'blur(3px)'
  for (const p of clumps) ellipse(ctx, p.x, p.y + 7, p.r * 1.1, p.r * .78, '#d2e1db70')
  ctx.filter = 'blur(.7px)'
  for (const p of clumps) {
    const g = ctx.createRadialGradient(p.x - 7, p.y - 10, 3, p.x, p.y, p.r)
    g.addColorStop(0, '#fffef0f5'); g.addColorStop(.68, '#f8faeef0'); g.addColorStop(1, '#e4eee3b0')
    ellipse(ctx, p.x, p.y, p.r, p.r * .8, g)
  }
  ctx.filter = 'none'
  for (let i = 0; i < 1500; i++) {
    const x = 48 + rng() * 190, y = 26 + rng() * 115
    if (!clumps.some(p => ((x - p.x) / p.r) ** 2 + ((y - p.y) / (p.r * .8)) ** 2 < 1)) continue
    ellipse(ctx, x, y, .5 + rng(), .5 + rng(), i % 2 ? '#ffffff0c' : '#96b7b20b')
  }
  const shadow = makeCanvas(300, 190), sc = shadow.getContext('2d')!
  sc.filter = 'blur(13px)'; sc.drawImage(c, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#355a6249'; sc.fillRect(0, 0, 300, 190)
  return { cloud: c, shadow }
}

export function createPaper(w: number, h: number, seed = 51) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d')!, rng = random(seed)
  const data = ctx.createImageData(w, h)
  for (let i = 0; i < data.data.length; i += 4) {
    const bright = rng() > .5
    data.data[i] = bright ? 252 : 69; data.data[i + 1] = bright ? 248 : 86; data.data[i + 2] = bright ? 225 : 74; data.data[i + 3] = Math.floor(rng() * 29)
  }
  ctx.putImageData(data, 0, 0)
  return c
}

export function createEdge(w: number, h: number, mode: 'header' | 'postcard') {
  const c = makeCanvas(w, h), ctx = c.getContext('2d')!, rng = random(91)
  const depth = mode === 'header' ? Math.min(12, h * .14) : Math.min(24, w * .038)
  const data = ctx.createImageData(w, h)
  const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t) }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = mode === 'header' ? y : Math.min(x, y, w - 1 - x, h - 1 - y)
    if (d > depth * 1.7) continue
    const along = d === x || d === w - 1 - x ? y : x
    const boundary = depth * (.84 + Math.sin(along * .047) * .15 + Math.sin(along * .139 + 2) * .08)
    const grain = rng(), a = 1 - smooth((d - boundary * .24 + (grain - .5) * depth * .35) / (boundary * .78))
    const index = (y * w + x) * 4
    data.data[index] = 252; data.data[index + 1] = 251; data.data[index + 2] = 248; data.data[index + 3] = Math.round(a * 255)
  }
  ctx.putImageData(data, 0, 0)
  return c
}
