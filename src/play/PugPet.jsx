// The shop pug as a Tamagotchi: it gets hungrier every second, and every order (yours, the
// bot's, or someone else's on another screen) feeds it. Starve it and it sulks with its back to you.
import { useEffect, useRef, useState } from 'react'
import { PugSvg } from '../components/ShopDog'
import { playSound } from '../lib/sound'
import { feed, HUNGER_START, hungerAfter, pugLevel, pugMood } from './playModel.js'

const EAT_MS = 700

// `meal` = { n, revenue }: n goes up by one each time new orders arrive.
function PugPet({ meal, todayRevenue }) {
  const [hunger, setHunger] = useState(HUNGER_START)
  const [eating, setEating] = useState(false)
  const [snacks, setSnacks] = useState([])
  const [hearts, setHearts] = useState([])
  const mood = pugMood(hunger)
  const level = pugLevel(todayRevenue)
  const lastMood = useRef(mood.key)

  // Hunger ticks down once a second.
  useEffect(() => {
    const t = setInterval(() => setHunger((h) => hungerAfter(h, 1)), 1000)
    return () => clearInterval(t)
  }, [])

  // New orders → eat.
  useEffect(() => {
    if (!meal.n) return
    setHunger((h) => feed(h, meal.revenue))
    setEating(true)
    playSound('chomp')
    const id = meal.n
    setSnacks((s) => [...s.slice(-3), id])
    const t1 = setTimeout(() => setEating(false), EAT_MS)
    const t2 = setTimeout(() => setSnacks((s) => s.filter((x) => x !== id)), 900)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [meal])

  // Grumble once when it starts sulking.
  useEffect(() => {
    if (mood.key === 'sulk' && lastMood.current !== 'sulk') playSound('wrong')
    lastMood.current = mood.key
  }, [mood.key])

  const pet = () => {
    playSound('woof')
    const id = Date.now()
    setHearts((h) => [...h.slice(-4), id])
    setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1000)
  }

  const sulking = mood.key === 'sulk'
  const scale = Math.min(1 + (level - 1) * 0.08, 1.6) // grows a little with each level

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative grid h-44 w-full place-items-center">
        <div className={`pug-pet pug-${mood.key} ${eating ? 'pug-eating' : ''}`} style={{ '--pug-scale': scale }}>
          <button
            type="button"
            data-sound="none"
            onClick={pet}
            aria-label="ลูบน้องปั๊ก"
            className={`dog ${sulking ? 'dog-sleep' : 'dog-sit'} block cursor-pointer`}
            style={{ transform: `scaleX(${sulking ? -1 : 1})` }}
          >
            <PugSvg />
          </button>
        </div>
        {sulking && <span className="pug-bubble absolute top-2 right-6 rounded-xl bg-surface px-2 py-1 text-sm font-semibold text-ink shadow-card">หึ! 😤</span>}
        {mood.key === 'hungry' && <span className="pug-bubble absolute top-2 right-6 rounded-xl bg-surface px-2 py-1 text-sm text-ink shadow-card">หิว… 🍖</span>}
        {snacks.map((id) => (
          <span key={id} className="pug-snack pointer-events-none absolute top-0 left-1/2 text-2xl" aria-hidden="true">
            🦴
          </span>
        ))}
        {hearts.map((id) => (
          <span key={id} className="dog-heart pointer-events-none absolute top-6 left-1/2 text-2xl" aria-hidden="true">
            ❤️
          </span>
        ))}
      </div>

      <p className="text-sm font-medium text-ink">
        น้องปั๊ก · เลเวล <span className="tabular-nums">{level}</span> {mood.emoji}
      </p>
      <p className="mt-0.5 text-xs text-muted" aria-live="polite">
        {mood.text}
      </p>
      <div className="mt-3 w-full" role="meter" aria-label="ความอิ่ม" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hunger)}>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>ความอิ่ม</span>
          <span className="tabular-nums">{Math.round(hunger)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${hunger < 12 ? 'bg-red-500' : hunger < 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${hunger}%` }}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">ทุกออเดอร์คือขนม 1 ชิ้น · ยอดทุก ฿2,000 = เลเวลขึ้น</p>
    </div>
  )
}

export default PugPet
