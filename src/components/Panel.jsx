import { useInView } from '../lib/motion'

// Section card that animates in when it scrolls into view. `children` may be a function
// that receives `inView`, so a chart can wait and play its own animation on arrival.
function Panel({ title, subtitle, delay = 0, className = 'mt-4 sm:mt-6', children }) {
  const [ref, inView] = useInView()
  return (
    <section
      ref={ref}
      className={`reveal rounded-2xl border border-line bg-surface/85 p-4 shadow-card backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg sm:p-7 ${className} ${inView ? 'is-visible' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 sm:mb-5">
        <h2 className="flex items-center gap-2 font-medium text-ink">
          <span className="inline-block h-4 w-1 rounded-full bg-accent" aria-hidden="true" />
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted sm:text-sm">{subtitle}</p>}
      </div>
      {typeof children === 'function' ? children(inView) : children}
    </section>
  )
}

export default Panel
