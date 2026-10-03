// Writes the front page of "บ้านบรูรายวัน" from the data. All numbers come from metrics.js;
// this file only turns them into Thai tabloid headlines (the louder the better).
import {
  comparePeriods,
  dailySales,
  daysBetween,
  expectedFor,
  explainDay,
  findAnomalies,
  formatBaht,
  formatNumber,
  formatPercent,
  formatThaiDate,
  lotteryEffect,
  rowsByDate,
  storyFacts,
  toThaiDate,
  topProducts,
} from './metrics.js'
import { eventNear } from './thaiEvents.js'

const LONG = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
const SHORT = { day: 'numeric', month: 'short', year: '2-digit' }
const millions = (v) => `${formatNumber(v / 1e6, 2)} ล้านบาท`

function weatherFor(change) {
  if (change == null) return { icon: '🌫️', text: 'หมอกลงจัด ข้อมูลยังไม่พอพยากรณ์' }
  if (change > 0.1) return { icon: '☀️', text: 'แดดจ้าทั้งวัน ยอดขายร้อนแรง' }
  if (change > 0.02) return { icon: '🌤️', text: 'ฟ้าใส มีเมฆบางส่วน' }
  if (change > -0.02) return { icon: '⛅', text: 'เมฆเป็นส่วนมาก ยอดทรงตัว' }
  if (change > -0.1) return { icon: '🌧️', text: 'ฝนตกเล็กน้อย ควรพกร่ม' }
  return { icon: '⛈️', text: 'พายุเข้า! ยอดขายดิ่ง' }
}

const HEADLINE_WINDOW_DAYS = 45 // a spike older than this is no longer front-page news
const tail2 = (sales) => String(Math.round(sales) % 100).padStart(2, '0')

/**
 * Everything on one issue's front page. lottery = public/lottery.json (or null).
 * drawDate picks the issue: the paper is dated that draw and only knows the news up to that
 * day (sales after it haven't happened yet). Default = the latest draw.
 */
export function buildPaper(allRows, products, lottery, drawDate = null) {
  const draws = lottery?.draws ?? []
  const draw = draws.find((d) => d.date === drawDate) ?? draws.at(-1) ?? null
  const upTo = draw ? allRows.filter((r) => toThaiDate(r.datetime) <= draw.date) : []
  const rows = upTo.length ? upTo : allRows
  const asOf = draw?.date ?? null

  const facts = storyFacts(rows, products)
  const daily = dailySales(rows)
  const cases = findAnomalies(daily)
  const byDate = rowsByDate(rows)
  const today = daily.find((d) => d.date === asOf) ?? daily.at(-1)
  const isFresh = (c) => daysBetween(c.date, today.date) < HEADLINE_WINDOW_DAYS
  // A newspaper wants the biggest jump in percent (z only decides what counts as unusual).
  const byLift = (a, b) => b.sales / b.expected - a.sales / a.expected
  const spike = cases.filter((c) => c.kind === 'spike' && isFresh(c)).sort(byLift)[0]
  const drops = cases.filter((c) => c.kind === 'drop')
  const drop = drops.find(isFresh) ?? drops.find((c) => eventNear(c.date)) ?? drops[0]
  const recent = comparePeriods(daily, 30)
  const champ = facts.branches[0]
  const flop = topProducts(rows, products, Infinity).at(-1)

  let headline
  if (spike) {
    // A recent big spike: the menu and branch that drove it.
    const why = explainDay(byDate, spike.date, products)
    const event = eventNear(spike.date)
    const star = why.products[0]?.key
    const branch = why.branches[0]?.key
    headline = {
      title: `${event ? `${event}เดือด!` : 'ช็อกวงการกาแฟ!'} ยอดพุ่ง ${formatPercent(spike.sales / spike.expected - 1, 0)}`,
      sub: `${star ?? 'กาแฟ'}ขายเกลี้ยง! สาขา${branch}คนแน่นจนประตูแทบแตก นักสืบยืนยัน "ไม่ใช่เรื่องบังเอิญ" (z = ${spike.z.toFixed(1)})`,
      lead: `${formatThaiDate(spike.date, LONG)} บ้านบรูทำยอดได้ถึง ${formatBaht(spike.sales)} จากปกติราว ${formatBaht(
        spike.expected,
      )} แหล่งข่าวใกล้ชิดน้องปั๊กเผยว่าสาขา${branch}ขายดีกว่าปกติ ${formatBaht(why.branches[0]?.diff ?? 0)} ส่วน${star}ทำยอดเกินปกติ ${formatBaht(
        why.products[0]?.diff ?? 0,
      )} ${event ? `ผู้เชี่ยวชาญชี้ว่าเกี่ยวกับ${event}` : 'สาเหตุยังเป็นปริศนา ตำรวจกาแฟกำลังเร่งสืบสวน'}`,
    }
  } else {
    // A quiet stretch: the draw day's own sales are the news.
    const e = expectedFor(daily, daily.indexOf(today))
    const lift = e?.mean ? today.sales / e.mean - 1 : null
    const weekday = formatThaiDate(today.date, { weekday: 'long' })
    const mood =
      lift == null
        ? 'ร้านเพิ่งเปิดได้ไม่นาน ลูกค้าเริ่มรู้จัก น้องปั๊กยืนต้อนรับหน้าประตูทุกเช้า'
        : lift > 0.05
        ? `ขายดีกว่า${weekday}ปกติ ${formatPercent(lift, 0)} พนักงานยิ้มไม่หุบ`
        : lift < -0.05
        ? `เงียบกว่า${weekday}ปกติ ${formatPercent(-lift, 0)} คาดว่าทุกคนไปลุ้นหวยกันหมด`
        : 'ยอดปกติดี ไม่มีอะไรตื่นเต้น น้องปั๊กหลับสบาย'
    headline = {
      title: `ศึกวันหวยออก! บ้านบรูขาย ${formatBaht(today.sales)}`,
      sub: mood,
      lead: `${formatThaiDate(today.date, LONG)} ทั้ง ${facts.branches.length} สาขาของบ้านบรูขายรวม ${formatBaht(today.sales)} ยอดสะสมตั้งแต่เปิดร้านแตะ ${millions(
        facts.kpi.totalSales,
      )} จาก ${formatNumber(facts.kpi.orderCount)} บิล นักสืบประจำร้านรายงานว่าช่วงนี้ยังไม่พบเหตุผิดปกติ`,
    }
  }

  const stories = [
    champ && {
      kicker: 'กีฬาสาขา',
      title: `${champ.branch}ครองบัลลังก์ ฟาดยอด ${millions(champ.sales)}`,
      body: `กวาดส่วนแบ่ง ${formatPercent(champ.share, 1)} ของทุกสาขา${facts.branches[1] ? ` ทิ้งห่างอันดับสอง ${facts.branches[1].branch}` : ''} คู่แข่งยอมรับ "เขาเก่งจริง"`,
    },
    drop && {
      kicker: 'สังคม',
      title: `${eventNear(drop.date) ?? 'วันแปลก'} ร้านเหงา ยอดดิ่ง ${formatPercent(1 - drop.sales / drop.expected, 0)}`,
      body: `${formatThaiDate(drop.date, SHORT)} ขายได้เพียง ${formatBaht(drop.sales)} พนักงานยืนมองประตูทั้งวัน น้องปั๊กนอนกลางร้านไม่มีใครว่า`,
    },
    facts.topMenu[0] && {
      kicker: 'บันเทิง',
      title: `${facts.topMenu[0].name} ครองใจลูกค้าอันดับ 1`,
      body: `ขายไปแล้ว ${formatNumber(facts.topMenu[0].qty)} แก้ว${facts.topMenu[1] ? ` ชนะขาด ${facts.topMenu[1].name}` : ''} แฟนคลับแห่ร่วมยินดีหน้าเคาน์เตอร์`,
    },
  ].filter(Boolean)

  // Lottery corner: this issue's draw, and whether that day's sales "won" on the last two digits.
  let lotto = null
  if (draw) {
    const pastDraws = draws.filter((d) => d.date <= draw.date)
    const luck = lotteryEffect(daily, pastDraws.map((d) => d.date))
    const wins = pastDraws.filter((d) => {
      const day = daily.find((x) => x.date === d.date)
      return day && tail2(day.sales) === d.last2
    })
    const tail = tail2(today.sales)
    lotto = { latest: draw, tail, hit: tail === draw.last2, isDrawDay: today.date === draw.date, luck, wins, lastDay: today, source: lottery.source }
  }

  const ads = [
    `ด่วน! รับสมัครบาริสต้า สาขา${champ?.branch} ขายดีจนชงไม่ทัน ทักน้องปั๊กได้ตลอด 24 ชม.`,
    flop && `ประกาศตามหาแฟนคลับ "${flop.name}" ขายได้แค่ ${formatNumber(flop.qty)} ${flop.category === 'อาหาร' ? 'จาน' : 'ชิ้น'} เหงามาก`,
    'น้องปั๊กรับจ้างเฝ้าร้าน ประสบการณ์นอน 10 ปี ค่าจ้างเป็นขนม ต่อรองได้',
    'สอนพิเศษ z-score ตัวต่อตัว ไม่เข้าใจยินดีคืนเงิน (ไม่มีเงินให้คืน)',
    `ขายด่วน! สถิติ ${formatNumber(facts.kpi.orderCount)} บิล สภาพดี ใช้งานน้อย`,
  ].filter(Boolean)

  return {
    date: asOf ?? facts.last,
    issue: daysBetween(facts.first, asOf ?? facts.last) + 1,
    headline,
    stories,
    lotto,
    weather: { ...weatherFor(recent.change), change: recent.change },
    ads,
    stats: [
      ['ยอดขายสะสม', formatBaht(facts.kpi.totalSales)],
      ['จำนวนบิล', formatNumber(facts.kpi.orderCount)],
      ['เฉลี่ยต่อบิล', formatBaht(facts.kpi.averageOrderValue, 2)],
      ['ชั่วโมงทอง', facts.peak ? `${facts.peak.name} ${String(facts.peak.hour).padStart(2, '0')}:00` : '-'],
    ],
  }
}
