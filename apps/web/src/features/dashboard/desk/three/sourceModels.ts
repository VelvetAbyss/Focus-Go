import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import laptopUrl from '../assets/laptop.glb?url'
import typewriterUrl from '../assets/typewriter.glb?url'
import candleUrl from '../assets/candle.glb?url'
import type { Kit } from './kit'

const urls = { laptop: laptopUrl, typewriter: typewriterUrl, candle: candleUrl }
export type SourceModel = keyof typeof urls
const sources = new Map<SourceModel, GLTF>()
let loading: Promise<void> | undefined

/** The decorative surface loads separately from the dashboard. Assets are local,
 * versioned files: no third-party network dependency at runtime. */
export const prepareSourceModels = () => loading ??= Promise.all(
  (Object.entries(urls) as [SourceModel, string][]).map(async ([id, url]) => {
    const model = await new GLTFLoader().loadAsync(url)
    sources.set(id, model)
  }),
).then(() => {}).catch((error) => { loading = undefined; throw error })

export const sourceModel = (id: SourceModel) => {
  const source = sources.get(id)
  if (!source) throw new Error(`Desk model ${id} was not prepared`)
  // Geometry is instance-owned: removing one prop must not dispose another instance or the source cache.
  const scene = source.scene.clone(true)
  scene.traverse((object) => {
    if (object instanceof Mesh) object.geometry = object.geometry.clone()
  })
  return { scene }
}

/** Bake a static model into desk coordinates without flattening its named parts. */
export const staticSource = (id: SourceModel, width: number, kit: Kit) => {
  const { scene } = sourceModel(id)
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene), center = bounds.getCenter(new Vector3())
  const scale = width / (bounds.max.x - bounds.min.x)
  const root = new Group()
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const geometry = object.geometry
    geometry.applyMatrix4(object.matrixWorld)
    geometry.translate(-center.x, -bounds.min.y, -center.z)
    geometry.scale(scale, scale, scale)
    const material = object.material as MeshStandardMaterial
    const key = id === 'typewriter' && object.name === 'group2_Typewriter_pCylinder5' ? 'vinyl' : 'paper'
    const mesh = kit.solid(geometry, key, id === 'candle' ? { inkMap: material.map ?? undefined } : undefined)
    mesh.name = object.name
    mesh.userData.sourceMaterial = material.name
    // Creases describe keys, bezels and seams; hulls retain curved silhouettes.
    kit.hull(mesh, 0.85)
    kit.edges(mesh, 0.55, 42, 'ink3')
    root.add(mesh)
  })
  return root
}
