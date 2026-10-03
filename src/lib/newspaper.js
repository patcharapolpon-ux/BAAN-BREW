// Writes the front page of "บ้านบรูรายวัน" from the data. All numbers come from metrics.js;
// this file only turns them into Thai tabloid headlines (the louder the better).
import {
  comparePeriods,
  dailySales,
  explainDay,
  findAnomalies,
  formatBaht,
  formatNumber,
  formatPercent,
  formatThaiDate,
  lotteryEffect,
  rowsByDate,
  storyFacts,
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

/** Everything on the front page. lottery = public/lottery.json (or null if it couldn't load). */
export function buildPaper(rows, products, lottery) {
  const facts = storyFacts(rows, products)
  const daily = dailySales(rows)
  const cases = findAnomalies(daily)
  const byDate = rowsByDate(rows)
  // A newspaper wants the biggest jump in percent (z only decides what counts as unusual).
  const spike = cases.filter((c) => c.kind === 'spike').sort((a, b) => b.sales / b.expected - a.sales / a.expected)[0]
  const drop = cases.find((c) => c.kind === 'drop' && eventNear(c.date)) ?? cases.find((c) => c.kind === 'drop')
  const recent = comparePeriods(daily, 30)
  const champ = facts.branches[0]
  const allMenu = topProducts(rows, products, Infinity)
  const flop = allMenu.at(-1)

  // Headline: the biggest spike, with the menu and branch that drove it.
  let headline = { title: `บ้านบรูฉลองยอด ${millions(facts.kpi.totalSales)}`, sub: '', lead: '' }
  if (spike) {
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
  }

  const stories = [
    champ && {
      kicker: 'กีฬาสาขา',
      title: `${champ.branch}ครองบัลลังก์ ฟาดยอด ${millions(champ.sales)}`,
      body: `กวาดส่วนแบ่ง ${formatPercent(champ.share, 1)} ของทุกสาขา ทิ้งห่างอันดับสอง${facts.branches[1] ? ` ${facts.branches[1].branch}` : ''} คู่แข่งยอมรับ "เขาเก่งจริง"`,
    },
    drop && {
      kicker: 'สังคม',
      title: `${eventNear(drop.date) ?? 'วันแปลก'} ร้านเหงา ยอดดิ่ง ${formatPercent(1 - drop.sales / drop.expected, 0)}`,
      body: `${formatThaiDate(drop.date, SHORT)} ขายได้เพียง ${formatBaht(drop.sales)} พนักงานยืนมองประตูทั้งวัน น้องปั๊กนอนกลางร้านไม่มีใครว่า`,
    },
    facts.topMenu[0] && {
      kicker: 'บันเทิง',
      title: `${facts.topMenu[0].name} คว้ารางวัลเมนูแห่งปี`,
      body: `ขายไป ${formatNumber(facts.topMenu[0].qty)} แก้ว ชนะขาด${facts.topMenu[1] ? ` ${facts.topMenu[1].name}` : ''} แฟนคลับแห่ร่วมยินดีหน้าเคาน์เตอร์`,
    },
  ].filter(Boolean)

  // Lottery corner: latest draw, and whether the last day's sales "won" on the last two digits.
  let lotto = null
  if (lottery?.draws.length) {
    const latest = lottery.draws.at(-1)
    const lastDay = daily.at(-1)
    const tail = String(Math.round(lastDay.sales) % 100).padStart(2, '0')
    const luck = lotteryEffect(daily, lottery.draws.map((d) => d.date))
    const wins = lottery.draws.filter((d) => {
      const day = daily.find((x) => x.date === d.date)
      return day && String(Math.round(day.sales) % 100).padStart(2, '0') === d.last2
    })
    lotto = { latest, tail, hit: tail === latest.last2, luck, wins, lastDay, source: lottery.source }
  }

  const ads = [
    `ด่วน! รับสมัครบาริสต้า สาขา${champ?.branch} ขายดีจนชงไม่ทัน ทักน้องปั๊กได้ตลอด 24 ชม.`,
    flop && `ประกาศตามหาแฟนคลับ "${flop.name}" ทั้งปีขายได้แค่ ${formatNumber(flop.qty)} ${flop.category === 'อาหาร' ? 'จาน' : 'ชิ้น'} เหงามาก`,
    'น้องปั๊กรับจ้างเฝ้าร้าน ประสบการณ์นอน 10 ปี ค่าจ้างเป็นขนม ต่อรองได้',
    'สอนพิเศษ z-score ตัวต่อตัว ไม่เข้าใจยินดีคืนเงิน (ไม่มีเงินให้คืน)',
    `ขายด่วน! สถิติ ${formatNumber(facts.kpi.orderCount)} บิล สภาพดี ใช้งานน้อย`,
  ].filter(Boolean)

  return {
    date: facts.last,
    issue: facts.kpi.dayCount,
    headline,
    stories,
    lotto,
    weather: { ...weatherFor(recent.change), change: recent.change },
    ads,
    stats: [
      ['ยอดขายรวม', formatBaht(facts.kpi.totalSales)],
      ['จำนวนบิล', formatNumber(facts.kpi.orderCount)],
      ['เฉลี่ยต่อบิล', formatBaht(facts.kpi.averageOrderValue, 2)],
      ['ชั่วโมงทอง', facts.peak ? `${facts.peak.name} ${String(facts.peak.hour).padStart(2, '0')}:00` : '-'],
    ],
  }
}
