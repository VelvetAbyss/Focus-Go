// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Mesh, ShaderMaterial, Texture, TextureLoader, Vector3 } from 'three'
import { createKit } from '../kit'
import { defaultPicture } from '../../pictureTypes'
import { buildFrame, buildWindow } from './pictureProps'

afterEach(() => vi.restoreAllMocks())
const kitForTest = () => createKit({ width: 800, height: 400, unit: 60, colors: {
  paper: [1,1,1], ink: [.2,.2,.2], ink3: [.4,.4,.4], ink4: [.6,.6,.6], pencil: [.5,.5,.5], pen: [.1,.3,.2], dark: false,
} })
const env = { t: 0, dt: 1 / 60, now: 0, still: false, hovered: false, light: 0, bulb: new Vector3(), keys: 0 }
describe('casement and picture geometry', () => {
  it('rotates each sash around its outer hinge without moving the view; reduced motion closes immediately', async () => {
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(new Texture({ width: 1600, height: 900 } as HTMLImageElement))
    const kit = kitForTest(), onPicture = vi.fn()
    const prop = buildWindow({ kit, timer: { get: () => null, set: () => {} }, onPicture })
    await Promise.resolve()
    const left = prop.root.getObjectByName('window-left-leaf')!
    const right = prop.root.getObjectByName('window-right-leaf')!
    const photo = prop.root.getObjectByName('picture-surface')!
    const anchors = [left.position.clone(), right.position.clone(), photo.position.clone()]
    prop.click()
    expect(onPicture).toHaveBeenLastCalledWith({ open: true })
    for(let i=0;i<60;i++) prop.frame(env)
    expect(left.rotation.y).toBeCloseTo(-1.18, 2)
    expect(right.rotation.y).toBeCloseTo(1.18, 2)
    const tipL = left.localToWorld(new Vector3(.465, .4, 0))
    const tipR = right.localToWorld(new Vector3(-.465, .4, 0))
    expect(tipL.x).toBeLessThan(-.25)
    expect(tipR.x).toBeGreaterThan(.25)
    expect(tipL.z).toBeGreaterThan(.4)
    expect(tipR.z).toBeCloseTo(tipL.z)
    expect([left.position, right.position, photo.position]).toEqual(anchors)
    prop.click(); prop.frame({ ...env, still: true })
    expect(left.rotation.y).toBeCloseTo(0)
    expect(right.rotation.y).toBeCloseTo(0)
    prop.dispose?.(); kit.release(prop.root)
  })
  it('keeps portrait artwork undistorted when fitting or cropping a landscape frame', async () => {
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(new Texture({ width: 1000, height: 2000 } as HTMLImageElement))
    const kit=kitForTest()
    const picture = { ...defaultPicture('frame'), width: 2, height: 1 }
    const ready=vi.fn()
    const prop=buildFrame({kit,timer:{get:()=>null,set:()=>{}},picture,onPictureStatus:ready})
    expect(prop.root.getObjectByName('frame-back-stand')).toBeUndefined()
    expect(prop.root.getObjectByName('frame-foot')).toBeUndefined()
    expect(prop.root.getObjectByName('frame-wall-nail')!.position.y).toBeGreaterThan(1)
    await vi.waitFor(()=>expect(ready).toHaveBeenCalledWith('ready'))
    const material=(prop.root.getObjectByName('picture-surface') as Mesh).material as ShaderMaterial
    expect(material.uniforms.uvScale.value.toArray()).toEqual([4,1])
    prop.setPicture?.({...picture,fit:'cover',panY:0})
    expect(material.uniforms.uvScale.value.toArray()).toEqual([1,.25])
    expect(material.uniforms.uvOffset.value.y).toBe(.75)
    prop.dispose?.(); kit.release(prop.root)
  })
})
