import { buildLampRig } from '../../src/features/dashboard/desk/three/lampRig'
import { DEFAULT_POSE, LAMP_RIG } from '../../src/features/dashboard/desk/lampKinematics'
import type { PropOptions, PropEnv } from '../../src/features/dashboard/desk/three/props/common'
import { prepareSourceModels } from '../../src/features/dashboard/desk/three/sourceModels'
import { Box3, OrthographicCamera, Vector3, WebGLRenderer } from 'three'
import type { DeskColors } from '../../src/features/dashboard/desk/deskTypes'
import { createKit } from '../../src/features/dashboard/desk/three/kit'
import { centerPropBuilders } from '../../src/features/dashboard/desk/three/props/centerProps'
import { smallPropBuilders } from '../../src/features/dashboard/desk/three/props/smallProps'
const canvas = document.querySelector('canvas')!
const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(2)
const colors = (dark = false): DeskColors => ({
  paper: dark ? [0.176, 0.169, 0.153] : [1, 1, 1],
  ink: dark ? [0.95, 0.94, 0.92] : [0.227, 0.216, 0.2],
  ink3: [0.47, 0.45, 0.42],
  ink4: [0.66, 0.64, 0.6],
  pencil: [0.58, 0.56, 0.52],
  pen: [0.106, 0.31, 0.29],
  dark,
})
let dark = false,
  oblique = false,
  last = 0,
  time = 0
await prepareSourceModels()
const buildLamp = ({ kit }: PropOptions) => {
  const lamp = buildLampRig(kit)
  lamp.root.position.x -= 1.2
  lamp.shoulder.rotation.z = DEFAULT_POSE.a1
  lamp.elbow.rotation.z = DEFAULT_POSE.a2
  lamp.head.rotation.set(LAMP_RIG.tilt, 0, DEFAULT_POSE.a3)
  let on = false
  return { root: lamp.root, click() { on = !on }, frame(_env: PropEnv) { void _env; kit.shared.uLight.value = on ? 1 : 0; lamp.applyTheme(kit.colors(), on) }, dispose: lamp.dispose }
}
const entries = Object.entries({ ...centerPropBuilders, ...smallPropBuilders, lamp: buildLamp }).map(([kind, build]) => {
  const kit = createKit({ width: 320, height: 360, unit: 135, colors: colors() })
  let endsAt: number | null = null
  const prop = build({
    kit,
    timer: {
      get: () => endsAt,
      set: (v) => {
        endsAt = v
      },
    },
  })
  return {
    kind,
    kit,
    prop,
    get endsAt() {
      return endsAt
    },
  }
})
document.querySelector('#labels')!.innerHTML = entries.map((e) => `<span>${({book:'翻页书',laptop:'笔记本',typewriter:'打字机',record:'唱片机',coffee:'咖啡',cola:'冰可乐',plant:'绿植',timer:'计时器',candle:'蜡烛',lamp:'台灯'} as Record<string,string>)[e.kind]}</span>`).join('')
const camera = new OrthographicCamera(-1.15, 1.15, 1.1, -1.1, 0.1, 100)
const env = { t: 0, dt: 0, still: false, hovered: false, light: 0, bulb: new Vector3(2, 3, 2), keys: 0, now: Date.now() }
function draw() {
  const w = canvas.clientWidth,
    h = canvas.clientHeight,
    cw = w / 4,
    ch = h / 3
  renderer.setSize(w, h, false)
  renderer.setScissorTest(true)
  entries.forEach((e, i) => {
    const col = i % 4,
      row = Math.floor(i / 4)
    renderer.setViewport(col * cw, h - (row + 1) * ch, cw, ch)
    renderer.setScissor(col * cw, h - (row + 1) * ch, cw, ch)
    renderer.setClearColor(dark ? 0x242320 : 0xffffff, 1)
    renderer.clear()
    const extent = e.kind === 'lamp' ? 1.4 : 1.1
    camera.top = extent
    camera.bottom = -extent
    camera.left = (-cw / ch) * extent
    camera.right = (cw / ch) * extent
    camera.position.set(oblique ? 3 : 0, oblique ? 2.8 : 0.7, 8)
    camera.lookAt(0, 0.7, 0)
    camera.updateProjectionMatrix()
    e.kit.resize(cw, ch, ch / 2.2)
    e.prop.root.updateMatrixWorld(true)
    renderer.render(e.prop.root, camera)
  })
}
function frame(ts: number) {
  env.dt = last ? Math.min(0.05, (ts - last) / 1000) : 0
  last = ts
  time += env.dt
  env.t = time
  env.now = Date.now()
  entries.forEach((e) => e.prop.frame(env))
  draw()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
document.querySelector('#angle')!.addEventListener('click', () => {
  oblique = !oblique
})
document.querySelector('#theme')!.addEventListener('click', () => {
  dark = !dark
  document.body.style.background = dark ? '#242320' : 'white'
  document.body.style.color = dark ? '#f2f0ec' : '#3a3733'
  entries.forEach((e) => e.kit.applyColors(colors(dark)))
})
document.querySelector('#act')!.addEventListener('click', () => entries.forEach((e) => e.prop.click()))
canvas.addEventListener('click', (event) => {
  const r = canvas.getBoundingClientRect()
  const col = Math.floor(((event.clientX - r.left) / r.width) * 4),
    row = Math.floor(((event.clientY - r.top) / r.height) * 3)
  entries[row * 4 + col]?.prop.click()
})
Object.assign(window, {
  deskAudit: {
    entries,
    env,
    draw,
    inspect: () =>
      entries.map((e) => {
        const b = new Box3().setFromObject(e.prop.root)
        return { kind: e.kind, min: b.min.toArray(), max: b.max.toArray(), endsAt: e.endsAt }
      }),
  },
})
