import { Group, Mesh, type Object3D, OrthographicCamera, Raycaster, Scene, ShaderMaterial, Vector2, Vector3 } from 'three'
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { runSurface } from '../../../../shared/three/runSurface'
import type { SceneFactory, SurfaceModule } from '../../../../shared/three/surface'
import { DESK_LINE_INSET, LAMP_BASE, LAMP_X, PROP_FOOTPRINT, deskFloor, onDesk, type DeskSpan } from '../deskLayout'
import type { DeskItem, DeskParams, DeskPropId, LampBeam } from '../deskTypes'
import {
  LAMP_RIG,
  constrainPose,
  fitPose,
  handleAngle,
  pointerAngle,
  withHandleAngle,
  type DeskFloor,
  type LampBounds,
  type LampPose,
} from '../lampKinematics'
import { CANDLE_LIGHTS, DETAIL, clamp01, createKit, easeInOut, easeOut, step, type Spring } from './kit'
import { buildLampRig, type RigHandle } from './lampRig'
import type { DeskProp, PropEnv, PropOptions } from './props/common'
import { centerPropBuilders } from './props/centerProps'
import { smallPropBuilders } from './props/smallProps'

/**
 * The masthead desk, seen exactly side on with the toolbar rule as the desk:
 * a balanced-arm lamp and whatever props the user stood along it, drawn as
 * paper-white solids with ink outlines (DESIGN.md › Desk). Props are carried
 * along the desk by dragging, and lifted off its top they're taken away; the
 * lamp's base slides the same way and its hinges bend, and the lamp raises
 * its head clear of anything put under it. Its light, computed from the
 * shade, is handed to the page overlay through `onBeam`. Each prop is drawn
 * over the ones behind it, so they can overlap like things on a real desk,
 * and the lamp stands in front of them all (its switch is never buried). It
 * draws at the display's rate (up to 120 fps); the loop sleeps while the tab
 * is hidden or the desk is scrolled away.
 */

const builders: Record<DeskPropId, (options: PropOptions) => DeskProp> = { ...centerPropBuilders, ...smallPropBuilders }

/** The bulb flickers on: [seconds, level]. */
const FLICKER: [number, number][] = [[0, 0], [0.03, 0.75], [0.07, 0.08], [0.13, 0.9], [0.18, 0.3], [0.27, 1]]
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
const ITEM_Z = 0.1
/** World units per second squared, for props let go above the desk. */
const GRAVITY = 30
const PHYSICS_STEP = 1 / 240
/** A prop lifted to within this of the top of the masthead is taken away when let go. */
const LIFT_OFF = 0.3
/** How far above the desk a new prop is dropped from. */
const DROP_HEIGHT = 1.1
const PUFF_STROKES = 8
const PUFF_SECONDS = 0.5

const flicker = (t: number) => {
  for (let i = 1; i < FLICKER.length; i += 1) {
    const [t1, v1] = FLICKER[i]
    if (t <= t1) {
      const [t0, v0] = FLICKER[i - 1]
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
    }
  }
  return 1
}

type Hit = { kind: 'lamp' | 'note' | 'prop'; id: string | null; handle: RigHandle | null }

type Entry = {
  id: string
  kind: DeskPropId
  prop: DeskProp
  half: number
  top: number
  /** Where the user put it, and where it stands on this desk (or is being carried to). */
  stored: number
  home: number
  timer: { endsAt: number | null }
  /** Where it is drawn: it glides to `home`. */
  x: Spring
  /** Height above the desk: held up by the hand, or falling back. */
  lift: { y: number; v: number; target: number }
  tilt: Spring
  scale: Spring
  press: Spring
  /** How high up it is held (its own units): it swings about that point. */
  pivot: number
  held: boolean
  /** Held up past the lift-off line: it goes when let go. */
  removing: boolean
  leaving: boolean
}

type Drag = {
  hit: Hit
  pointerId: number
  clientX: number
  clientY: number
  moved: boolean
  /** The world point where it began. */
  from: [number, number]
  /** A hinge: the angle between the pointer and the joint when it began. */
  offset: number
  /** The base: where the lamp stood. A prop: how far its middle is from the pointer. */
  start: number
}

type Puff = { object: LineSegments2; positions: Float32Array; x: number; y: number; size: number; born: number }

const factory: SceneFactory<DeskParams> = (context, initial) => {
  const { renderer, still } = context
  const canvas = renderer.domElement
  let params = initial
  let width = context.width
  let height = context.height
  // Each prop is drawn over the ones behind it, so the frame is cleared by hand.
  renderer.autoClear = false

  const kit = createKit({ width, height, unit: params.unit, colors: params.colors })
  const scene = new Scene()
  const overlay = new Group()
  scene.add(overlay)
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  let deskY = 1
  let top = 2
  let span: DeskSpan = { left: -2, right: 2 }
  let lampArea: DeskSpan = { left: -2, right: 2 }
  const fitCamera = () => {
    const unit = params.unit
    const left = -params.origin / unit
    const right = (width - params.origin) / unit
    const frustumHeight = height / unit
    // The desk line sits DESK_LINE_INSET px above the canvas bottom.
    deskY = (height / 2 - DESK_LINE_INSET) / unit
    camera.left = left
    camera.right = right
    camera.top = frustumHeight / 2
    camera.bottom = -frustumHeight / 2
    camera.position.set(0, deskY, 20)
    camera.lookAt(0, deskY, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    top = deskY + frustumHeight / 2
    span = { left: left + 0.05, right: right - 0.05 }
    lampArea = { left: left + 0.3, right: right - 0.1 }
    kit.resize(width, height, unit)
  }
  fitCamera()

  const lamp = buildLampRig(kit)
  scene.add(lamp.root)
  overlay.add(lamp.hints.elbowRing, lamp.hints.headRing, lamp.hints.shadeArc, lamp.hints.baseArrows)
  lamp.applyTheme(params.colors, params.lampOn)

  // ── State.

  let lampX = params.lampX
  let lampShown = lampX
  /** The pose the user left the lamp in, and the one it takes to clear what stands under it. */
  const rest: LampPose = { ...params.pose }
  const pose: LampPose = { ...params.pose }
  const shown: LampPose = { ...params.pose }
  let lampOn = params.lampOn
  // A lamp already on at load comes up quietly; only a switch flickers.
  let startup = lampOn
  let lightFrom = 0
  let dimFrom = 0
  let switchedAt = -10
  let light = 0
  let dim = 0
  let elapsed = 0
  let hover: Hit | null = null
  let drag: Drag | null = null
  let keys = 0
  let lastBeam = ''
  const elbowBounce: Spring = { x: 0, v: 0 }
  const lampPress: Spring = { x: 0, v: 0 }
  const noteFlutter: Spring = { x: 0, v: 0 }
  const hints = { elbow: 0, head: 0, shade: 0, base: 0 }

  // ── The props, back to front.

  const placed = new Map<string, Entry>()
  let layers: string[] = []
  const pickables: Object3D[] = []
  const refreshPickables = () => {
    pickables.length = 0
    const collect = (root: Object3D) =>
      root.traverse((object) => {
        if (object instanceof Mesh && object.material instanceof ShaderMaterial && 'uBase' in object.material.uniforms) pickables.push(object)
      })
    for (const entry of placed.values()) if (!entry.leaving) collect(entry.prop.root)
    collect(lamp.root)
    pickables.push(...lamp.proxies, lamp.noteFace)
  }

  const place = (item: DeskItem, dropIn: boolean) => {
    const { half, top: tall } = PROP_FOOTPRINT[item.kind]
    const home = onDesk(item.x, half, span)
    const timer = { endsAt: item.endsAt ?? null }
    const prop = builders[item.kind]({
      kit,
      timer: {
        get: () => timer.endsAt,
        set: (endsAt) => {
          timer.endsAt = endsAt
          params.onItemTimer(item.id, endsAt)
        },
      },
    })
    const falling = dropIn && !still
    const entry: Entry = {
      id: item.id,
      kind: item.kind,
      prop,
      half,
      top: tall,
      stored: item.x,
      home,
      timer,
      x: { x: home, v: 0 },
      lift: { y: falling ? Math.min(DROP_HEIGHT, Math.max(0, top - 0.1 - tall)) : 0, v: 0, target: 0 },
      tilt: { x: 0, v: 0 },
      scale: { x: falling ? 0.35 : 1, v: 0 },
      press: { x: 0, v: 0 },
      pivot: tall * 0.6,
      held: false,
      removing: false,
      leaving: false,
    }
    prop.root.userData.kind = 'prop'
    prop.root.userData.id = item.id
    prop.root.position.set(home, entry.lift.y, ITEM_Z)
    scene.add(prop.root)
    placed.set(item.id, entry)
  }

  const discard = (entry: Entry) => {
    scene.remove(entry.prop.root)
    entry.prop.dispose?.()
    kit.release(entry.prop.root)
    placed.delete(entry.id)
  }

  // A pencil puff where a prop was taken away.
  const puffs: Puff[] = []
  const puff = (x: number, y: number, size: number) => {
    if (still) return
    let p = puffs.find((candidate) => !candidate.object.visible)
    if (!p) {
      const positions = new Float32Array(PUFF_STROKES * 6)
      const object = kit.segments(positions, DETAIL, 'pencil')
      object.material.depthTest = false
      overlay.add(object)
      p = { object, positions, x, y, size, born: 0 }
      puffs.push(p)
    }
    Object.assign(p, { x, y, size, born: elapsed })
    p.object.visible = true
  }

  const takeAway = (entry: Entry) => {
    if (entry.leaving) return
    entry.leaving = true
    entry.held = false
    entry.removing = false
    const s = Math.max(entry.scale.x, 0.3)
    puff(entry.x.x, entry.lift.y + entry.top * 0.5 * s, Math.max(entry.half, entry.top * 0.5) * s + 0.12)
  }

  const syncItems = (items: DeskItem[], dropIn: boolean) => {
    const ids = new Set(items.map((item) => item.id))
    for (const entry of placed.values()) if (!ids.has(entry.id)) takeAway(entry)
    for (const item of items) {
      const existing = placed.get(item.id)
      // Put back while it was still going: it starts afresh.
      if (existing?.leaving) discard(existing)
      const entry = placed.get(item.id)
      if (!entry) {
        place(item, dropIn)
        continue
      }
      entry.stored = item.x
      entry.timer.endsAt = item.endsAt ?? null
      if (!entry.held) entry.home = onDesk(item.x, entry.half, span)
    }
    layers = items.map((item) => item.id)
    refreshPickables()
  }

  // ── The lamp among the props.

  // Its maths works around its own base at LAMP_X; it stands at lampX.
  const lampBounds = (x: number): LampBounds => ({ left: lampArea.left - (x - LAMP_X), right: lampArea.right - (x - LAMP_X), top: top - 0.1 })
  const lampFloor = (x: number): DeskFloor => {
    const standing: { kind: DeskPropId; x: number }[] = []
    for (const entry of placed.values()) if (!entry.leaving) standing.push({ kind: entry.kind, x: entry.home })
    const floor = deskFloor(standing, x)
    const shift = x - LAMP_X
    return (local) => floor(local + shift)
  }
  const lampFit = (x: number) => fitPose(rest, lampBounds(x), lampFloor(x))
  /** Raises the lamp's head clear of whatever now stands under it, or lets it back down. */
  const refit = () => {
    if (drag?.moved && drag.hit.handle && drag.hit.handle !== 'base') return
    const fitted = lampFit(lampX)
    if (fitted) Object.assign(pose, fitted)
  }
  /** Carries the lamp toward x, stopping where it no longer fits. */
  const moveLamp = (target: number) => {
    const to = Math.min(lampArea.right - 0.1, Math.max(span.left + LAMP_BASE.half, target))
    const fitted = lampFit(to)
    if (fitted) {
      lampX = to
      Object.assign(pose, fitted)
      return
    }
    const from = lampX
    let lo = 0
    let hi = 1
    let best: LampPose | null = null
    for (let i = 0; i < 8; i += 1) {
      const mid = (lo + hi) / 2
      const p = lampFit(from + (to - from) * mid)
      if (p) {
        lo = mid
        best = p
      } else hi = mid
    }
    if (best) {
      lampX = from + (to - from) * lo
      Object.assign(pose, best)
    }
  }

  syncItems(params.items, false)
  refit()
  Object.assign(shown, pose)

  // ── Picking and dragging.

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const hitOf = (object: Object3D): Hit | null => {
    for (let o: Object3D | null = object; o; o = o.parent) {
      if (!o.visible) return null
    }
    for (let o: Object3D | null = object; o; o = o.parent) {
      const kind = o.userData.kind as Hit['kind'] | undefined
      if (kind === 'note') return { kind, id: null, handle: null }
      if (kind === 'prop') {
        const entry = placed.get(o.userData.id as string)
        return entry && !entry.leaving && entry.scale.x > 0.2 ? { kind, id: entry.id, handle: null } : null
      }
      if (kind === 'lamp') return { kind, id: null, handle: (object.userData.handle as RigHandle | undefined) ?? null }
    }
    return null
  }
  /** Back to front, the carried prop last. */
  const drawOrder = () => {
    const carried = drag?.moved && drag.hit.id ? drag.hit.id : null
    return carried ? [...layers.filter((id) => id !== carried), carried] : layers
  }
  // Pointer coordinates are on-screen px; the shell may be zoomed, so measure
  // the canvas on screen rather than trusting its layout size.
  const pick = (event: { clientX: number; clientY: number }): Hit | null => {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    // The lamp stands in front of the props, its note and hinges most of all;
    // then the props, front to back.
    const order = drawOrder()
    let best: Hit | null = null
    let bestRank = -1
    for (const hit of raycaster.intersectObjects(pickables, false)) {
      const found = hitOf(hit.object)
      if (!found) continue
      const rank =
        found.kind === 'note' ? 9
        : found.kind === 'prop' ? 1 + (order.indexOf(found.id ?? '') + 1) * 1e-4
        : 2 + ((hit.object.userData.priority as number | undefined) ?? 0)
      if (rank > bestRank) {
        bestRank = rank
        best = found
      }
    }
    return best
  }
  const toWorld = (event: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvas.getBoundingClientRect()
    const x = camera.left + ((event.clientX - rect.left) / rect.width) * (camera.right - camera.left)
    const y = top - ((event.clientY - rect.top) / rect.height) * (height / params.unit)
    return [x, y]
  }
  const cursorFor = (hit: Hit | null) => (hit ? 'grab' : '')
  const carriedEntry = () => (drag?.hit.kind === 'prop' && drag.hit.id ? placed.get(drag.hit.id) : undefined)

  const click = (hit: Hit) => {
    if (hit.kind === 'lamp') {
      params.onToggleLamp()
      return
    }
    if (hit.kind === 'note') {
      noteFlutter.v += 6
      return
    }
    const entry = hit.id ? placed.get(hit.id) : undefined
    if (!entry) return
    entry.press.v -= 1.6
    entry.prop.click()
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || drag) return
    const hit = pick(event)
    if (!hit) return
    const at = toWorld(event)
    const hinge = hit.handle && hit.handle !== 'base' ? hit.handle : null
    drag = {
      hit,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
      from: at,
      offset: hinge ? handleAngle(hinge, pose) - pointerAngle(hinge, pose, at[0] - (lampX - LAMP_X), at[1]) : 0,
      start: hit.handle === 'base' ? lampX : 0,
    }
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // the pointer may already be gone
    }
    event.preventDefault()
  }
  const onPointerMove = (event: PointerEvent) => {
    if (drag) {
      if (event.pointerId !== drag.pointerId) return
      if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) > 3) {
        drag.moved = true
        canvas.style.cursor = 'grabbing'
        const entry = carriedEntry()
        if (entry && !entry.leaving) {
          // Picked up where the pointer took hold of it.
          entry.held = true
          entry.pivot = Math.min(entry.top, Math.max(0.05, drag.from[1] - entry.lift.y))
          entry.lift.target = entry.lift.y
          drag.start = entry.home - drag.from[0]
          drag.from[1] -= entry.lift.y
        }
      }
      if (!drag.moved) return
      const [x, y] = toWorld(event)
      const handle = drag.hit.handle
      const entry = carriedEntry()
      if (entry?.held) {
        entry.home = onDesk(x + drag.start, entry.half, span)
        entry.lift.target = Math.min(Math.max(0, top - 0.05 - entry.top), Math.max(0, y - drag.from[1]))
        entry.removing = y > top - LIFT_OFF || event.clientY < canvas.getBoundingClientRect().top
        refit()
      } else if (handle === 'base') {
        moveLamp(drag.start + x - drag.from[0])
      } else if (handle) {
        const angle = pointerAngle(handle, pose, x - (lampX - LAMP_X), y) + drag.offset
        Object.assign(pose, constrainPose(pose, withHandleAngle(handle, pose, angle), lampBounds(lampX), lampFloor(lampX)))
        Object.assign(rest, pose)
      }
      context.invalidate()
      return
    }
    hover = pick(event)
    canvas.style.cursor = cursorFor(hover)
    context.invalidate()
  }
  const endDrag = (event: PointerEvent, cancelled: boolean) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const finished = drag
    const entry = carriedEntry()
    drag = null
    try {
      canvas.releasePointerCapture(event.pointerId)
    } catch {
      // already released
    }
    if (entry?.held) {
      entry.held = false
      if (entry.removing && !cancelled) {
        takeAway(entry)
        params.onItemRemove(entry.id)
      } else {
        entry.removing = false
        params.onItemMove(entry.id, entry.home)
      }
    } else if (!finished.moved) {
      if (!cancelled) click(finished.hit)
    } else if (finished.hit.handle === 'base') {
      params.onLampMove(lampX)
    } else if (finished.hit.handle) {
      params.onPose({ ...rest })
    }
    hover = pick(event)
    canvas.style.cursor = cursorFor(hover)
    refit()
    context.invalidate()
  }
  const onPointerUp = (event: PointerEvent) => endDrag(event, false)
  const onPointerCancel = (event: PointerEvent) => endDrag(event, true)
  const onPointerLeave = () => {
    if (drag) return
    hover = null
    canvas.style.cursor = ''
    context.invalidate()
  }
  // The kitchen timer's dial turns with the wheel; everywhere else the page scrolls.
  const onWheel = (event: WheelEvent) => {
    const hit = drag ? null : pick(event)
    const entry = hit?.kind === 'prop' && hit.id ? placed.get(hit.id) : undefined
    if (!entry?.prop.wheel) return
    event.preventDefault()
    entry.prop.wheel(event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1))
    context.invalidate()
    // It starts once the wheel rests, which a still desk only sees on its next frame.
    window.setTimeout(() => context.invalidate(), 760)
  }
  // The typewriter types along with the app: only that a key went down, never which.
  const onKeyDown = (event: KeyboardEvent) => {
    if (MODIFIER_KEYS.has(event.key)) return
    keys += 1
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown, { passive: true })

  // ── The light handed to the page.

  const projected = new Vector3()
  const toCanvas = (world: Vector3): [number, number] => {
    projected.copy(world).project(camera)
    return [((projected.x + 1) / 2) * width, ((1 - projected.y) / 2) * height]
  }
  const mouthWorld = new Vector3()
  const axisWorld = new Vector3()
  const bulbWorld = new Vector3()
  const elbowWorld = new Vector3()
  const headWorld = new Vector3()
  let candles: Vector3[] = []
  const publishBeam = () => {
    if (light < 0.002 && dim < 0.002) {
      if (lastBeam !== 'off') {
        lastBeam = 'off'
        params.onBeam(null)
      }
      return
    }
    lamp.head.localToWorld(mouthWorld.set(0, -LAMP_RIG.mouth, 0))
    lamp.head.localToWorld(axisWorld.set(0, -LAMP_RIG.mouth - 1, 0))
    lamp.bulb.getWorldPosition(bulbWorld)
    const mouth = toCanvas(mouthWorld)
    const axis = toCanvas(axisWorld)
    const length = Math.hypot(axis[0] - mouth[0], axis[1] - mouth[1]) || 1
    const beam: LampBeam = {
      mouth,
      dir: [(axis[0] - mouth[0]) / length, (axis[1] - mouth[1]) / length],
      radius: LAMP_RIG.mouthRadius * params.unit,
      bulb: toCanvas(bulbWorld),
      light,
      dim,
      // Steady, not flickering: the overlay shouldn't redraw every frame for a candle.
      glows: candles.map((at) => ({ at: toCanvas(at), radius: 0.8 * params.unit, strength: 1 })),
    }
    const key = [beam.mouth[0], beam.mouth[1], beam.dir[0], beam.dir[1], light, dim, width, height, ...beam.glows.flatMap((g) => g.at)]
      .map((n) => n.toFixed(3))
      .join()
    if (key === lastBeam) return
    lastBeam = key
    params.onBeam(beam)
  }

  // ── The frame.

  const settle = (s: Spring, target: number, k: number, c: number, dt: number) => {
    if (still || dt === 0) {
      s.x = target
      s.v = 0
    } else step(s, target, k, c, dt)
  }
  /** Held up by the hand, or falling back to the desk with a bounce or two. */
  const moveLift = (entry: Entry, dt: number) => {
    const lift = entry.lift
    if (still || dt === 0) {
      lift.y = entry.held ? lift.target : 0
      lift.v = 0
      return
    }
    for (let left = dt; left > 0; left -= PHYSICS_STEP) {
      const h = Math.min(left, PHYSICS_STEP)
      if (entry.held) {
        lift.v += (500 * (lift.target - lift.y) - 42 * lift.v) * h
        lift.y += lift.v * h
      } else if (lift.y > 0 || lift.v > 0) {
        lift.v -= GRAVITY * h
        lift.y += lift.v * h
        if (lift.y <= 0) {
          lift.y = 0
          const impact = -lift.v
          lift.v = impact > 1.2 ? impact * 0.28 : 0
          entry.press.v -= Math.min(3, impact * 0.3)
        }
      }
    }
  }

  const frame = (dt: number, t: number) => {
    elapsed = t

    // The light: a flicker when switched on, an easy fade when switched off.
    const since = elapsed - switchedAt
    if (still) {
      light = lampOn ? 1 : 0
      dim = light
    } else if (lampOn && startup) {
      light = easeOut(clamp01(elapsed / 0.4))
      dim = light
      if (light >= 1) startup = false
    } else if (lampOn) {
      light = since < 0.27 ? Math.max(lightFrom, flicker(since)) : 1
      dim = dimFrom + (1 - dimFrom) * easeOut(clamp01((since - 0.1) / 0.55))
    } else {
      light = lightFrom * (1 - clamp01(since / 0.16))
      dim = dimFrom * (1 - easeInOut(clamp01(since / 0.34)))
    }
    kit.shared.uLight.value = light
    lamp.haloMaterial.opacity = light * (params.colors.dark ? 0.55 : 0.45)

    // The lamp eases toward where it stands and how it's posed; switching bounces the elbow.
    const ease = still || dt === 0 ? 1 : 1 - Math.exp(-dt * 28)
    lampShown += (lampX - lampShown) * ease
    shown.a1 += (pose.a1 - shown.a1) * ease
    shown.a2 += (pose.a2 - shown.a2) * ease
    shown.a3 += (pose.a3 - shown.a3) * ease
    settle(elbowBounce, 0, 120, 7, dt)
    settle(lampPress, 0, 300, 14, dt)
    lamp.root.position.x = lampShown
    lamp.shoulder.rotation.z = shown.a1
    lamp.elbow.rotation.z = shown.a2 + elbowBounce.x
    lamp.head.rotation.set(LAMP_RIG.tilt, 0, shown.a3)
    lamp.lampSwitch.position.y = 0.075 + lampPress.x * 0.2
    scene.updateMatrixWorld()
    lamp.bulb.getWorldPosition(kit.shared.uBulb.value)
    const shadeAngle = shown.a1 + shown.a2 + elbowBounce.x + shown.a3
    kit.shared.uDir.value.set(
      Math.sin(shadeAngle) * Math.cos(LAMP_RIG.tilt),
      -Math.cos(shadeAngle) * Math.cos(LAMP_RIG.tilt),
      -Math.sin(LAMP_RIG.tilt),
    )

    // The sticky note.
    lamp.note.visible = params.note !== null
    if (params.note) lamp.drawNote(params.note.text, params.colors)
    settle(noteFlutter, 0, 120, 6, dt)
    lamp.note.rotation.x = (still ? 0 : Math.sin(t * 1.3) * 0.04) + noteFlutter.x * 0.08

    // Hints: which parts of the lamp move, while it is pointed at or dragged.
    const dragging = !!drag?.moved && drag.hit.kind === 'lamp'
    const active = dragging ? drag?.hit.handle ?? null : hover?.kind === 'lamp' ? hover.handle ?? 'lamp' : null
    const level = (part: RigHandle, idle: number) =>
      active === part ? 1 : !active ? 0 : dragging ? (part === 'elbow' || part === 'head' ? 0.15 : 0) : idle
    const fade = still || dt === 0 ? 1 : 1 - Math.exp(-dt * 14)
    hints.elbow += (level('elbow', 0.4) - hints.elbow) * fade
    hints.head += (level('head', 0.4) - hints.head) * fade
    hints.shade += (level('shade', 0.3) - hints.shade) * fade
    hints.base += (level('base', 0.4) - hints.base) * fade
    lamp.elbow.getWorldPosition(elbowWorld)
    lamp.head.getWorldPosition(headWorld)
    for (const [ring, amount, at] of [[lamp.hints.elbowRing, hints.elbow, elbowWorld], [lamp.hints.headRing, hints.head, headWorld]] as const) {
      ring.visible = amount > 0.01
      ring.material.opacity = amount
      ring.position.set(at.x, at.y, 1)
      ring.scale.setScalar(0.8 + 0.2 * amount)
    }
    const arrows = lamp.hints.baseArrows
    arrows.visible = hints.base > 0.01
    arrows.material.opacity = hints.base
    arrows.position.set(lampShown, 0, 1)
    arrows.scale.set(0.9 + 0.1 * hints.base, 1, 1)
    const arc = lamp.hints.shadeArc
    arc.visible = hints.shade > 0.01
    if (arc.visible) {
      arc.material.opacity = hints.shade
      let n = 0
      for (let dash = 0; dash < 7; dash += 1) {
        const a0 = shadeAngle - 0.55 + dash * (1.1 / 7)
        const a1 = a0 + (1.1 / 7) * 0.55
        for (let j = 0; j < 3; j += 1) {
          const u0 = a0 + ((a1 - a0) * j) / 3
          const u1 = a0 + ((a1 - a0) * (j + 1)) / 3
          lamp.hints.arcPositions.set([headWorld.x + Math.sin(u0) * 0.64, headWorld.y - Math.cos(u0) * 0.64, 1, headWorld.x + Math.sin(u1) * 0.64, headWorld.y - Math.cos(u1) * 0.64, 1], n)
          n += 6
        }
      }
      kit.markDirty(arc)
    }

    // The props: carried, dropped, swinging and settling; leaving ones shrink away.
    const env: PropEnv = { t, dt, still, hovered: false, light, bulb: kit.shared.uBulb.value, keys, now: Date.now() }
    keys = 0
    const glows: { position: Vector3; strength: number }[] = []
    for (const entry of [...placed.values()]) {
      if (entry.leaving) {
        settle(entry.scale, 0, 320, 36, dt)
        if (entry.scale.x < 0.01) {
          discard(entry)
          refreshPickables()
          continue
        }
      } else settle(entry.scale, entry.removing ? 0.6 : entry.held ? 1.05 : 1, 260, 22, dt)
      settle(entry.x, entry.home, entry.held ? 700 : 170, entry.held ? 52 : 24, dt)
      moveLift(entry, dt)
      // Carried, it swings back against the way it moves, about where it's held
      // (a wide prop less: its ends would sweep a long way).
      const reach = Math.sqrt(0.5 / Math.max(0.5, entry.half))
      const swing = entry.held ? Math.max(-0.24, Math.min(0.24, -entry.x.v * 0.04)) * reach + (entry.removing && !still ? Math.sin(t * 34) * 0.06 : 0) : 0
      settle(entry.tilt, swing, 140, 7, dt)
      settle(entry.press, 0, 300, 14, dt)
      const s = Math.max(entry.scale.x, 1e-4)
      const angle = entry.tilt.x
      const pivot = entry.pivot * s
      const root = entry.prop.root
      root.visible = entry.scale.x > 0.01
      root.position.set(entry.x.x + pivot * Math.sin(angle), entry.lift.y + pivot - pivot * Math.cos(angle), ITEM_Z)
      root.rotation.z = angle
      root.scale.set(s, s * (1 + entry.press.x), s)
      if (!root.visible) continue
      root.updateMatrixWorld()
      env.hovered = hover?.kind === 'prop' && hover.id === entry.id
      entry.prop.frame(env)
      const glow = entry.leaving ? null : entry.prop.emitter?.()
      if (glow && glow.strength > 0) glows.push({ position: glow.position.clone(), strength: glow.strength })
    }
    // Lit candles warm the paper near them; the overlay keeps a steady pool around each.
    const lights = kit.shared.uCandles.value
    for (let i = 0; i < CANDLE_LIGHTS; i += 1) {
      const glow = glows[i]
      if (glow) lights[i].set(glow.position.x, glow.position.y, glow.position.z, glow.strength)
      else lights[i].set(0, -10, 0, 0)
    }
    candles = glows.map((g) => g.position)

    // Puffs where props were taken away.
    for (const p of puffs) {
      if (!p.object.visible) continue
      const age = (elapsed - p.born) / PUFF_SECONDS
      const head = easeOut(clamp01(age / 0.6))
      const tail = easeInOut(clamp01((age - 0.25) / 0.75))
      p.object.visible = age < 1 && head - tail > 0.01
      if (!p.object.visible) continue
      for (let i = 0; i < PUFF_STROKES; i += 1) {
        const a = (i / PUFF_STROKES) * Math.PI * 2 + 0.3
        const r0 = p.size * (0.5 + 0.7 * tail)
        const r1 = p.size * (0.5 + 0.7 * head)
        p.positions.set([p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0, 1, p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1, 1], i * 6)
      }
      kit.markDirty(p.object)
    }

    // Back to front: each prop over the ones behind it, the lamp in front of
    // them, then whatever is in the hand or going away, then the pencil hints.
    renderer.clear()
    const carried = drag?.moved && drag.hit.id ? drag.hit.id : null
    const going = [...placed.values()].filter((entry) => entry.leaving).map((entry) => entry.id)
    const draw = (id: string) => {
      const entry = placed.get(id)
      if (!entry?.prop.root.visible) return
      renderer.clearDepth()
      renderer.render(entry.prop.root, camera)
    }
    for (const id of layers) if (id !== carried) draw(id)
    renderer.clearDepth()
    renderer.render(lamp.root, camera)
    if (carried) draw(carried)
    for (const id of going) draw(id)
    renderer.clearDepth()
    renderer.render(overlay, camera)
    publishBeam()
  }

  const switchLamp = (on: boolean) => {
    lampOn = on
    startup = false
    switchedAt = elapsed
    lightFrom = light
    dimFrom = dim
    elbowBounce.v += on ? -0.7 : 0.5
    lampPress.v -= 2.5
    lamp.applyTheme(params.colors, on)
  }

  const reflow = () => {
    fitCamera()
    for (const entry of placed.values()) if (!entry.held) entry.home = onDesk(entry.stored, entry.half, span)
    lastBeam = ''
  }

  return {
    update(next) {
      const previous = params
      params = next
      if (next.colors !== previous.colors) {
        kit.applyColors(next.colors)
        lamp.applyTheme(next.colors, lampOn)
      }
      if (next.unit !== previous.unit || next.origin !== previous.origin) reflow()
      if (next.lampOn !== lampOn) switchLamp(next.lampOn)
      if (next.items !== previous.items) syncItems(next.items, true)
      if (next.lampX !== previous.lampX && drag?.hit.handle !== 'base') lampX = next.lampX
      if (next.pose !== previous.pose && !drag) Object.assign(rest, next.pose)
      refit()
      if (next.highlight && next.highlight !== previous.highlight) {
        const entry = placed.get(next.highlight)
        // A little hop, to say which one it is.
        if (entry && !entry.held && !entry.leaving && entry.lift.y < 0.02 && !still) entry.lift.v = 3.2
      }
    },
    frame,
    resize(w, h) {
      width = w
      height = h
      reflow()
      refit()
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      canvas.style.cursor = ''
      params.onBeam(null)
      for (const { prop } of placed.values()) prop.dispose?.()
      lamp.dispose()
      scene.traverse((object) => {
        const mesh = object as Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as { dispose?: () => void } | undefined
        material?.dispose?.()
      })
    },
  }
}

export const mount: SurfaceModule<DeskParams>['mount'] = (canvas, params, options) =>
  runSurface(canvas, factory, params, { fps: 120, maxDpr: 2, ...options })
