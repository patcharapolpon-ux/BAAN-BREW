import { useEffect, useState } from 'react'

// True below Tailwind's `sm` breakpoint (640px). For chart props that CSS classes can't reach.
const QUERY = '(max-width: 639px)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const onChange = (e) => setIsMobile(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
