import { useRef, useState } from 'react'
import { playSound } from '../lib/sound'

// Small "made by" line at the very bottom of every page, like an app's about/credits line.
// The year follows the Thai calendar (พ.ศ.) and updates itself.
function SiteCredit({ className = '' }) {
  const year = new Date().getFullYear() + 543
  // Easter egg: rest the pointer on the name for 3 seconds.
  const [shine, setShine] = useState(false)
  const timer = useRef(0)
  const hold = () => {
    timer.current = setTimeout(() => {
      setShine(true)
      playSound('secret')
    }, 3000)
  }
  return (
    <div className={`mt-10 border-t border-line pt-5 text-center text-xs text-muted sm:mt-12 ${className}`}>
      <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>© {year} บ้านบรู Dashboard</span>
        <span aria-hidden="true" className="text-line">
          •
        </span>
        <span>
          ออกแบบและพัฒนาโดย{' '}
          <span className={`credit-name font-medium text-ink-2 ${shine ? 'credit-shine' : ''}`} onPointerEnter={hold} onPointerLeave={() => clearTimeout(timer.current)}>
            NetHandsome{shine && ' (หล่อจริง ไม่ได้โม้ ✨)'}
          </span>
        </span>
      </p>
    </div>
  )
}

export default SiteCredit
