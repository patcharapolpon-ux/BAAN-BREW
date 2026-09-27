import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
import AgeGroupChart from '../components/AgeGroupChart'
import BarList from '../components/BarList'
import DonutChart from '../components/DonutChart'
import JoinsChart from '../components/JoinsChart'
import KpiCard from '../components/KpiCard'
import Panel from '../components/Panel'
import TopCustomersTable from '../components/TopCustomersTable'
import {
  AGE_ORDER,
  customerProfiles,
  customersByGroup,
  dailySales,
  formatBaht,
  formatNumber,
  formatPercent,
  formatThaiDate,
  joinsByMonth,
  recencySegments,
  summarizeCustomers,
  topCustomers,
} from '../lib/metrics'

const SHORT_DATE = { day: 'numeric', month: 'short', year: '2-digit' }
const MONTH = { month: 'short', year: '2-digit' }
const monthName = (m) => formatThaiDate(`${m}-01`, MONTH)
// Bar strength per recency bucket: recent = solid coffee, long ago = faint, never = hatched.
const RECENCY_STRENGTH = { d30: 1, d90: 0.72, d180: 0.5, older: 0.3, never: 0 }

// A one-line takeaway above a chart, always computed from the data (no hard-coded numbers).
function Insight({ children }) {
  return <p className="mb-4 rounded-xl bg-surface-2/70 px-3 py-2 text-sm text-ink-2">{children}</p>
}

// Member page (#customers): who the members are, whether they come back, and who spends most.
// customers.csv is loaded here, only when the page is opened; sales rows come from App.
function CustomersPage({ rows, colors }) {
  const [customers, setCustomers] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Papa.parse('/customers.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => setCustomers(result.data),
      error: (err) => setError(err.message),
    })
  }, [])

  const data = useMemo(() => {
    if (!customers) return null
    // "As of" = the last day with sales: the data is historical, so today's date would
    // make every member look inactive.
    const asOf = dailySales(rows).at(-1).date
    const profiles = customerProfiles(customers, rows)
    const joins = joinsByMonth(profiles, asOf)
    const fullJoins = joins.filter((m) => !m.partial)
    return {
      asOf,
      kpi: summarizeCustomers(profiles, asOf),
      joins,
      avgJoins: fullJoins.reduce((s, m) => s + m.count, 0) / fullJoins.length,
      recency: recencySegments(profiles, asOf),
      branches: customersByGroup(profiles, 'home_branch'),
      ages: customersByGroup(profiles, 'age_group', AGE_ORDER),
      genders: customersByGroup(profiles, 'gender'),
      top: topCustomers(profiles, 10),
    }
  }, [customers, rows])

  if (error) {
    return (
      <p role="alert" className="rounded-2xl border border-line bg-surface p-5 text-ink">
        โหลดข้อมูลลูกค้าไม่สำเร็จ: {error}
      </p>
    )
  }
  if (!data) {
    return (
      <div aria-busy="true" aria-label="กำลังโหลดข้อมูลลูกค้า" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28 rounded-2xl sm:h-40" />
        ))}
      </div>
    )
  }

  const { kpi, recency } = data
  const lapsed = recency.filter((r) => r.key === 'd180' || r.key === 'older')
  const lapsedCount = lapsed.reduce((s, r) => s + r.count, 0)
  const topAge = data.ages.reduce((a, b) => (b.members > a.members ? b : a))
  const topSpendAge = data.ages.reduce((a, b) => (b.spendPerBuyer > a.spendPerBuyer ? b : a))
  const lowBranch = data.branches.reduce((a, b) => (b.buyerShare < a.buyerShare ? b : a))
  const top10Spend = data.top.reduce((s, c) => s + c.spend, 0)

  return (
    <main>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          icon="members"
          label="สมาชิกทั้งหมด"
          value={kpi.total}
          format={(v) => formatNumber(v)}
          hint={`เคยซื้อแล้ว ${formatNumber(kpi.buyers)} คน (${formatPercent(kpi.buyerShare, 0)})`}
        />
        <KpiCard
          icon="newMember"
          label={`สมาชิกใหม่ ${monthName(kpi.newMonth.month)}`}
          value={kpi.newMonth.count}
          format={(v) => formatNumber(v)}
          hint="เดือนล่าสุดที่ข้อมูลครบทั้งเดือน"
          spark={data.joins.filter((m) => !m.partial).map((m) => m.count)}
          trend={
            kpi.newChange != null && {
              value: kpi.newChange,
              text: formatPercent(kpi.newChange, 1, true),
              label: 'จากเดือนก่อน',
            }
          }
          delay={60}
        />
        <KpiCard
          icon="wallet"
          label="ใช้จ่ายเฉลี่ยต่อสมาชิก"
          value={kpi.avgSpend}
          format={(v) => formatBaht(v)}
          hint={`ค่ากลาง ${formatBaht(kpi.medianSpend)} · ครึ่งหนึ่งซื้อไม่เกินนี้`}
          delay={120}
        />
        <KpiCard
          icon="repeat"
          label="กลับมาซื้อใน 30 วัน"
          value={kpi.active30}
          format={(v) => formatNumber(v)}
          hint={`${formatPercent(kpi.active30Share, 0)} ของคนที่เคยซื้อ`}
          delay={180}
        />
      </section>

      <Panel
        title="สมาชิกใหม่รายเดือน"
        subtitle={`เฉลี่ย ${formatNumber(data.avgJoins)} คน/เดือน · * แท่งจาง = เดือนที่ยังไม่จบ ข้อมูลยังไม่ครบ`}
        delay={120}
      >
        {(inView) => <JoinsChart data={data.joins} colors={colors} show={inView} />}
      </Panel>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
        <Panel
          title="ซื้อครั้งล่าสุดเมื่อไร"
          subtitle={`นับจากวันที่ซื้อครั้งล่าสุด ถึง ${formatThaiDate(data.asOf, SHORT_DATE)} (วันสุดท้ายของข้อมูล)`}
          className=""
        >
          {(inView) => (
            <>
              <Insight>
                {formatNumber(lapsedCount)} คน ({formatPercent(lapsedCount / kpi.total, 0)}) ไม่ได้กลับมาเกิน 90 วัน เป็นกลุ่มที่ควรส่งโปรฯ ดึงกลับ
              </Insight>
              <BarList
                show={inView}
                items={recency.map((r) => ({
                  key: r.key,
                  label: r.label,
                  value: r.count,
                  text: `${formatNumber(r.count)} คน · ${formatPercent(r.share, 0)}`,
                  strength: RECENCY_STRENGTH[r.key],
                }))}
              />
            </>
          )}
        </Panel>

        <Panel title="สาขาประจำ" subtitle="สาขาที่สมัครสมาชิก · เรียงตามจำนวนสมาชิก" delay={100} className="">
          {(inView) => (
            <>
              <Insight>
                {lowBranch.name}มีสมาชิกที่เคยซื้อน้อยที่สุด ({formatPercent(lowBranch.buyerShare, 0)}) สมัครแล้วยังไม่ได้ซื้อเยอะกว่าสาขาอื่น
              </Insight>
              <BarList
                show={inView}
                items={data.branches.map((b) => ({
                  key: b.name,
                  label: b.name,
                  value: b.members,
                  text: `${formatNumber(b.members)} คน`,
                  sub: `เคยซื้อ ${formatPercent(b.buyerShare, 0)} · ใช้จ่ายเฉลี่ย ${formatBaht(b.spendPerBuyer)}/คน`,
                }))}
              />
            </>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-5">
        <Panel title="ช่วงอายุ" subtitle="จำนวนสมาชิกในแต่ละช่วงอายุ · ชี้ที่แท่งเพื่อดูยอดใช้จ่าย" className="lg:col-span-3">
          {(inView) => (
            <>
              <Insight>
                อายุ {topAge.name} มากที่สุด ({formatPercent(topAge.share, 0)}) · ใช้จ่ายต่อคนสูงสุดคือ {topSpendAge.name} (
                {formatBaht(topSpendAge.spendPerBuyer)}/คน จากสมาชิก {formatNumber(topSpendAge.members)} คน)
              </Insight>
              <AgeGroupChart data={data.ages} colors={colors} show={inView} />
            </>
          )}
        </Panel>
        <Panel title="เพศ" subtitle="สัดส่วนสมาชิก · ชี้ที่ชิ้นหรือรายการ" delay={100} className="lg:col-span-2">
          {(inView) => (
            <DonutChart
              data={data.genders.map((g) => ({ name: g.name, sales: g.members, share: g.share }))}
              colors={colors}
              show={inView}
              format={(v) => `${formatNumber(v)} คน`}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="ลูกค้าที่ซื้อมากที่สุด 10 อันดับ"
        subtitle={`รวมกัน ${formatBaht(top10Spend)} · เรียงตามยอดซื้อรวมทั้งหมด`}
      >
        {(inView) => <TopCustomersTable data={data.top} show={inView} />}
      </Panel>

      <footer className="mt-8 text-center text-xs text-muted sm:mt-10">
        สมาชิก {formatNumber(kpi.total)} คน · ข้อมูลการซื้อถึง {formatThaiDate(data.asOf, SHORT_DATE)} ·{' '}
        <a href="#lab2" className="underline">
          Lab 2.2 ซ่อมกราฟแย่
        </a>
      </footer>
    </main>
  )
}

export default CustomersPage
