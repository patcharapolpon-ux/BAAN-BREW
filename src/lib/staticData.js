import Papa from 'papaparse'
import { useEffect, useState } from 'react'

// Small files in public/ that several panels need. Each is downloaded once per visit and shared
// (the promise is cached), however many components ask for it.

const cache = new Map()

function load(key, fetcher) {
  if (!cache.has(key)) cache.set(key, fetcher().catch((e) => (cache.delete(key), Promise.reject(e))))
  return cache.get(key)
}

const csv = (url) => () =>
  new Promise((resolve, reject) =>
    Papa.parse(url, { download: true, header: true, skipEmptyLines: true, complete: (r) => resolve(r.data), error: reject }),
  )

export const loadProducts = () => load('products', csv('/products.csv'))
export const loadBranches = () => load('branches', csv('/branches.csv'))
/** public/lottery.json from `npm run lottery`: { source, fetched, draws: [{ date, first, last2, last3f, last3b, near1 }] }. */
export const loadLottery = () => load('lottery', () => fetch('/lottery.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))))

/** React hook: the loaded value, or null while loading (or if it failed). */
export function useStatic(loader) {
  const [value, setValue] = useState(null)
  useEffect(() => {
    let alive = true
    loader()
      .then((v) => alive && setValue(v))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [loader])
  return value
}
