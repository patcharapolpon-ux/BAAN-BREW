// Shared cursors: everyone signed in on the play tab sees each other's pointer as a little pug.
//
// How it stays cheap (Firestore bills per document write/read, even on the free quota):
// - One document per person (presence/{uid}), overwritten in place, never a new doc per move.
// - Pointer moves only update a ref; a timer writes at most once every CURSOR_EVERY_MS, and
//   only if the pointer actually moved. Standing still costs one heartbeat every 15 s.
// - After CURSOR_CAP writes in one visit, sharing switches itself off.
// - Leaving the tab deletes your doc, so nobody keeps "seeing" you.
import { useEffect, useRef, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lab3/firebase.js'
import { PugSvg } from '../components/ShopDog'
import { playSound } from '../lib/sound'
import { showToast } from '../lib/toast'
import { activePeers, CURSOR_CAP, CURSOR_EVERY_MS } from './playModel.js'

const HEARTBEAT_MS = 15000
const BARK_SHOW_MS = 1400

// Same uid → same color on every screen.
function colorOf(uid) {
  let h = 0
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 75% 55%)`
}

/**
 * Writes my cursor (when `sharing`) and returns { peers, bark }.
 * `area` is the element the coordinates are relative to: x as a fraction of its width (so it
 * maps across different screen widths), y in px from its top.
 */
export function usePresence({ user, area, sharing, onCapReached }) {
  const [peers, setPeers] = useState([])
  const [now, setNow] = useState(() => Date.now())
  const pos = useRef(null) // latest pointer position, not yet written
  const barks = useRef(0)
  const writes = useRef(0)
  const writeNow = useRef(null) // re-sends my doc right away (used by bark)

  // Everyone's cursor docs. The collection only ever holds one small doc per person.
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'presence'),
        (snap) =>
          setPeers(
            snap.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' })
              return { uid: d.id, ...data, updatedAt: data.updated_at?.toMillis() ?? null }
            }),
          ),
        () => setPeers([]), // no access (rules not deployed yet) → just show nobody, the shop still works
      ),
    [],
  )

  // Re-check "who's still here" every few seconds even if nothing new arrives.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!sharing) return
    const me = doc(db, 'presence', user.uid)
    const write = (x, y) => {
      if (writes.current >= CURSOR_CAP) {
        onCapReached()
        return
      }
      writes.current++
      setDoc(me, {
        name: (user.displayName || user.email).split(' ')[0],
        photo: user.photoURL ?? null,
        x,
        y,
        barks: barks.current,
        updated_at: serverTimestamp(),
      }).catch(() => {})
    }
    let last = { x: 0.5, y: 120 }
    write(last.x, last.y)

    const onMove = (e) => {
      const r = area.current?.getBoundingClientRect()
      if (!r || r.width === 0) return
      pos.current = { x: (e.clientX - r.left) / r.width, y: e.clientY - r.top }
    }
    const flush = setInterval(() => {
      if (!pos.current || document.hidden) return
      last = pos.current
      pos.current = null
      write(last.x, last.y)
    }, CURSOR_EVERY_MS)
    const heartbeat = setInterval(() => !document.hidden && write(last.x, last.y), HEARTBEAT_MS)
    const leave = () => deleteDoc(me).catch(() => {})

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pagehide', leave)
    writeNow.current = () => write(last.x, last.y)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pagehide', leave)
      clearInterval(flush)
      clearInterval(heartbeat)
      writeNow.current = null
      leave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, user.uid])

  const bark = () => {
    playSound('woof')
    barks.current++
    writeNow.current?.()
  }

  return { peers: activePeers(peers, { now, selfUid: user.uid }), bark }
}

/** Draws the other people's cursors inside the (position: relative) play area. */
export function CursorLayer({ peers }) {
  const seenBarks = useRef(new Map())
  const [barking, setBarking] = useState(() => new Set())

  // A peer's bark counter went up → show "โฮ่ง!" above their cursor and play the bark here too.
  useEffect(() => {
    for (const p of peers) {
      const before = seenBarks.current.get(p.uid)
      seenBarks.current.set(p.uid, p.barks)
      if (before === undefined || p.barks <= before) continue
      playSound('woof')
      setBarking((s) => new Set(s).add(p.uid))
      setTimeout(
        () =>
          setBarking((s) => {
            const next = new Set(s)
            next.delete(p.uid)
            return next
          }),
        BARK_SHOW_MS,
      )
    }
  }, [peers])

  // Toast when someone new shows up.
  const known = useRef(null)
  useEffect(() => {
    const ids = new Set(peers.map((p) => p.uid))
    if (known.current) {
      for (const p of peers) if (!known.current.has(p.uid)) showToast({ icon: '🐾', title: `${p.name} เข้ามาในร้าน`, text: 'ขยับเมาส์ทักทายกันได้เลย' })
    }
    known.current = ids
  }, [peers])

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {peers.map((p) => (
        <div
          key={p.uid}
          className="peer-cursor absolute top-0 left-0"
          style={{ left: `${Math.min(97, Math.max(0, p.x * 100))}%`, top: Math.max(0, p.y), '--peer': colorOf(p.uid) }}
        >
          <svg viewBox="0 0 16 16" className="size-5 drop-shadow" style={{ color: colorOf(p.uid) }}>
            <path d="M1 1l5.5 13.5 2-5.5 5.5-2z" fill="currentColor" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <div className="peer-tag ml-3 -mt-1 flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-medium whitespace-nowrap text-white shadow-card">
            {p.photo ? (
              <img src={p.photo} alt="" referrerPolicy="no-referrer" className="size-5 rounded-full" />
            ) : (
              <span className="scale-[0.4] -my-3 -mx-4 inline-block origin-center">
                <PugSvg />
              </span>
            )}
            {p.name}
          </div>
          {barking.has(p.uid) && <span className="peer-bark absolute -top-7 left-4 rounded-xl bg-surface px-2 py-0.5 text-sm font-semibold text-ink shadow-card">โฮ่ง! 🐶</span>}
        </div>
      ))}
    </div>
  )
}
