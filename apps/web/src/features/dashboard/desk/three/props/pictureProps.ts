import { BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, Vector2 } from 'three'
import { defaultPicture, type PictureKind, type PictureSettings } from '../../pictureTypes'
import { acquirePictureTexture } from '../pictureTextures'
import type { DeskProp, PropOptions } from './common'

const buildPicture = (kind: PictureKind, options: PropOptions): DeskProp => {
  const { kit } = options
  let settings = options.picture ?? defaultPicture(kind)
  const root = new Group()
  root.name = kind === 'window' ? 'casement-window' : 'wall-art-frame'
  const box = (group: Group, name: string, w: number, h: number, d: number, x: number, y: number, z: number, detail = false) => {
    const mesh = kit.edges(kit.solid(new BoxGeometry(w, h, d)), detail ? 0.65 : 1.1, 25, detail ? 'ink3' : 'ink')
    mesh.position.set(x, y, z); mesh.name = name
    group.add(mesh)
    return mesh
  }
  const border = (group: Group, name: string, x0: number, y0: number, w: number, h: number, rail: number, z: number, depth: number) => {
    box(group, name + '-left', rail, h, depth, x0 + rail / 2, y0 + h / 2, z)
    box(group, name + '-right', rail, h, depth, x0 + w - rail / 2, y0 + h / 2, z)
    box(group, name + '-top', w - rail * 2, rail, depth, x0 + w / 2, y0 + h - rail / 2, z)
    box(group, name + '-bottom', w - rail * 2, rail, depth, x0 + w / 2, y0 + rail / 2, z)
  }
  const imageMaterial = new ShaderMaterial({
    uniforms: { picture: { value: null }, uvScale: { value: new Vector2(1, 1) }, uvOffset: { value: new Vector2() }, ready: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D picture; uniform vec2 uvScale; uniform vec2 uvOffset; uniform float ready; varying vec2 vUv;
      void main(){ vec2 at=vUv*uvScale+uvOffset;
        if(ready<0.5 || at.x<0.0 || at.x>1.0 || at.y<0.0 || at.y>1.0) discard;
        gl_FragColor=texture2D(picture,at);
        #include <colorspace_fragment>
      }`,
    side: DoubleSide,
  })
  const inset = kind === 'window' ? 0.045 : 0.13
  const backing = box(root, 'picture-backing', 1, 1, 0.018, 0, 0.5, -0.035)
  backing.userData.pictureSurface = true
  const photo = new Mesh(new PlaneGeometry(1 - 2 * inset, 1 - 2 * inset), imageMaterial)
  photo.position.set(0, 0.5, -0.022)
  photo.name = 'picture-surface'; photo.userData.pickable = true
  root.add(photo)
  const leaves: Group[] = []
  const glassMaterials: MeshBasicMaterial[] = []
  if (kind === 'window') {
    border(root, 'outer-jamb', -0.5, 0, 1, 1, 0.035, 0.01, 0.08)
    // A deep sill with a smaller lip and a recessed inner reveal.
    box(root, 'window-sill', 1.06, 0.035, 0.16, 0, 0.015, 0.04)
    box(root, 'sill-lip', 1.03, 0.018, 0.025, 0, -0.009, 0.105, true)
    for (const direction of [-1, 1]) {
      const leaf = new Group()
      leaf.name = direction === -1 ? 'window-left-leaf' : 'window-right-leaf'
      leaf.position.set(direction * 0.465, 0.044, 0.06)
      const x0 = direction === -1 ? 0 : -0.465
      border(leaf, 'sash', x0, 0, 0.465, 0.912, 0.024, 0, 0.028)
      box(leaf, 'sash-crossbar', 0.417, 0.018, 0.025, x0 + 0.2325, 0.52, 0)
      const glassMaterial = new MeshBasicMaterial({ color: 0xb8ced4, transparent: true, opacity: 0.10, side: DoubleSide, depthWrite: false })
      glassMaterials.push(glassMaterial)
      const glass = new Mesh(new PlaneGeometry(0.417, 0.864), glassMaterial)
      glass.position.set(x0 + 0.2325, 0.456, 0)
      leaf.add(glass)
      for (const y of [0.18, 0.72]) {
        const hinge = kit.edges(kit.solid(new CylinderGeometry(0.009, 0.009, 0.07, 12)), 0.7)
        hinge.position.set(0, y, 0.015); leaf.add(hinge)
      }
      const handleX = direction === -1 ? 0.426 : -0.426
      box(leaf, 'handle-plate', 0.015, 0.065, 0.01, handleX, 0.405, 0.023, true)
      const handle = box(leaf, 'window-handle', 0.009, 0.057, 0.018, handleX, 0.425, 0.039)
      handle.userData.windowToggle = true
      const glint = kit.segments([x0 + 0.09, 0.82, 0.018, x0 + 0.14, 0.75, 0.018, x0 + 0.11, 0.85, 0.018, x0 + 0.20, 0.73, 0.018], 0.7, 'ink4')
      leaf.add(glint); leaves.push(leaf); root.add(leaf)
    }
  } else {
    border(root, 'frame', -0.5, 0, 1, 1, 0.055, 0.018, 0.08)
    border(root, 'inner-bevel', -0.445, 0.055, 0.89, 0.89, 0.014, -0.004, 0.02)
    const wire = kit.segments([-.29,.96,-.055, 0,1.125,-.055, 0,1.125,-.055, .29,.96,-.055], .8, 'ink3')
    wire.name = 'frame-hanging-wire'; root.add(wire)
    const nail = kit.edges(kit.solid(new CylinderGeometry(.013,.013,.025,16)), .65)
    nail.name = 'frame-wall-nail'; nail.rotation.x = Math.PI / 2
    nail.position.set(0,1.125,-.04); root.add(nail)
  }
  let lease: ReturnType<typeof acquirePictureTexture> | undefined
  let pending: ReturnType<typeof acquirePictureTexture> | undefined
  let source = ''
  let aspect = 1
  let disposed = false
  let angle = settings.open ? 1.18 : 0
  const updateUv = () => {
    const targetAspect = settings.width / settings.height
    let sx = 1, sy = 1
    if ((settings.fit === 'cover') === (aspect > targetAspect)) sx = targetAspect / aspect
    else sy = aspect / targetAspect
    sx /= settings.zoom; sy /= settings.zoom
    imageMaterial.uniforms.uvScale.value.set(sx, sy)
    imageMaterial.uniforms.uvOffset.value.set((1 - sx) * settings.panX, (1 - sy) * (1 - settings.panY))
  }
  const setPicture = (next: PictureSettings) => {
    settings = next
    updateUv()
    if (source === next.source) return
    source = next.source
    pending?.release()
    const candidate = acquirePictureTexture(source)
    pending = candidate
    options.onPictureStatus?.('loading')
    void candidate.ready.then(texture => {
      if (disposed || pending !== candidate) return
      lease?.release(); lease = candidate; pending = undefined
      const image = texture.image as HTMLImageElement
      aspect = image.width / image.height
      imageMaterial.uniforms.picture.value = texture
      imageMaterial.uniforms.ready.value = 1
      updateUv()
      options.onPictureStatus?.('ready')
      options.invalidate?.()
    }).catch(() => {
      if (disposed || pending !== candidate) return
      candidate.release(); pending = undefined
      options.onPictureStatus?.('error')
      options.invalidate?.()
    })
  }
  setPicture(settings)
  return {
    root,
    setPicture,
    click() {
      if (kind !== 'window') return
      settings = { ...settings, open: !settings.open }
      options.onPicture?.({ open: settings.open })
    },
    frame({ dt, still }) {
      const target = settings.open ? 1.18 : 0
      angle += (target - angle) * (still || dt === 0 ? 1 : 1 - Math.exp(-dt * 9))
      leaves.forEach((leaf, i) => { leaf.rotation.y = i === 0 ? -angle : angle })
      glassMaterials.forEach(material => { material.opacity = 0.08 + 0.04 * Math.cos(angle) })
    },
    dispose() {
      disposed = true
      lease?.release(); pending?.release()
    },
  }
}
export const buildWindow = (options: PropOptions) => buildPicture('window', options)
export const buildFrame = (options: PropOptions) => buildPicture('frame', options)
export const picturePropBuilders = { window: buildWindow, frame: buildFrame }
