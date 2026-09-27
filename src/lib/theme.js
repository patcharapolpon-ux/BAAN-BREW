import { useCallback, useEffect, useMemo, useState } from 'react'

// Theme preference: 'light' | 'dark' | 'system'. The resolved theme lives on <html data-theme>,
// which index.css keys every color token off. index.html sets it before first paint.

const STORAGE_KEY = 'baanbrew-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

function resolve(preference) {
  return preference === 'system' ? (media.matches ? 'dark' : 'light') : preference
}

// Applied synchronously so chart colors read in the same render already see the new theme.
function apply(preference) {
  const resolved = resolve(preference)
  document.documentElement.dataset.theme = resolved
  return resolved
}

export function useTheme() {
  const [preference, setPreferenceState] = useState(readPreference)
  const [resolved, setResolved] = useState(() => apply(preference))

  const setPreference = useCallback((next) => {
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable (private mode) — the choice just won't persist
    }
    setResolved(apply(next))
    setPreferenceState(next)
  }, [])

  // While following the system, track OS light/dark changes live.
  useEffect(() => {
    if (preference !== 'system') return
    const onChange = () => setResolved(apply('system'))
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  return { preference, resolved, setPreference }
}

/** Chart colors from the CSS tokens, re-read whenever the resolved theme changes. */
export function useChartColors(resolved) {
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    const token = (name) => css.getPropertyValue(`--${name}`).trim()
    return {
      accent: token('accent'),
      accentSoft: token('accent-soft'),
      grid: token('grid'),
      line: token('line'),
      ink: token('ink'),
      ink2: token('ink-2'),
      muted: token('muted'),
      surface: token('surface'),
      surface2: token('surface-2'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved])
}
