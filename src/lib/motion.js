import { useEffect, useRef, useState } from 'react'

// Small motion toolkit. Every hook here checks prefers-reduced-motion and, when it's on,
// jumps straight to the final state — motion is decoration, the data must never wait for it.

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

export function prefersReducedMotion() {
  return reduceQuery.matches
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(reduceQuery.matches)
  useEffect(() => {
    const onChange = (e) => setReduced(e.matches)
    reduceQuery.addEventListener('change', onChange)
    return () => reduceQuery.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// easeOutExpo: fast start, long soft landing — feels like a number "settling".
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t))

/**
 * Animate a number toward `target` over `duration` ms using requestAnimationFrame.
 * The first run counts up from 0 (after `delay`); later changes (e.g. picking a branch)
 * glide from whatever is on screen right now to the new target — even mid-animation.
 * Returns the in-between number; format it yourself (formatBaht etc.).
 */
export function useCountUp(target, { duration = 1400, delay = 0 } = {}) {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(reduced ? target : 0)
  const current = useRef(value) // latest on-screen value, read when a new target arrives
  const firstRun = useRef(true)

  useEffect(() => {
    if (reduced) return
    const from = current.current
    const wait = firstRun.current ? delay : 0
    firstRun.current = false
    let frame
    let start
    const tick = (now) => {
      start ??= now + wait
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      current.current = from + (target - from) * easeOutExpo(t)
      setValue(current.current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, delay, reduced])

  return reduced ? target : value
}

/**
 * True once the element has scrolled into view (then stays true).
 * Used to start entrance animations only when the reader actually gets there.
 */
export function useInView({ threshold = 0.15 } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, inView]
}

/**
 * Mouse-follow tilt + spotlight. Writes CSS variables on the element instead of React state,
 * so moving the mouse never re-renders the component (60fps, zero React work).
 *   --mx / --my  pointer position in px (for the radial spotlight)
 *   --rx / --ry  rotation in deg (for the 3D tilt)
 */
export function useTilt({ max = 6 } = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    // Only for real mice: on touch screens hover/tilt would "stick" after a tap.
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const onMove = (e) => {
      if (reduceQuery.matches) return
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      el.style.setProperty('--mx', `${x}px`)
      el.style.setProperty('--my', `${y}px`)
      el.style.setProperty('--ry', `${(x / r.width - 0.5) * max * 2}deg`)
      el.style.setProperty('--rx', `${(0.5 - y / r.height) * max * 2}deg`)
    }
    const onLeave = () => {
      el.style.setProperty('--rx', '0deg')
      el.style.setProperty('--ry', '0deg')
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [max])

  return ref
}

/**
 * True once the page is scrolled past `offset` px. Only re-renders when the answer flips,
 * not on every scroll event — so a big component can use it cheaply.
 */
export function useScrolled(offset = 12) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > offset)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset) // same value → React skips the render
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])
  return scrolled
}

/** 0–1 how far the page is scrolled, for the reading-progress bar. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let frame
    const update = () => {
      frame = null
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? window.scrollY / max : 0)
    }
    // Throttle to one update per animation frame — scroll events can fire far more often.
    const onScroll = () => {
      frame ??= requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return progress
}
