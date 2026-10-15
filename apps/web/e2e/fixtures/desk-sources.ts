import { AmbientLight, AnimationMixer, Box3, Color, DirectionalLight, Group, Mesh, MeshBasicMaterial, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createKit } from '../../src/features/dashboard/desk/three/kit'
const canvas = document.querySelector('canvas')!
const renderer = new WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2))
renderer.setSize(innerWidth,innerHeight)
const scene = new Scene()
scene.background = new Color('#f5f3ee')
scene.add(new AmbientLight('white',2))
const light = new DirectionalLight('white',3)
light.position.set(3,5,4)
scene.add(light)
const camera = new OrthographicCamera(-1.5*innerWidth/innerHeight,1.5*innerWidth/innerHeight,1.5,-1.5,.01,100)
camera.position.set(3,2,5)
const controls = new OrbitControls(camera,canvas)
controls.target.set(0,.8,0)
controls.update()
const urls: Record<string, string> = {
  'laptop.glb': new URL('../../src/features/dashboard/desk/assets/laptop.glb', import.meta.url).href,
  'typewriter.glb': new URL('../../src/features/dashboard/desk/assets/typewriter.glb', import.meta.url).href,
  'candle.glb': new URL('../../src/features/dashboard/desk/assets/candle.glb', import.meta.url).href,
}
const assets = Object.keys(urls)
const select = document.querySelector<HTMLSelectElement>('#asset')!
select.innerHTML=assets.map(a=>`<option>${a}</option>`).join('')
let object: Group | null=null, mixer: AnimationMixer|null=null, last=0, playing=true, ink=false
const originals = new Map<Mesh,Mesh['material']>()
const white = new MeshBasicMaterial({color:'#f5f3ee'})
const kit = createKit({width:innerWidth,height:innerHeight,unit:200,colors:{paper:[.96,.95,.93],ink:[.23,.22,.20],ink3:[.45,.43,.40],ink4:[.65,.62,.60],pencil:[.6,.58,.55],pen:[.1,.3,.28],dark:false}})
const load = async (file:string) => {
 select.value = file
 const gltf = await new GLTFLoader().loadAsync(urls[file] ?? urls[assets[0]])
 if(object)scene.remove(object)
 originals.clear()
 object = new Group()
 object.add(gltf.scene)
 scene.add(object)
 const box = new Box3().setFromObject(object), size = box.getSize(new Vector3()), center = box.getCenter(new Vector3())
 const scale = 1.8 / Math.max(size.x,size.y,size.z)
 gltf.scene.position.set(-center.x,-box.min.y,-center.z)
 object.scale.setScalar(scale)
 mixer = new AnimationMixer(gltf.scene)
 for(const clip of gltf.animations)mixer.clipAction(clip).play()
 const meshes: Mesh[]=[]
 gltf.scene.traverse(o=>{if(o instanceof Mesh)meshes.push(o)})
 meshes.forEach(o=>{originals.set(o,o.material);kit.hull(o,1.1);o.children.filter(c=>c.userData.outline).forEach(c=>c.visible=ink);if(ink)o.material=white})
 document.querySelector('#info')!.textContent=file+'\n'+JSON.stringify({dimensions:size.toArray(),animations:gltf.animations.map(a=>a.name),meshes:originals.size})
 Object.assign(window,{sourceAudit:{gltf,object,mixer,camera,renderer,scene}})
}
select.onchange=()=>void load(select.value)
document.querySelector<HTMLButtonElement>('#ink')!.onclick=()=>{ink=!ink;originals.forEach((mat,mesh)=>{mesh.material=ink?white:mat;mesh.children.filter(c=>c.userData.outline).forEach(c=>c.visible=ink)})}
document.querySelector<HTMLButtonElement>('#side')!.onclick=()=>{camera.position.set(0,.8,5);controls.target.set(0,.8,0);controls.update()}
document.querySelector<HTMLButtonElement>('#play')!.onclick=()=>{playing=!playing}
void load(new URLSearchParams(location.search).get('asset')??assets[0])
function frame(t:number){const dt=last?Math.min((t-last)/1000,.05):0;last=t;if(playing)mixer?.update(dt);renderer.render(scene,camera);requestAnimationFrame(frame)}
requestAnimationFrame(frame)
