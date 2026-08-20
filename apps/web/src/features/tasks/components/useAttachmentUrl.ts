import { useEffect, useState } from 'react'
import { acquireAttachmentUrl, releaseAttachmentUrl } from '../application/taskAttachments'

export const useAttachmentUrl = (hash: string | undefined | null): string | null => {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!hash) {
      setUrl(null)
      return
    }
    let active = true
    void acquireAttachmentUrl(hash).then((next) => {
      if (active) setUrl(next)
      else if (next) releaseAttachmentUrl(hash)
    })
    return () => {
      active = false
      releaseAttachmentUrl(hash)
    }
  }, [hash])

  return url
}
