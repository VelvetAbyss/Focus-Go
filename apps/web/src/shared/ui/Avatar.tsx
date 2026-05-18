import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { acquireAvatarUrl, releaseAvatarUrl } from '../avatars/avatarStorage'
import { generateDicebearAvatar, initialsFromName } from '../avatars/dicebearAvatar'

type AvatarProps = {
  /** Display name — used to derive initials text for the DiceBear fallback. */
  name?: string
  /** Optional uploaded image hash (in syncBlobCache). Takes precedence over DiceBear. */
  blobHash?: string | null
  /** Optional override seed for DiceBear (defaults to entity name). */
  seed?: string
  /** Pixel size of the avatar. */
  size?: number
  /** Round shape (default) or rounded-square. */
  shape?: 'circle' | 'rounded'
  className?: string
  /** Optional aria-label override. */
  alt?: string
}

const Avatar = ({
  name,
  blobHash,
  seed,
  size = 40,
  shape = 'circle',
  className,
  alt,
}: AvatarProps) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const initialsText = useMemo(() => initialsFromName(name), [name])
  const fallbackSrc = useMemo(
    () => generateDicebearAvatar({ seed: seed || name || '?', initialsText }),
    [initialsText, name, seed],
  )

  useEffect(() => {
    let cancelled = false
    if (!blobHash) {
      setResolvedUrl(null)
      return
    }
    void acquireAvatarUrl(blobHash).then((url) => {
      if (cancelled) {
        if (url) releaseAvatarUrl(blobHash)
      } else {
        setResolvedUrl(url)
      }
    })
    return () => {
      cancelled = true
      if (blobHash) releaseAvatarUrl(blobHash)
    }
  }, [blobHash])

  const src = resolvedUrl ?? fallbackSrc
  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-[8px]'

  return (
    <img
      src={src}
      alt={alt ?? name ?? 'Avatar'}
      width={size}
      height={size}
      className={cn(
        'shrink-0 select-none bg-[color:var(--bg-muted)] object-cover',
        radiusClass,
        className,
      )}
      style={{ width: size, height: size }}
      draggable={false}
    />
  )
}

export default Avatar
