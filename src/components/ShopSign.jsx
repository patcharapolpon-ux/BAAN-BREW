// Little wooden "open / closed" sign hanging next to the shop name. Opening hours come from
// the data itself: the first and last hour that ever had a sale (the heatmap's hour range).
// It swings in on load and swings again on hover.
import { emitEgg, rapidClicks } from '../lib/eggs'

const pad = (h) => `${String(h).padStart(2, '0')}:00`
// Easter egg: poke the sign 7 times in 3 seconds and the lights go out.
const poke = rapidClicks(7, 3000, () => emitEgg('lights'))

function ShopSign({ hour, hours }) {
  if (!hours?.length) return null
  const openAt = hours[0]
  const closeAt = hours.at(-1) + 1
  const open = hour >= openAt && hour < closeAt
  const text = open ? `เปิดอยู่ · ถึง ${pad(closeAt)}` : `ปิดแล้ว · เปิด ${pad(openAt)}`
  return (
    <span className="shop-sign relative ml-2 inline-flex shrink-0 align-middle" title={text} onClick={poke}>
      <span
        className={`shop-sign-board inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-sans text-[10px] leading-none font-semibold tracking-wide sm:text-xs ${
          open ? 'border-emerald-600/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'border-line bg-surface-2 text-muted'
        }`}
      >
        <span className={`size-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-muted'}`} aria-hidden="true" />
        {/* phones: just the colored dot, so the shop name stays on one line */}
        <span className="hidden sm:inline">{open ? 'OPEN' : 'CLOSED'}</span>
      </span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

export default ShopSign
