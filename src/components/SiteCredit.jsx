// Small "made by" line at the very bottom of every page, like an app's about/credits line.
// The year follows the Thai calendar (พ.ศ.) and updates itself.
function SiteCredit({ className = '' }) {
  const year = new Date().getFullYear() + 543
  return (
    <div className={`mt-10 border-t border-line pt-5 text-center text-xs text-muted sm:mt-12 ${className}`}>
      <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>© {year} บ้านบรู Dashboard</span>
        <span aria-hidden="true" className="text-line">
          •
        </span>
        <span>
          ออกแบบและพัฒนาโดย <span className="credit-name font-medium text-ink-2">NetHandsome</span>
        </span>
      </p>
    </div>
  )
}

export default SiteCredit
