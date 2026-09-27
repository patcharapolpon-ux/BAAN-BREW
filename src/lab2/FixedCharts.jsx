// Lab 2.2 · กราฟที่ซ่อมแล้ว — เทียบกับ BadChart1 … BadChart5 ใน BadCharts.jsx
// กติกาที่ใช้ทุกกราฟ:
//   - สีหลักสีเดียว (MAIN) ความเข้มต่างกันได้ แต่ไม่ใช้หลายสีแยกของ
//   - ตัวเลขเงินมี ฿ และจุลภาคเสมอ (fmtBaht)
//   - มีข้อความสรุป 1 บรรทัดเหนือกราฟ คำนวณจาก rows ทุกครั้ง ไม่มีตัวเลขพิมพ์ตายตัว
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { revenueByProduct, monthlyRevenue, branchPerformance, weeklyRevenue, daysInMonth, thaiMonth } from "./lab2Metrics.js";
import { fmtBaht, fmtShortBaht } from "../lib/metrics.js";

const MAIN = "#8a4b1c"; // สีหลักสีเดียว (น้ำตาลกาแฟ)
const MUTED = "#a8a29e"; // เทา สำหรับตัวหนังสือรองบนแกน
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const thaiDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

// โครงร่วม: บรรทัดสรุปด้านบน + กราฟเต็มพื้นที่ที่เหลือ (กล่องใน Lab2Page สูงคงที่ h-80)
function Frame({ summary, note, children }) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-sm font-semibold text-stone-800">{summary}</p>
      {note && <p className="text-xs text-stone-500">{note}</p>}
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

// Tooltip แบบเดียวกันทุกกราฟ: หัวข้อ + บรรทัดตัวเลข (มี ฿ และจุลภาค)
function Tip({ active, payload, title, lines }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow">
      <div className="font-semibold">{title(d)}</div>
      {lines(d).map((l) => <div key={l} className="text-stone-600">{l}</div>)}
    </div>
  );
}

/**
 * กราฟ 1 · เมนูไหนทำเงินมากที่สุด
 * แก้: pie 40 ชิ้น + สีรุ้ง → แท่งแนวนอน 10 อันดับแรก เรียงมากไปน้อย มีชื่อเมนูและยอดติดแท่ง
 * เหตุผล: คนเทียบ "ความยาว" ได้แม่นกว่า "มุม/พื้นที่" และไม่ต้องจับคู่สีกับ legend
 */
export function FixedChart1({ rows, products }) {
  const all = useMemo(() => revenueByProduct(rows, products), [rows, products]);
  const top = all.slice(0, 10);
  const top3 = top.slice(0, 3).reduce((s, d) => s + d.share, 0);
  return (
    <Frame
      summary={`"${all[0].name}" ทำเงินสูงสุด ${fmtBaht(all[0].revenue)} (${pct(all[0].share)}) · 3 อันดับแรกรวมกัน ${pct(top3)} ของยอดขาย`}
      note={`แสดง 10 อันดับแรกจาก ${all.length} เมนู`}
    >
      <BarChart data={top} layout="vertical" margin={{ left: 0, right: 80 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
        <Tooltip cursor={{ fill: "#f5f5f4" }} content={<Tip title={(d) => d.name} lines={(d) => [fmtBaht(d.revenue), `${pct(d.share)} ของยอดขายทั้งหมด`]} />} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="revenue" position="right" formatter={(v) => fmtBaht(v)} style={{ fontSize: 11, fill: "#44403c" }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 2 · สาขาขายได้ต่างกันมากแค่ไหน
 * แก้: แกนเริ่มที่ 500,000 → เริ่มที่ 0 (ความยาวแท่งจึงเป็นสัดส่วนจริง), สีเดียว, เรียงมากไปน้อย
 * เหตุผล: กราฟแท่งสื่อด้วยความยาว ถ้าตัดฐานแกน ส่วนต่างจะดูใหญ่เกินจริงหลายเท่า
 */
export function FixedChart2({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => b.revenue - a.revenue), [rows]);
  const first = data[0];
  const last = data[data.length - 1];
  return (
    <Frame summary={`${first.branch}ขายได้ ${fmtBaht(first.revenue)} เป็น ${(first.revenue / last.revenue).toFixed(2)} เท่าของ${last.branch} (${fmtBaht(last.revenue)})`}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 100 }}>
        <XAxis type="number" domain={[0, "dataMax"]} hide />
        <YAxis type="category" dataKey="branch" width={90} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "#f5f5f4" }} content={<Tip title={(d) => d.branch} lines={(d) => [fmtBaht(d.revenue)]} />} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="revenue" position="right" formatter={(v) => fmtBaht(v)} style={{ fontSize: 12, fill: "#44403c" }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 3 · ยอดขายโดยรวมโตขึ้นหรือลดลง
 * แก้: 538 จุดรายวัน → รวมรายสัปดาห์ (เฉพาะสัปดาห์ที่ครบ 7 วัน) เส้นบาง ไม่มีจุด วันที่บนแกนห่าง ๆ แบบไทย
 * เหตุผล: คำถามคือ "แนวโน้ม" การรวมรายสัปดาห์ตัดความแกว่งระหว่างวันธรรมดากับเสาร์อาทิตย์ออก
 *        และตัดสัปดาห์ไม่ครบทิ้ง จะได้ไม่มีจุดดิ่งปลอมที่หัวหรือท้ายกราฟ
 */
export function FixedChart3({ rows }) {
  const data = useMemo(() => weeklyRevenue(rows), [rows]);
  const n = Math.min(8, Math.floor(data.length / 2));
  const avg = (list) => list.reduce((s, w) => s + w.revenue, 0) / list.length;
  const early = avg(data.slice(0, n));
  const late = avg(data.slice(-n));
  const change = (late - early) / early;
  return (
    <Frame
      summary={`${n} สัปดาห์ล่าสุดขายเฉลี่ย ${fmtBaht(late)}/สัปดาห์ ${change >= 0 ? "โตขึ้น" : "ลดลง"} ${pct(Math.abs(change))} เทียบกับ ${n} สัปดาห์แรก`}
      note={`รวมรายสัปดาห์ (จันทร์–อาทิตย์) เฉพาะสัปดาห์ที่มีข้อมูลครบ 7 วัน · ${data.length} สัปดาห์`}
    >
      <LineChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e7e5e4" />
        <XAxis dataKey="week" tickFormatter={thaiDate} minTickGap={48} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} />
        <YAxis tickFormatter={fmtShortBaht} tick={{ fontSize: 11, fill: MUTED }} width={60} tickLine={false} axisLine={false} domain={[0, "auto"]} />
        <Tooltip content={<Tip title={(d) => `สัปดาห์เริ่ม ${thaiDate(d.week)}`} lines={(d) => [fmtBaht(d.revenue)]} />} />
        <Line dataKey="revenue" stroke={MAIN} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </Frame>
  );
}

/**
 * กราฟ 4 · เดือนล่าสุดยอดตกจริงไหม
 * แก้: ยอดรวมรายเดือน → "ยอดเฉลี่ยต่อวัน" รายเดือน, เดือนที่ข้อมูลไม่ครบเป็นแท่งสีจาง + ดอกจัน,
 *      เอาป้าย "ยอดตก! ⚠️" สีแดงออก
 * เหตุผล: เดือนที่มีข้อมูลไม่ครบ ยอดรวมย่อมต่ำเสมอ ต้องหารด้วยจำนวนวันที่มีข้อมูลก่อนจึงเทียบกันได้
 */
export function FixedChart4({ rows }) {
  const data = useMemo(
    () => monthlyRevenue(rows).map((m) => ({ ...m, full: daysInMonth(m.month), partial: m.days < daysInMonth(m.month) })),
    [rows]
  );
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const change = (last.perDay - prev.perDay) / prev.perDay;
  const partialMonths = new Set(data.filter((d) => d.partial).map((d) => d.month));
  return (
    <Frame
      summary={`${thaiMonth(last.month)} มีข้อมูล ${last.days}/${last.full} วัน · เฉลี่ย ${fmtBaht(last.perDay)}/วัน ${change >= 0 ? "สูงกว่า" : "ต่ำกว่า"} ${thaiMonth(prev.month)} ${pct(Math.abs(change))}`}
      note="* แท่งสีจาง = เดือนที่ข้อมูลไม่ครบทั้งเดือน จึงเทียบด้วยยอดเฉลี่ยต่อวันแทนยอดรวม"
    >
      <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e7e5e4" />
        <XAxis
          dataKey="month"
          tickFormatter={(m) => (partialMonths.has(m) ? `${thaiMonth(m)}*` : thaiMonth(m))}
          interval={0} angle={-40} textAnchor="end" height={44}
          tick={{ fontSize: 10, fill: MUTED }} tickLine={false}
        />
        <YAxis tickFormatter={fmtShortBaht} tick={{ fontSize: 11, fill: MUTED }} width={52} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "#f5f5f4" }}
          content={<Tip title={(d) => thaiMonth(d.month)} lines={(d) => [`เฉลี่ย ${fmtBaht(d.perDay)} / วัน`, `ยอดรวม ${fmtBaht(d.revenue)}`, `ข้อมูล ${d.days} จาก ${d.full} วัน`]} />}
        />
        <Bar dataKey="perDay" radius={[3, 3, 0, 0]}>
          {data.map((d) => <Cell key={d.month} fill={MAIN} fillOpacity={d.partial ? 0.35 : 1} />)}
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 5 · ผู้จัดการสาขาไหนควรได้รับการพัฒนา
 * แก้: ยอดรวม → ยอดเฉลี่ยต่อวันที่มีการขาย, บอกจำนวนวันของแต่ละสาขา, เอาป้าย "แย่ที่สุด 👎" ออก
 * เหตุผล: อารีย์เปิดทีหลัง ยอดรวมจึงน้อยเพราะ "เวลาน้อย" ไม่ใช่เพราะ "ขายแย่"
 *        ยอดต่อวันเทียบกันได้ยุติธรรมกว่า (แต่ยังไม่พอจะตัดสินผู้จัดการ เพราะทำเลและประเภทสาขาต่างกัน)
 */
export function FixedChart5({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => b.perDay - a.perDay), [rows]);
  const low = data[data.length - 1];
  const lowTotal = data.reduce((min, d) => (d.revenue < min.revenue ? d : min));
  const label = ({ x, y, width, height, index }) => {
    const d = data[index];
    return (
      <text x={x + width + 8} y={y + height / 2} dominantBaseline="central" fontSize={12}>
        <tspan fill="#292524">{fmtBaht(d.perDay)}/วัน</tspan>
        <tspan fill={MUTED}>{`  · ${d.days} วัน`}</tspan>
      </text>
    );
  };
  return (
    <Frame
      summary={
        lowTotal.branch === low.branch
          ? `${low.branch}ต่ำสุดทั้งยอดรวมและยอดต่อวัน (${fmtBaht(low.perDay)}/วัน)`
          : `เทียบยอดต่อวันแล้ว ${low.branch}ต่ำสุด (${fmtBaht(low.perDay)}/วัน) ไม่ใช่${lowTotal.branch} ซึ่งมีข้อมูลแค่ ${lowTotal.days} วัน`
      }
      note="ยอดขายรวม ÷ จำนวนวันที่มีการขาย · ยังต้องดูทำเลและประเภทสาขาก่อนสรุปเรื่องผู้จัดการ"
    >
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 150 }}>
        <XAxis type="number" domain={[0, "dataMax"]} hide />
        <YAxis type="category" dataKey="branch" width={90} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "#f5f5f4" }}
          content={<Tip title={(d) => d.branch} lines={(d) => [`เฉลี่ย ${fmtBaht(d.perDay)} / วัน`, `ยอดรวม ${fmtBaht(d.revenue)} ใน ${d.days} วัน`]} />}
        />
        <Bar dataKey="perDay" fill={MAIN} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="perDay" content={label} />
        </Bar>
      </BarChart>
    </Frame>
  );
}
