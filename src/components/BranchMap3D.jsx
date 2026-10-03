import Papa from 'papaparse'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fireConfetti } from '../lib/confetti'
import { branchRace, formatBaht, formatBahtCompact, formatPercent, formatThaiDate } from '../lib/metrics'
import { useReducedMotion } from '../lib/motion'
import { playSound } from '../lib/sound'
import { showToast } from '../lib/toast'

// React side of the 3D map: loads branch coordinates, lazy-loads three.js (lib/map3d.js) the
// first time the panel is on screen, and draws the hover tooltip and time controls as HTML.
// The scene itself lives outside React; we only call its methods when something changes.

const SPEEDS = [12, 36] // days per second: the whole history in ~45 s, or ~15 s
const SKY_SECONDS = 8 // one sunrise-to-night cycle every 8 s while replaying

function BranchMap3D({ rows, branches, colors, selected, onSelect, show }) {
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

  // Time machine state: null = showing today's totals.
  const [time, setTime] = useState(null) // { day, playing, speed }
  const race = useMemo(() => (time && rows ? branchRace(rows) : null), [time !== null, rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const pos = useRef(0)
  const sky = useRef(0.25)

  useEffect(() => {
    Papa.parse('/branches.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (r) => setCoords(Object.fromEntries(r.data.map((b) => [b.branch, { lat: Number(b.lat), lng: Number(b.lng) }]))),
      error: () => setFailed(true),
    })
  }, [])

  const placed = useMemo(
    () => (coords ? branches.filter((b) => coords[b.branch]).map((b) => ({ ...b, ...coords[b.branch] })) : []),
    [branches, coords],
  )

  // Build once: when the panel is visible and both data sets are in.
  const ready = show && placed.length > 0
  useEffect(() => {
    if (!ready) return
    let cancelled = false
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
          onOpen: (b) => {
            playSound('fanfare')
            fireConfetti()
            showToast({ icon: '🎉', title: `สาขา${b} เปิดแล้ว!`, text: 'แก้วใหม่โผล่ขึ้นมาบนแผนที่' })
          },
          onEgg: () => {
            playSound('secret')
            showToast({ icon: '⛵', title: 'เรือกาแฟออกเดินทาง!', text: 'ล่องเจ้าพระยาไปส่งลาเต้ (ความลับนะ)' })
          },
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
  }, [ready, placed, reduced])

  useEffect(() => map.current?.update({ colors }), [colors])
  useEffect(() => map.current?.update({ selected }), [selected])

  // Cumulative sales of each placed branch on frame `day` (the race lists branches in its own order).
  const valuesAt = (day) => {
    const frame = race.frames[day]
    return placed.map((b) => frame.byBranch[race.branches.indexOf(b.branch)] ?? 0)
  }

  // Replay clock. React only re-renders when the day number changes; the sky moves every frame.
  useEffect(() => {
    if (!time || !race || !built) return
    if (!time.playing) {
      map.current?.setTime({ values: valuesAt(time.day), sky: sky.current })
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.max(0, now - last) / 1000
      last = now
      pos.current = Math.min(race.frames.length - 1, pos.current + dt * time.speed)
      if (!reduced) sky.current = (sky.current + dt / SKY_SECONDS) % 1
      const day = Math.floor(pos.current)
      map.current?.setTime({ values: valuesAt(day), sky: sky.current })
      if (day !== time.day) setTime((t) => t && { ...t, day, playing: day < race.frames.length - 1 })
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, race, built])

  const start = () => {
    pos.current = 0
    sky.current = 0.2
    setTime({ day: 0, playing: true, speed: SPEEDS[0] })
  }
  const stop = () => {
    setTime(null)
    map.current?.setTime({ values: null, sky: null })
  }
  const scrub = (day) => {
    pos.current = day
    setTime((t) => ({ ...t, day, playing: false }))
  }

  if (failed) return <p className="text-sm text-muted">เบราว์เซอร์นี้แสดงภาพ 3D ไม่ได้ (WebGL ถูกปิดอยู่)</p>

  const frame = race?.frames[time?.day ?? 0]
  const lastDay = (race?.frames.length ?? 1) - 1

  return (
    <>
      <div className="map3d relative h-[360px] overflow-hidden rounded-xl sm:h-[460px]" ref={box}>
        {!built && <div className="skeleton absolute inset-0 rounded-xl" aria-hidden="true" />}
        {time && frame && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-xl bg-black/45 px-3 py-2 text-white backdrop-blur-sm">
            <p className="text-lg font-medium tabular-nums sm:text-2xl">
              {formatThaiDate(frame.date, { day: 'numeric', month: 'short', year: '2-digit' })}
            </p>
            <p className="text-xs opacity-80 sm:text-sm">ยอดสะสม {formatBaht(frame.sales)}</p>
          </div>
        )}
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
        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted">ลากเพื่อหมุน · แม่น้ำเจ้าพระยาวาดโดยประมาณ</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
        {!time ? (
          <button type="button" data-sound="whoosh" onClick={start} disabled={!built || !rows} className="toy-btn">
            ⏳ ย้อนเวลาดูร้านโต
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                if (time.day >= lastDay) pos.current = 0
                setTime((t) => ({ ...t, day: t.day >= lastDay ? 0 : t.day, playing: !t.playing }))
              }}
              className="toy-btn w-24"
            >
              {time.playing ? '⏸ หยุด' : time.day >= lastDay ? '↺ อีกรอบ' : '▶ เล่น'}
            </button>
            <input
              type="range"
              min={0}
              max={lastDay}
              value={time.day}
              onChange={(e) => scrub(Number(e.target.value))}
              aria-label="เลื่อนวันที่"
              className="min-w-40 flex-1 accent-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setTime((t) => ({ ...t, speed: t.speed === SPEEDS[0] ? SPEEDS[1] : SPEEDS[0] }))}
              className="toy-btn w-14"
              aria-label="ความเร็ว"
            >
              {time.speed === SPEEDS[0] ? '1×' : '3×'}
            </button>
            <button type="button" onClick={stop} className="toy-btn">
              ✕ กลับปัจจุบัน
            </button>
          </>
        )}
      </div>
    </>
  )
}

export default BranchMap3D
