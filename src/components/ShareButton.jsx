import { useState } from 'react'
import { downloadShareCard } from '../lib/shareCard'
import { showToast } from './Toaster'

// "แชร์สรุป": draws the Wrapped-style summary card for the current filter and downloads it.
function ShareButton(props) {
  const [busy, setBusy] = useState(false)
  const onClick = async () => {
    setBusy(true)
    try {
      await downloadShareCard(props)
      showToast({ icon: '📸', title: 'บันทึกการ์ดสรุปแล้ว', text: 'เอาไปลงสตอรี่ได้เลย' })
    } catch {
      showToast({ icon: '😵', title: 'สร้างรูปไม่สำเร็จ', text: 'ลองกดอีกครั้งนะ' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      data-sound="select"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-2 shadow-card transition-all duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className={`size-4 ${busy ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {busy ? <path d="M12 3a9 9 0 1 0 9 9" /> : <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />}
      </svg>
      {busy ? 'กำลังสร้าง…' : 'แชร์สรุป'}
    </button>
  )
}

export default ShareButton
