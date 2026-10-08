import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
} from 'three'
import { runSurface } from '../../../shared/three/runSurface'
import { hex, type SceneFactory, type SurfaceModule } from '../../../shared/three/surface'
import { CellState, dayGridCells, priceGrid, type GridCell } from '../timeGrid'
import type { TimeGridParams } from './gridTypes'

/**
 * The pay cards' time grid: five-minute cells for a working day, or hour cells
 * for a price. Every cell is one instanced quad drawn by a small shader (ink
 * square, pencil outline, pen, crossed out); a cell whose state changes turns
 * over on its horizontal axis, pencil side to ink side. Drawn on demand: a grid
 * at rest costs nothing.
 */

const VERTEX = /* glsl */ `
attribute vec4 aCell;
attribute vec4 aState;
varying vec2 vUv;
varying float vState;
varying float vFill;
varying float vShade;
varying float vSize;
void main() {
  float c = cos(aState.z * 3.14159265);
  bool back = c < 0.0;
  vState = back ? aState.y : aState.x;
  vFill = aState.w;
  vShade = abs(c);
  vSize = aCell.z;
  // Past halfway the far side shows; mirror it so it reads upright.
  vUv = vec2(uv.x, back ? 1.0 - uv.y : uv.y);
  vec2 local = position.xy * aCell.z;
  local.y *= c;
  vec2 centre = vec2(aCell.x + aCell.z * 0.5, -(aCell.y + aCell.z * 0.5));
  gl_Position = projectionMatrix * viewMatrix * vec4(centre + local, 0.0, 1.0);
}
`

// Display-space output, like the other hand-written shaders. Line widths are in CSS px.
const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uInk;
uniform vec3 uPencil;
uniform vec3 uPen;
varying vec2 vUv;
varying float vState;
varying float vFill;
varying float vShade;
varying float vSize;
float line(float d, float w) { return 1.0 - smoothstep(w - 0.5, w + 0.5, d); }
void main() {
  vec2 px = vUv * vSize;
  float edge = min(min(px.x, px.y), min(vSize - px.x, vSize - px.y));
  float diagonal = abs(px.x - px.y) * 0.7071;
  float filled = step(vUv.y, vFill);
  int state = int(floor(vState + 0.5));
  vec3 color = uInk;
  float alpha = 0.0;
  if (state == 0) { color = uPencil; alpha = line(edge, 0.55) * 0.9; }
  else if (state == 1) { alpha = 1.0; }
  else if (state == 2) { color = uPen; alpha = max(line(edge, 1.0), filled); }
  else if (state == 3) { color = uPencil; alpha = line(diagonal, 0.5) * 0.85; }
  else if (state == 4) { color = uPencil; alpha = max(line(edge, 0.8), line(diagonal, 0.55)); }
  else if (state == 5) { color = uPen; alpha = line(edge, 1.1) * step(0.4, fract((px.x + px.y) * 0.3)); }
  else if (state == 6) { color = mix(uPencil, uInk, filled); alpha = max(filled, line(edge, 0.55) * 0.9); }
  else if (state == 7) { color = uPencil; alpha = line(edge, 0.55) * 0.9 * step(0.5, fract((px.x + px.y) * 0.25)); }
  if (alpha < 0.01) discard;
  // A cell on its edge catches less light.
  gl_FragColor = vec4(color * mix(0.72, 1.0, vShade), alpha);
}
`

const CAPACITY = 512
const FLIP = 0.42
/** Seconds between neighbouring cells turning over on first show. */
const INTRO_STAGGER = 0.006
const PRICE_STAGGER = 0.045

type Shown = { state: number; fill: number }
type Anim = { from: number; to: number; start: number; duration: number; flip: boolean; fillFrom: number; fillTo: number }

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)
const isInk = (state: number) => state === CellState.done || state === CellState.breakDone

const createScene: SceneFactory<TimeGridParams> = (context, initial) => {
  const { renderer, still } = context
  let width = context.width
  let height = context.height
  let params = initial

  const scene = new Scene()
  // CSS pixels, origin top-left, y down the screen.
  const camera = new OrthographicCamera(0, width, 0, -height, -10, 10)

  const plane = new PlaneGeometry(1, 1)
  const geometry = new InstancedBufferGeometry()
  geometry.index = plane.index
  geometry.setAttribute('position', plane.getAttribute('position'))
  geometry.setAttribute('uv', plane.getAttribute('uv'))
  const cellData = new Float32Array(CAPACITY * 4)
  const stateData = new Float32Array(CAPACITY * 4)
  const cellAttribute = new InstancedBufferAttribute(cellData, 4).setUsage(DynamicDrawUsage)
  const stateAttribute = new InstancedBufferAttribute(stateData, 4).setUsage(DynamicDrawUsage)
  geometry.setAttribute('aCell', cellAttribute)
  geometry.setAttribute('aState', stateAttribute)
  geometry.instanceCount = 0

  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uInk: { value: hex(initial.colors.ink) }, uPencil: { value: hex(initial.colors.pencil) }, uPen: { value: hex(initial.colors.pen) } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  scene.add(mesh)

  let cells: GridCell[] = []
  const shown: Shown[] = []
  const anims: Array<Anim | null> = []
  let time = 0
  let lastRun = initial.kind === 'price' ? initial.runId : -1

  const applyColors = () => {
    material.uniforms.uInk.value = hex(params.colors.ink)
    material.uniforms.uPencil.value = hex(params.colors.pencil)
    material.uniforms.uPen.value = hex(params.colors.pen)
  }

  const layout = (): GridCell[] =>
    params.kind === 'day'
      ? dayGridCells(width, height, params.grid)
      : priceGrid(width, height, params.hours, params.hoursPerDay).cells

  /**
   * intro: inked cells turn over one after another, as if the day were being
   * written in; replay: a new price's hours do the same; diff: only cells whose
   * state changed turn over; snap: no motion.
   */
  const sync = (mode: 'intro' | 'replay' | 'diff' | 'snap') => {
    const next = layout().slice(0, CAPACITY)
    const animate = !still && mode !== 'snap'
    next.forEach((cell, index) => {
      const before = shown[index]
      let anim: Anim | null = null
      if (animate && (mode === 'intro' || mode === 'replay')) {
        const start = time + index * (mode === 'intro' ? INTRO_STAGGER : PRICE_STAGGER)
        const blank = mode === 'intro' ? CellState.future : CellState.spare
        if (isInk(cell.state)) anim = { from: blank, to: cell.state, start, duration: FLIP, flip: true, fillFrom: cell.fill, fillTo: cell.fill }
        else if (cell.state === CellState.now || cell.state === CellState.partial)
          anim = { from: cell.state, to: cell.state, start, duration: 0.5, flip: false, fillFrom: 0, fillTo: cell.fill }
      } else if (animate && before) {
        if (before.state !== cell.state) {
          anim = { from: before.state, to: cell.state, start: time, duration: FLIP, flip: true, fillFrom: before.fill, fillTo: cell.fill }
        } else {
          // Same state: let a turn already under way finish.
          anim = anims[index] ?? null
          if (anim) anim.fillTo = cell.fill
        }
      }
      anims[index] = anim
      shown[index] = { state: cell.state, fill: cell.fill }
    })
    cells = next
    shown.length = next.length
    anims.length = next.length
    write()
  }

  /** Writes every cell for the current time; true while any is still turning. */
  const write = () => {
    let moving = false
    cells.forEach((cell, index) => {
      const hidden = cell.state === CellState.hidden
      cellData.set([cell.x, cell.y, hidden ? 0 : cell.size, 0], index * 4)
      const anim = anims[index]
      const rest = shown[index]
      let state = [rest.state, rest.state, 0, rest.fill]
      if (anim) {
        const u = clamp((time - anim.start) / anim.duration)
        if (u <= 0) state = [anim.from, anim.from, 0, anim.fillFrom]
        else if (u >= 1) anims[index] = null
        else {
          const eased = easeInOut(u)
          const fill = anim.fillFrom + (anim.fillTo - anim.fillFrom) * eased
          state = anim.flip ? [anim.from, anim.to, eased, fill] : [anim.to, anim.to, 0, fill]
        }
        if (anims[index]) moving = true
      }
      stateData.set(state, index * 4)
    })
    geometry.instanceCount = cells.length
    cellAttribute.needsUpdate = true
    stateAttribute.needsUpdate = true
    return moving
  }

  sync(initial.kind === 'day' ? 'intro' : 'snap')

  return {
    update(next) {
      const colorsChanged = next.colors !== params.colors
      params = next
      if (colorsChanged) applyColors()
      if (next.kind === 'price' && next.runId !== lastRun) {
        lastRun = next.runId
        sync('replay')
      } else {
        sync('diff')
      }
    },
    frame(dt) {
      time += dt
      const moving = write()
      renderer.render(scene, camera)
      return moving
    },
    resize(nextWidth, nextHeight) {
      width = nextWidth
      height = nextHeight
      camera.right = width
      camera.bottom = -height
      camera.updateProjectionMatrix()
      sync('snap')
    },
    dispose() {
      geometry.dispose()
      plane.dispose()
      material.dispose()
    },
  }
}

export const mount: SurfaceModule<TimeGridParams>['mount'] = (canvas, params, options) =>
  runSurface(canvas, createScene, params, { ...options, onDemand: true })
