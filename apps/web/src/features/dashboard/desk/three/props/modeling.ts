import { CatmullRomCurve3, CylinderGeometry, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Kit } from '../kit'

/** Dimensions are baked into geometry: outlines must not inherit a squash. */
export const roundedBox = (w: number, h: number, d: number, radius = 0.02) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3))

export const ellipsoid = (x: number, y: number, z: number) => new SphereGeometry(1, 32, 20).scale(x, y, z)

export const tube = (points: [number, number, number][], radius: number, segments = 32) =>
  new TubeGeometry(new CatmullRomCurve3(points.map((p) => new Vector3(...p))), segments, radius, 8, false)

/** A cylinder between two physical attachment points; no floating endpoints. */
export const rodBetween = (kit: Kit, from: [number, number, number], to: [number, number, number], radius: number) => {
  const a = new Vector3(...from),
    b = new Vector3(...to)
  const rod = kit.hull(kit.solid(new CylinderGeometry(radius, radius, a.distanceTo(b), 12)), 1)
  rod.position.copy(a.add(b).multiplyScalar(0.5))
  rod.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...to).sub(new Vector3(...from)).normalize())
  return rod
}
