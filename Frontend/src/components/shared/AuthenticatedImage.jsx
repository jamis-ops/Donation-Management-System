import { useEffect, useState } from 'react'
import { apiFetchBlob } from '../../api/resources'

/**
 * Renders an image from a protected API route. Native <img src> requests do
 * not include the bearer token used by the portals, so fetch the bytes through
 * the authenticated API client and render a short-lived local object URL.
 */
export default function AuthenticatedImage({ src, alt = '', fallback = null, ...props }) {
  const [result, setResult] = useState({ src: '', objectUrl: '', failed: false })

  useEffect(() => {
    let active = true
    let localUrl = ''
    if (!src) return () => {}

    apiFetchBlob(src)
      .then((blob) => {
        if (!active) return
        if (!blob.type.startsWith('image/')) throw new Error('The proof response is not an image.')
        localUrl = URL.createObjectURL(blob)
        setResult({ src, objectUrl: localUrl, failed: false })
      })
      .catch(() => {
        if (!active) return
        setResult({ src, objectUrl: '', failed: true })
      })

    return () => {
      active = false
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [src])

  if (result.src !== src || result.failed || !result.objectUrl) return fallback
  return <img {...props} src={result.objectUrl} alt={alt} />
}
