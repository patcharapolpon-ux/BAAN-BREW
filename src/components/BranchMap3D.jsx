import Papa from 'papaparse'
import { useEffect, useRef, useState } from 'react'
import { formatBaht, formatBahtCompact, formatPercent } from '../lib/metrics'
import { useReducedMotion } from '../lib/motion'

// React side of the 3D map: loads branch coordinates, lazy-loads three.js (lib/map3d.js) the
// first time the panel is on screen, and draws the hover tooltip as normal HTML.
// The scene itself lives outside React; we only call update() when colors or the filter change.
function BranchMap3D({ branches, colors, selected, onSelect, show }) {
  const box = useRef(null)
  const map = useRef(null)
  const [coords, setCoords] = useState(null)
  const [tip, setTip] = useState(null)
  const [failed, setFailed] = useState(false)
  const [built, setBuilt] = useState(false)
  const reduced = useReducedMotion()
  // Latest values for the scene's callbacks, so the scene isn't rebuilt when they change.
  const latest = useRef({ onSelect, selected })
  latest.current = { onSelect, selected }

  useEffect(() => {
    Papa.parse('/branches.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (r) => setCoords(Object.fromEntries(r.data.map((b) => [b.branch, { lat: Number(b.lat), lng: Number(b.lng) }]))),
      error: () => setFailed(true),
    })
  }, [])

  // Build once: when the panel is visible and both data sets are in.
  const ready = show && coords && branches.length > 0
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const placed = branches.filter((b) => coords[b.branch]).map((b) => ({ ...b, ...coords[b.branch] }))
    import('../lib/map3d')
      .then(({ createBranchMap }) => {
        if (cancelled || !box.current) return
        map.current = createBranchMap(box.current, {
          branches: placed,
          colors,
          reduced,
          formatValue: formatBahtCompact,
          onHover: setTip,
          onSelect: (b) => latest.current.onSelect(latest.current.selected === b ? null : b),
        })
        map.current.update({ selected: latest.current.selected })
        map.current.grow()
        setBuilt(true)
      })
      .catch(() => setFailed(true)) // e.g. WebGL turned off
    return () => {
      cancelled = true
      map.current?.dispose()
      map.current = null
      setBuilt(false)
    }
    // colors/selected are pushed in by the effects below, not by rebuilding the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, branches, coords, reduced])

  useEffect(() => map.current?.update({ colors }), [colors])
  useEffect(() => map.current?.update({ selected }), [selected])

  if (failed) return <p className="text-sm text-muted">เบราว์เซอร์นี้แสดงภาพ 3D ไม่ได้ (WebGL ถูกปิดอยู่)</p>

  return (
    <div className="map3d relative h-[360px] overflow-hidden rounded-xl sm:h-[460px]" ref={box}>
      {!built && <div className="skeleton absolute inset-0 rounded-xl" aria-hidden="true" />}
      {tip && (
        <div
          className="map3d-tip pointer-events-none absolute z-10 rounded-xl border border-line bg-surface/95 px-3 py-2 text-sm shadow-card backdrop-blur-sm"
          style={{ left: Math.min(tip.x + 14, (box.current?.clientWidth ?? 300) - 170), top: Math.max(8, tip.y - 70) }}
        >
          <p className="font-medium text-ink">สาขา{tip.branch}</p>
          <p className="text-accent tabular-nums">{formatBaht(tip.sales)}</p>
          <p className="text-xs text-muted">{formatPercent(tip.share, 1)} ของยอดทุกสาขา · คลิกเพื่อกรอง</p>
        </div>
      )}
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted">
        ลากเพื่อหมุน · แม่น้ำเจ้าพระยาวาดโดยประมาณ
      </p>
    </div>
  )
}

export default BranchMap3D
