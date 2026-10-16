import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  BufferAttribute,
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
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three'
import type { Rgb } from '../../../../shared/three/surface'
import { LAMP_X } from '../deskLayout'
import type { DeskColors } from '../deskTypes'
import { LAMP_RIG, LAMP_SHADE_PROFILE, type LampHandle } from '../lampKinematics'
import { DETAIL, circle, dashedCircle, segmentsOf, type Kit } from './kit'
import { roundedBox } from './props/modeling'

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
  const base = kit.hull(kit.solid(roundedBox(0.74, 0.09, 0.62, 0.025), 'charcoal'))
  base.position.y = 0.045
  root.add(base)
  const plinth = kit.hull(kit.solid(roundedBox(0.55, 0.035, 0.44, 0.018)), DETAIL)
  plinth.position.y = 0.1075
  root.add(plinth)
  const switchMaterial = kit.fill('paper')
  const lampSwitch = kit.edges(new Mesh(new CylinderGeometry(0.05, 0.05, 0.03, 24), switchMaterial), DETAIL)
  lampSwitch.position.set(-0.22, 0.075, 0)
  root.add(lampSwitch)

  const joint = (radius: number) => {
    const geometry = new CylinderGeometry(radius, radius, 0.09, 32)
    geometry.rotateX(Math.PI / 2)
    const axle = kit.hull(kit.edges(kit.solid(geometry, 'charcoal'), DETAIL), DETAIL)
    const screw = kit.segments([-radius * 0.45, 0, 0.047, radius * 0.45, 0, 0.047], 0.8, 'knockout')
    axle.add(screw)
    return axle
  }
  const arm = (length: number) => {
    const frame = new Group()
    for (const x of [-0.055, 0.055]) {
      const rail = kit.hull(kit.solid(roundedBox(0.028, length, 0.035, 0.008), x < 0 ? 'charcoal' : 'paper'), 0.8)
      rail.position.set(x, length / 2, 0)
      frame.add(rail)
    }
    for (const y of [0, length]) {
      const end = kit.hull(kit.solid(roundedBox(0.15, 0.045, 0.055, 0.015)), 0.8)
      end.position.y = y
      frame.add(end)
    }
    return frame
  }
  // The tension springs are anchored between a lower crosshead and an upper
  // crosshead on the parallel arm, rather than floating alongside a single rod.
  const spring = (length: number, side: number) => {
    const points: [number, number, number][] = []
    const y0 = 0.14,
      y1 = Math.min(0.69, length * 0.48)
    for (let i = 0; i <= 112; i++) {
      const s = i / 112,
        a = s * 12 * Math.PI * 2
      points.push([side * (0.13 - 0.065 * s) + Math.cos(a) * 0.022, y0 + s * (y1 - y0), 0.025 + Math.sin(a) * 0.022])
    }
    const out = segmentsOf(points)
    out.push(side * 0.055, y0, 0.025, side * 0.15, y0, 0.025, side * 0.055, y1, 0.025, side * 0.087, y1, 0.025)
    return kit.segments(out, 0.8, 'ink3')
  }
  const [shoulderX, shoulderY] = LAMP_RIG.shoulder
  const shoulder = new Group()
  shoulder.position.set(shoulderX - LAMP_X, shoulderY, 0)
  root.add(shoulder)
  shoulder.add(joint(0.07), arm(LAMP_RIG.lowerArm), spring(LAMP_RIG.lowerArm, -1), spring(LAMP_RIG.lowerArm, 1))
  const elbow = new Group()
  elbow.position.y = LAMP_RIG.lowerArm
  shoulder.add(elbow)
  elbow.add(joint(0.065), arm(LAMP_RIG.upperArm))
  const head = new Group()
  head.position.y = LAMP_RIG.upperArm
  head.rotation.order = 'ZYX'
  elbow.add(head)
  head.add(joint(0.045))
  // A closed shell with thickness: the outside winds upwards, the inner wall
  // back down. The rim and the light origin share LAMP_RIG.mouth.
  const shade = kit.hull(kit.solid(kit.lathe(LAMP_SHADE_PROFILE), 'paper', { inkCavity: true }))
  shade.name = 'lamp-shade'
  head.add(shade)
  head.add(kit.segments(circle(LAMP_RIG.mouthRadius, -LAMP_RIG.mouth), DETAIL))
  const socket = kit.hull(kit.solid(new CylinderGeometry(0.045, 0.045, 0.16, 24), 'graphite'), DETAIL)
  socket.position.y = -0.3
  head.add(socket)
  const cap = kit.edges(kit.solid(new CircleGeometry(0.06, 24), 'charcoal'), DETAIL)
  cap.rotation.x = -Math.PI / 2
  head.add(cap)
  const bulb = kit.hull(kit.solid(new SphereGeometry(0.09, 20, 14), 'paper', { glow: 'bulb' }), DETAIL * 0.9)
  bulb.position.y = -0.47
  head.add(bulb)
  const haloTexture = glowTexture()
  const haloMaterial = new SpriteMaterial({
    map: haloTexture,
    color: new Color('#ffcf8a'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const halo = new Sprite(haloMaterial)
  halo.scale.set(0.85, 0.85, 1)
  halo.position.y = -0.66
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
  proxy(new SphereGeometry(0.3, 12, 8), 'shade', head, 2).position.y = -0.43
  proxy(new BoxGeometry(0.9, 0.26, 0.9), 'base', root, 1).position.y = 0.1

  // Pencil hints: dashed rings on the hinges, a dashed arc for turning the shade.
  const elbowRing = kit.segments(dashedCircle(0.15, 12), DETAIL, 'pencil')
  const headRing = kit.segments(dashedCircle(0.15, 12), DETAIL, 'pencil')
  const arcPositions = new Float32Array(7 * 3 * 6)
  const shadeArc = kit.segments(arcPositions, DETAIL, 'pencil')
  // Pencil chevrons either side of the base: it slides along the desk.
  const baseArrows = kit.segments(
    [-0.56, 0.16, 0, -0.66, 0.09, 0, -0.66, 0.09, 0, -0.56, 0.02, 0, 0.56, 0.16, 0, 0.66, 0.09, 0, 0.66, 0.09, 0, 0.56, 0.02, 0],
    DETAIL,
    'pencil',
  )
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
  const h = NOTE_SIZE / 2
  const noteGeometry = new BufferGeometry()
  noteGeometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-h, 0, 0, h, 0, 0, h, -NOTE_SIZE + 0.07, 0, h - 0.07, -NOTE_SIZE, 0, -h, -NOTE_SIZE, 0]), 3),
  )
  noteGeometry.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0.07 / NOTE_SIZE, 1 - 0.07 / NOTE_SIZE, 0, 0, 0]), 2),
  )
  noteGeometry.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3])
  noteGeometry.computeVertexNormals()
  const noteFace = new Mesh(
    noteGeometry,
    new MeshBasicMaterial({ map: noteTexture, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  )
  note.add(noteFace)
  const half = NOTE_SIZE / 2
  note.add(
    kit.segments(
      [
        -half,
        0,
        0.002,
        half,
        0,
        0.002,
        half,
        0,
        0.002,
        half,
        -NOTE_SIZE + 0.07,
        0.002,
        half,
        -NOTE_SIZE + 0.07,
        0.002,
        half - 0.07,
        -NOTE_SIZE,
        0.002,
        half - 0.07,
        -NOTE_SIZE,
        0.002,
        -half,
        -NOTE_SIZE,
        0.002,
        -half,
        -NOTE_SIZE,
        0.002,
        -half,
        0,
        0.002,
        half,
        -NOTE_SIZE + 0.07,
        0.002,
        half - 0.06,
        -NOTE_SIZE + 0.06,
        0.002,
        half - 0.06,
        -NOTE_SIZE + 0.06,
        0.002,
        half - 0.07,
        -NOTE_SIZE,
        0.002,
      ],
      DETAIL,
    ),
  )
  // A strip of tape at the top.
  note.add(
    kit.segments(
      [
        -0.07, 0.025, 0.003, 0.07, 0.025, 0.003, 0.07, 0.025, 0.003, 0.07, -0.02, 0.003, 0.07, -0.02, 0.003, -0.07, -0.02, 0.003, -0.07,
        -0.02, 0.003, -0.07, 0.025, 0.003,
      ],
      DETAIL * 0.8,
      'pencil',
    ),
  )

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
