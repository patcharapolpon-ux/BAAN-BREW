import { formatBaht, formatNumber, formatThaiDate } from '../lib/metrics'

const SHORT_DATE = { day: 'numeric', month: 'short', year: '2-digit' }

// Top spenders as a real table (screen readers and copy-paste friendly). A thin bar under
// each amount shows it relative to #1. Branch and age columns hide on phones to stay readable.
function TopCustomersTable({ data, show = true }) {
  const max = data[0]?.spend ?? 1
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[20rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="w-8 py-2 pr-2 pl-4 font-normal sm:pl-0">#</th>
            <th scope="col" className="py-2 pr-3 font-normal">ลูกค้า</th>
            <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">สาขาประจำ</th>
            <th scope="col" className="hidden py-2 pr-3 font-normal md:table-cell">อายุ</th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">บิล</th>
            <th scope="col" className="w-36 py-2 pr-3 text-right font-normal">ยอดซื้อรวม</th>
            <th scope="col" className="hidden py-2 pr-4 text-right font-normal sm:table-cell sm:pr-0">ซื้อล่าสุด</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={c.customer_id} className="border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-surface-2/70">
              <td className="py-2.5 pr-2 pl-4 text-muted tabular-nums sm:pl-0">{i + 1}</td>
              <td className="py-2.5 pr-3">
                <span className="block text-ink">{c.nickname}</span>
                <span className="block text-xs text-muted">{c.customer_id}</span>
              </td>
              <td className="hidden py-2.5 pr-3 text-ink-2 sm:table-cell">{c.home_branch}</td>
              <td className="hidden py-2.5 pr-3 text-ink-2 md:table-cell">{c.age_group}</td>
              <td className="py-2.5 pr-3 text-right text-ink-2 tabular-nums">{formatNumber(c.orders)}</td>
              <td className="py-2.5 pr-3 text-right">
                <span className="font-medium text-ink tabular-nums">{formatBaht(c.spend)}</span>
                <span className="mt-1 ml-auto block h-1 w-full max-w-28 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-accent transition-[width] duration-1000 [transition-timing-function:var(--ease-out)]"
                    style={{ width: show ? `${(c.spend / max) * 100}%` : '0%', transitionDelay: `${i * 50}ms` }}
                  />
                </span>
              </td>
              <td className="hidden py-2.5 pr-4 text-right text-ink-2 tabular-nums sm:table-cell sm:pr-0">{formatThaiDate(c.last, SHORT_DATE)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TopCustomersTable
