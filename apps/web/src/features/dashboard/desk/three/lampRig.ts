import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  type Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three'
import type { Rgb } from '../../../../shared/three/surface'
import { LAMP_X } from '../deskLayout'
import type { DeskColors } from '../deskTypes'
import { LAMP_RIG, type LampHandle } from '../lampKinematics'
import { DETAIL, LINE, dashedCircle, segmentsOf, type Kit } from './kit'

/**
 * The balanced-arm lamp: base and switch, two sprung arms, the shade and its
 * bulb, generous invisible targets for dragging, the pencil hints that show
 * what moves, and the sticky note on the lower arm.
 */

/** What a drag on the lamp takes hold of: a hinge, the shade, or the base (to carry it along the desk). */
export type RigHandle = LampHandle | 'base'

const css = ([r, g, b]: Rgb) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`

const glowTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const NOTE_SIZE = 0.34
const NOTE_PIXELS = 256

export const buildLampRig = (kit: Kit) => {
  const root = new Group()
  root.userData.kind = 'lamp'
  root.position.set(LAMP_X, 0, -0.2)
  root.add(kit.hull(kit.edges(kit.solid(kit.lathe([[0, 0], [0.36, 0], [0.37, 0.03], [0.3, 0.085], [0.12, 0.11], [0, 0.11]])), LINE, 25)))
  const switchMaterial = kit.fill('paper')
  const lampSwitch = kit.edges(new Mesh(new CylinderGeometry(0.05, 0.05, 0.03, 24), switchMaterial), DETAIL)
  lampSwitch.position.set(-0.22, 0.075, 0)
  root.add(lampSwitch)

  const joint = (radius: number) => kit.hull(kit.solid(new SphereGeometry(radius, 20, 14)), LINE * 0.9)
  const rod = (length: number) => {
    const geometry = new CylinderGeometry(0.03, 0.03, length, 12)
    geometry.translate(0, length / 2, 0)
    return kit.hull(kit.solid(geometry), LINE * 0.9)
  }
  const spring = (length: number, side: number) => {
    const points: [number, number, number][] = []
    const y0 = 0.16
    const y1 = length * 0.6
    for (let i = 0; i <= 160; i += 1) {
      const s = i / 160
      const a = s * 16 * Math.PI * 2
      points.push([side * 0.075 + Math.cos(a) * 0.02, y0 + s * (y1 - y0), Math.sin(a) * 0.02])
    }
    const out = segmentsOf(points)
    out.push(side * 0.03, y0, 0, side * 0.075, y0, 0, side * 0.03, y1, 0, side * 0.075, y1, 0)
    return kit.segments(out, DETAIL * 0.8, 'ink3')
  }
  const [shoulderX, shoulderY] = LAMP_RIG.shoulder
  const shoulder = new Group()
  shoulder.position.set(shoulderX - LAMP_X, shoulderY, 0)
  root.add(shoulder)
  shoulder.add(joint(0.055), rod(LAMP_RIG.lowerArm), spring(LAMP_RIG.lowerArm, -1))
  const elbow = new Group()
  elbow.position.y = LAMP_RIG.lowerArm
  shoulder.add(elbow)
  elbow.add(joint(0.05), rod(LAMP_RIG.upperArm), spring(LAMP_RIG.upperArm, 1))
  const head = new Group()
  head.position.y = LAMP_RIG.upperArm
  head.rotation.order = 'ZYX'
  elbow.add(head)
  head.add(joint(0.045))
  head.add(kit.hull(kit.edges(kit.solid(kit.lathe([[0.06, 0], [0.09, -0.03], [0.14, -0.1], [0.22, -0.23], [0.29, -0.36], [0.305, -LAMP_RIG.mouth]]), 'paper', { side: DoubleSide, inner: true }), LINE, 25)))
  const cap = kit.edges(kit.solid(new CircleGeometry(0.06, 24)), DETAIL)
  cap.rotation.x = -Math.PI / 2
  head.add(cap)
  const bulb = kit.hull(kit.solid(new SphereGeometry(0.09, 20, 14), 'paper', { glow: 'bulb' }), DETAIL * 0.9)
  bulb.position.y = -0.27
  head.add(bulb)
  const haloTexture = glowTexture()
  const haloMaterial = new SpriteMaterial({ map: haloTexture, color: new Color('#ffcf8a'), transparent: true, opacity: 0, depthWrite: false })
  const halo = new Sprite(haloMaterial)
  halo.scale.set(0.85, 0.85, 1)
  halo.position.y = -0.42
  halo.renderOrder = 6
  head.add(halo)

  // Generous invisible targets for the hinges and the shade; the arms are too thin to hit.
  const proxies: Mesh[] = []
  const proxy = (geometry: BufferGeometry, handle: RigHandle, parent: Object3D, priority: number) => {
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ visible: false, side: DoubleSide }))
    mesh.userData.handle = handle
    mesh.userData.priority = priority
    parent.add(mesh)
    proxies.push(mesh)
    return mesh
  }
  const lowerTarget = new CylinderGeometry(0.1, 0.1, LAMP_RIG.lowerArm * 0.7, 8)
  lowerTarget.translate(0, LAMP_RIG.lowerArm * 0.5, 0)
  proxy(lowerTarget, 'elbow', shoulder, 1)
  const upperTarget = new CylinderGeometry(0.1, 0.1, LAMP_RIG.upperArm * 0.8, 8)
  upperTarget.translate(0, LAMP_RIG.upperArm * 0.5, 0)
  proxy(upperTarget, 'head', elbow, 1)
  proxy(new SphereGeometry(0.17, 12, 8), 'elbow', elbow, 3)
  proxy(new SphereGeometry(0.17, 12, 8), 'head', head, 3)
  proxy(new SphereGeometry(0.3, 12, 8), 'shade', head, 2).position.y = -0.24
  proxy(new BoxGeometry(0.9, 0.26, 0.9), 'base', root, 1).position.y = 0.1

  // Pencil hints: dashed rings on the hinges, a dashed arc for turning the shade.
  const elbowRing = kit.segments(dashedCircle(0.15, 12), DETAIL, 'pencil')
  const headRing = kit.segments(dashedCircle(0.15, 12), DETAIL, 'pencil')
  const arcPositions = new Float32Array(7 * 3 * 6)
  const shadeArc = kit.segments(arcPositions, DETAIL, 'pencil')
  // Pencil chevrons either side of the base: it slides along the desk.
  const baseArrows = kit.segments([
    -0.56, 0.16, 0, -0.66, 0.09, 0, -0.66, 0.09, 0, -0.56, 0.02, 0,
    0.56, 0.16, 0, 0.66, 0.09, 0, 0.66, 0.09, 0, 0.56, 0.02, 0,
  ], DETAIL, 'pencil')
  for (const hint of [elbowRing, headRing, shadeArc, baseArrows]) {
    hint.material.transparent = true
    hint.material.opacity = 0
    hint.material.depthTest = false
    hint.renderOrder = 8
    hint.visible = false
  }

  // The sticky note on the lower arm: the task in progress, written in the pen.
  const noteCanvas = document.createElement('canvas')
  noteCanvas.width = noteCanvas.height = NOTE_PIXELS
  const noteTexture = new CanvasTexture(noteCanvas)
  noteTexture.colorSpace = SRGBColorSpace
  const note = new Group()
  note.userData.kind = 'note'
  note.position.set(-0.11, LAMP_RIG.lowerArm * 0.52, 0.07)
  note.rotation.z = 0.12
  note.visible = false
  shoulder.add(note)
  const noteFace = new Mesh(new PlaneGeometry(NOTE_SIZE, NOTE_SIZE), new MeshBasicMaterial({ map: noteTexture, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }))
  noteFace.position.y = -NOTE_SIZE / 2
  note.add(noteFace)
  const half = NOTE_SIZE / 2
  note.add(kit.segments([
    -half, 0, 0.002, half, 0, 0.002,
    half, 0, 0.002, half, -NOTE_SIZE + 0.07, 0.002,
    half, -NOTE_SIZE + 0.07, 0.002, half - 0.07, -NOTE_SIZE, 0.002,
    half - 0.07, -NOTE_SIZE, 0.002, -half, -NOTE_SIZE, 0.002,
    -half, -NOTE_SIZE, 0.002, -half, 0, 0.002,
    half, -NOTE_SIZE + 0.07, 0.002, half - 0.06, -NOTE_SIZE + 0.06, 0.002,
    half - 0.06, -NOTE_SIZE + 0.06, 0.002, half - 0.07, -NOTE_SIZE, 0.002,
  ], DETAIL))
  // A strip of tape at the top.
  note.add(kit.segments([-0.07, 0.025, 0.003, 0.07, 0.025, 0.003, 0.07, 0.025, 0.003, 0.07, -0.02, 0.003, 0.07, -0.02, 0.003, -0.07, -0.02, 0.003, -0.07, -0.02, 0.003, -0.07, 0.025, 0.003], DETAIL * 0.8, 'pencil'))

  let noteKey = ''
  const drawNote = (text: string, colors: DeskColors) => {
    const key = `${text}|${colors.paper}|${colors.pen}|${colors.pencil}`
    if (key === noteKey) return
    noteKey = key
    const ctx = noteCanvas.getContext('2d')
    if (!ctx) return
    const size = NOTE_PIXELS
    ctx.fillStyle = css(colors.paper)
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = css(colors.pencil)
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i += 1) {
      const y = 92 + i * 56
      ctx.beginPath()
      ctx.moveTo(22, y)
      ctx.lineTo(size - 22, y)
      ctx.stroke()
    }
    if (text) {
      ctx.fillStyle = css(colors.pen)
      ctx.font = '500 34px "Noto Serif SC", "Source Serif 4", serif'
      ctx.textBaseline = 'alphabetic'
      // Wrap by character (Chinese has no spaces); three lines, then an ellipsis.
      const lines: string[] = []
      let line = ''
      for (const ch of Array.from(text)) {
        if (ctx.measureText(line + ch).width > size - 48) {
          lines.push(line)
          line = ch
          if (lines.length === 3) break
        } else line += ch
      }
      if (lines.length < 3 && line) lines.push(line)
      if (lines.length === 3 && Array.from(text).length > lines.join('').length) {
        let last = lines[2]
        while (last && ctx.measureText(last + '…').width > size - 48) last = last.slice(0, -1)
        lines[2] = last + '…'
      }
      lines.forEach((l, i) => ctx.fillText(l, 24, 84 + i * 56))
    }
    noteTexture.needsUpdate = true
  }

  const applyTheme = (colors: DeskColors, lampOn: boolean) => {
    haloMaterial.blending = colors.dark ? AdditiveBlending : NormalBlending
    haloMaterial.needsUpdate = true
    ;(switchMaterial.uniforms.uBase.value as { set: (...v: number[]) => void }).set(...(lampOn ? colors.ink : colors.paper))
  }

  return {
    root,
    shoulder,
    elbow,
    head,
    bulb,
    halo,
    haloMaterial,
    lampSwitch,
    switchMaterial,
    proxies,
    hints: { elbowRing, headRing, shadeArc, baseArrows, arcPositions },
    note,
    noteFace,
    drawNote,
    applyTheme,
    dispose() {
      haloTexture.dispose()
      noteTexture.dispose()
    },
  }
}

export type LampRig = ReturnType<typeof buildLampRig>
