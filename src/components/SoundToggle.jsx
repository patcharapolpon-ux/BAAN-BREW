import { playSound, useSound } from '../lib/sound'

// Speaker button in the header: sound effects on/off (remembered in localStorage).
function SoundToggle() {
  const [on, setOn] = useSound()
  return (
    <button
      type="button"
      data-sound="none"
      aria-pressed={on}
      aria-label={on ? 'ปิดเสียงประกอบ' : 'เปิดเสียงประกอบ'}
      title={on ? 'ปิดเสียงประกอบ' : 'เปิดเสียงประกอบ'}
      onClick={() => {
        setOn(!on)
        if (!on) playSound('select') // a little confirmation when turning it on
      }}
      className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-card transition-transform duration-300 [transition-timing-function:var(--ease-spring)] hover:scale-110 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-90 sm:size-11"
    >
      <svg
        key={on ? 'on' : 'off'}
        viewBox="0 0 24 24"
        className="spin-in size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9.5h3l4.5-4v13L7 14.5H4z" />
        {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="m16 9.5 5 5m0-5-5 5" />}
      </svg>
    </button>
  )
}

export default SoundToggle
