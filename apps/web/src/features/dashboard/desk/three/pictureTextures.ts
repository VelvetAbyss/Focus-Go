import { SRGBColorSpace, Texture, TextureLoader } from 'three'
import { PICTURE_PRESETS } from '../pictureCatalog'
import { readPictureMedia } from '../pictureMedia'

type Cached = { refs: number; promise: Promise<Texture>; texture?: Texture }
const cache = new Map<string, Cached>()
export const acquirePictureTexture = (source: string) => {
  let entry = cache.get(source)
  if (!entry) {
    const current: Cached = { refs: 0, promise: Promise.resolve(null as unknown as Texture) }
    current.promise = (async () => {
      let url: string | undefined, revoke = false
      if (source.startsWith('local:')) {
        const media = await readPictureMedia(source.slice(6))
        if (!media) throw new Error('missing-image')
        url = URL.createObjectURL(media.blob); revoke = true
      } else url = PICTURE_PRESETS.find(p => p.id === source)?.url
      if (!url) throw new Error('missing-image')
      try {
        const texture = await new TextureLoader().loadAsync(url)
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = 4
        current.texture = texture
        if (current.refs === 0) texture.dispose()
        return texture
      } finally { if (revoke) URL.revokeObjectURL(url) }
    })()
    entry = current
    cache.set(source, entry)
  }
  entry.refs++
  let released = false
  return {
    ready: entry.promise,
    release: () => {
      if (released) return
      released = true
      if (--entry.refs === 0) {
        entry.texture?.dispose()
        if (cache.get(source) === entry) cache.delete(source)
      }
    },
  }
}
