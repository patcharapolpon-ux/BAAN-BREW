// Lab 4.4–4.5 · พยากรณ์และวันผิดปกติ
// คำนวณในเบราว์เซอร์จาก analytics/daily (ยอดรายวันแยกสาขา ~2,700 แถว) จึงเปลี่ยนสาขาได้ทันทีโดยไม่อ่าน Firestore เพิ่ม
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceDot,
} from "recharts";
import { addDays } from "../lab3/time.js";
import { AnalyticsShell, Card, Pending, Insight, MAIN, GREEN, MUTED, INK, thaiDay } from "./ui.jsx";
import { useAnalytics } from "./useAnalytics.js";
import { toSeries } from "../lib/analytics/daily.js";
import { seasonalForecast, backtest } from "../lib/analytics/forecast.js";
import { scoreAnomalies } from "../lib/analytics/anomaly.js";
import { fmtBaht, fmtShortBaht } from "../lib/metrics.js";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
const HORIZON = 28;
const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const tryRun = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };

function ForecastCard({ daily, abc }) {
  const [branch, setBranch] = useState(null);
  const result = useMemo(() => tryRun(() => {
    const series = toSeries(daily, branch);
    const bt = backtest(series, HORIZON);
    const fc = seasonalForecast(series, HORIZON);
    const recent = series.slice(-56);
    const last = recent[recent.length - 1];
    const chart = [
      ...recent.map((s) => ({ date: s.date, actual: s.revenue })),
      ...fc.map((f) => ({ date: f.date, forecast: f.forecast, band: [f.forecast * (1 - bt.band), f.forecast * (1 + bt.band)] })),
    ];
    chart[recent.length - 1] = { ...chart[recent.length - 1], forecast: last.revenue }; // ต่อเส้นให้ไม่ขาด
    const next7 = fc.slice(0, 7).reduce((s, f) => s + f.forecast, 0);
    return { bt, chart, next7, lastDate: last.date };
  }), [daily, branch]);

  const r = result.value;
  return (
    <>
    <Card title="พยากรณ์ยอดขาย 28 วัน" sub="ค่าเฉลี่ยวันเดียวกันของสัปดาห์ 8 สัปดาห์ล่าสุด · แถบ = ช่วงที่คาดว่าครอบคลุมราว 80% ของวัน"
          right={<div className="flex flex-wrap gap-1">
            {[null, ...BRANCHES].map((b) => (
              <button key={b ?? "all"} onClick={() => setBranch(b)}
                      className={`rounded-lg px-2.5 py-1 text-sm ${branch === b ? "bg-stone-900 text-white" : "text-stone-600 ring-1 ring-stone-200"}`}>{b ?? "รวม"}</button>
            ))}
          </div>}>
      {result.error ? <Pending lab="Lab 4.4" error={result.error} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
            <Stat label="ย้อนทดสอบ 28 วัน: คลาดเคลื่อนเฉลี่ยต่อวัน" value={`${r.bt.mapeSeasonal.toFixed(1)}%`} note="วิธีดูวันในสัปดาห์" />
            <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง" value={`${r.bt.mapeFlat.toFixed(1)}%`} note="ตัวเปรียบเทียบ" muted />
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eee" />
                <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={36} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={thaiDay} formatter={(v, n) => [Array.isArray(v) ? `${fmtBaht(v[0])} – ${fmtBaht(v[1])}` : fmtBaht(v), n]} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <ReferenceLine x={r.lastDate} stroke={MUTED} strokeDasharray="3 3" label={{ value: "ข้อมูลถึง", position: "insideTopLeft", fontSize: 11, fill: INK }} />
                <Area name="ช่วงคาดการณ์" dataKey="band" stroke="none" fill={GREEN[1]} isAnimationActive={false} />
                <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name="คาดการณ์" dataKey="forecast" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Insight>
            {r.bt.mapeFlat > r.bt.mapeSeasonal * 1.5
              ? `${branch ?? "ภาพรวม"}: การดูวันในสัปดาห์ช่วยลดความคลาดเคลื่อนจาก ${r.bt.mapeFlat.toFixed(0)}% เหลือ ${r.bt.mapeSeasonal.toFixed(0)}% เพราะยอดวันธรรมดากับเสาร์-อาทิตย์ต่างกันมาก`
              : `${branch ?? "ภาพรวม"}: สองวิธีแม่นพอ ๆ กัน (${r.bt.mapeSeasonal.toFixed(0)}% กับ ${r.bt.mapeFlat.toFixed(0)}%) ${branch ? "" : "เพราะสาขาออฟฟิศกับห้างขายดีคนละวัน พอรวมกันรูปแบบรายสัปดาห์จึงหักล้างกัน"}`}
            {" "}ใช้วางแผนสต็อกและกะพนักงานรายสัปดาห์ได้ แต่ไม่ควรใช้ตัดสินยอดรายวันของสาขาเดียว
          </Insight>
          <BandNote bt={r.bt} branch={branch} />
        </>
      )}
    </Card>
    {r && <PrepCard abc={abc} next7={r.next7} band={r.bt.band} branch={branch} />}
    </>
  );
}

// Lab 4.4B · อธิบายว่าแถบช่วงคาดการณ์มาจากไหน (ตัวเลขเปลี่ยนตามสาขาที่เลือก)
function BandNote({ bt, branch }) {
  const pctBand = (bt.band * 100).toFixed(0);
  return (
    <details className="mt-3 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600">
      <summary className="cursor-pointer font-medium text-stone-700">
        แถบสีเขียวอ่อนคำนวณจากอะไร? ({branch ?? "รวมทุกสาขา"}: ±{pctBand}%)
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>ซ่อนยอดจริง 28 วันล่าสุด แล้วให้วิธี "ดูวันในสัปดาห์" พยากรณ์จากข้อมูลก่อนหน้า (ย้อนทดสอบ)</li>
        <li>ดูว่าแต่ละวันพลาดไปกี่ % เทียบกับค่าพยากรณ์ (ยอดจริง = พยากรณ์ × (1 + % พลาด))</li>
        <li>หาส่วนเบี่ยงเบนมาตรฐาน (SD) ของ % พลาดทั้ง 28 วัน แล้วคูณ 1.28 ได้ ±{pctBand}%</li>
        <li>แถบ = พยากรณ์ × (1 − {pctBand}%) ถึง พยากรณ์ × (1 + {pctBand}%) · ถ้าความคลาดเคลื่อนกระจายแบบระฆังคว่ำ ±1.28 SD จะครอบคลุมราว 80% ของวัน คือ 10 วันจะมีราว 8 วันที่ยอดจริงตกในแถบ</li>
      </ol>
      <p className="mt-2 text-stone-500">แถบกว้าง = ยอดรายวันของสาขานี้แกว่งมาก ทายยาก · แถบแคบ = ทายได้แม่น</p>
    </details>
  );
}

// Lab 4.4B · "ควรเตรียมของเท่าไร": ยอดคาดการณ์ 7 วัน × สัดส่วนยอดขายของเมนูกลุ่ม A (จาก ABC)
function PrepCard({ abc, next7, band, branch }) {
  const [showAll, setShowAll] = useState(false);
  const title = `ควรเตรียมของเท่าไร · 7 วันข้างหน้า${branch ? ` · สาขา${branch}` : ""}`;
  if (abc?.error || !abc?.items) return <Card title={title}><Pending lab="Lab 4.2 (ABC)" error={abc?.error ?? "ยังไม่มีผล ABC"} /></Card>;

  const items = abc.items.filter((i) => i.cls === "A").map((i) => ({ ...i, week: next7 * i.share }));
  const aShare = items.reduce((s, i) => s + i.share, 0);
  const shown = showAll ? items : items.slice(0, 10);
  return (
    <Card title={title}
          sub={`ยอดคาดการณ์ 7 วัน ${fmtBaht(next7)} × สัดส่วนยอดขายของเมนูกลุ่ม A ${items.length} เมนู (รวม ${(aShare * 100).toFixed(1)}% ของยอด)`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="ยอดคาดการณ์ 7 วัน" value={fmtBaht(next7)} note="จากการ์ดพยากรณ์ด้านบน" />
        <Stat label={`เมนูกลุ่ม A ${items.length} เมนู ควรเตรียม`} value={fmtBaht(next7 * aShare)} note={`${(aShare * 100).toFixed(1)}% ของยอดคาดการณ์`} />
        <Stat label="ถ้าเผื่อตามแถบคาดการณ์" value={fmtBaht(next7 * aShare * (1 + band))} note={`+${(band * 100).toFixed(0)}% กันของขาด (ขอบบนของแถบ)`} muted />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-stone-500">
            <tr>
              <th className="py-1 font-medium">#</th>
              <th className="font-medium">เมนู</th>
              <th className="font-medium">หมวด</th>
              <th className="text-right font-medium">สัดส่วนยอด</th>
              <th className="text-right font-medium">ควรเตรียม 7 วัน</th>
              <th className="text-right font-medium">เฉลี่ยต่อวัน</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.product_id} className="border-t border-stone-100">
                <td className="py-1.5 text-stone-400 tabular-nums">{i.rank}</td>
                <td>{i.name}</td>
                <td className="text-stone-500">{i.category}</td>
                <td className="text-right tabular-nums">{(i.share * 100).toFixed(1)}%</td>
                <td className="text-right font-medium tabular-nums">{fmtBaht(i.week)}</td>
                <td className="text-right tabular-nums text-stone-500">{fmtBaht(i.week / 7)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > 10 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm text-stone-600 underline hover:text-stone-900">
          {showAll ? "แสดง 10 เมนูแรก" : `ดูครบ ${items.length} เมนู`}
        </button>
      )}
      <Insight>
        ตัวเลขเป็นมูลค่าขาย (บาท) ไม่ใช่จำนวนแก้ว · สัดส่วนเมนูคิดจากทุกสาขาตลอดประวัติ
        {branch ? ` สาขา${branch}อาจขายเมนูไม่เหมือนภาพรวม ควรใช้เป็นจุดตั้งต้น แล้วปรับตามประสบการณ์หน้าร้าน` : " ใช้เป็นจุดตั้งต้นในการสั่งวัตถุดิบ"}
      </Insight>
    </Card>
  );
}

function Stat({ label, value, note, muted }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${muted ? "text-stone-500" : ""}`}>{value}</div>
      {note && <div className="text-xs text-stone-400">{note}</div>}
    </div>
  );
}

// Lab 4.5B · ซูมดูสาขานั้น ±28 วันรอบวันที่คลิก: ยอดจริง เทียบเส้นประ "ค่าปกติ" จาก scoreAnomalies
const LOW = "#dc2626";  // ต่ำกว่าปกติ = แดง
const HIGH = "#f59e0b"; // สูงกว่าปกติ = ส้ม
function FocusChart({ all, focus, onClose }) {
  const from = addDays(focus.date, -28);
  const to = addDays(focus.date, 28);
  // all มีทุกวันที่คำนวณได้ (รวมวันหยุด) จึงได้ทั้งยอดจริงและค่าปกติของแต่ละวันในช่วงนี้
  const data = all
    .filter((a) => a.branch === focus.branch && a.date >= from && a.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
  const color = focus.change < 0 ? LOW : HIGH;
  return (
    <div className="mb-4 rounded-lg border border-stone-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            สาขา{focus.branch} · {thaiDay(focus.date)}{" "}
            <span style={{ color }}>
              {focus.change < 0 ? "▼ ต่ำกว่าปกติ" : "▲ สูงกว่าปกติ"} {Math.round(Math.abs(focus.change) * 100)}%
            </span>
          </div>
          <div className="text-xs text-stone-500">±28 วันรอบวันที่เลือก · เส้นประ = ค่าปกติ (ค่ากลางของวันเดียวกันของสัปดาห์ 8 สัปดาห์ก่อน)</div>
        </div>
        <button onClick={onClose} aria-label="ปิดกราฟ"
                className="rounded-lg px-3 py-1 text-sm text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100">
          ✕ ปิด
        </button>
      </div>
      <div className="mt-2 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eee" />
            <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={28} tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={(d) => {
              const h = data.find((x) => x.date === d)?.holiday;
              return `${thaiDay(d)}${h ? ` · ${h}` : ""}`;
            }} formatter={(v, n) => [fmtBaht(v), n]} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <ReferenceLine x={focus.date} stroke={color} strokeOpacity={0.4} />
            <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="ค่าปกติ" dataKey="expected" stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <ReferenceDot x={focus.date} y={focus.actual} r={6} fill={color} stroke="#fff" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AnomalyCard({ daily, holidays }) {
  const [focus, setFocus] = useState(null);
  const result = useMemo(() => tryRun(() => scoreAnomalies(daily, holidays)), [daily, holidays]);
  if (result.error) return <Card title="วันที่ยอดขายผิดปกติ"><Pending lab="Lab 4.5" error={result.error} /></Card>;
  const all = result.value;
  const top = all.filter((a) => !a.holiday).slice(0, 15);
  const holidayHits = all.filter((a) => a.holiday).slice(0, 5);
  return (
    <Card title="วันที่ยอดขายผิดปกติ 15 อันดับ"
          sub="เทียบกับค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน · ไม่นับวันหยุดราชการ">
      {focus && <FocusChart all={all} focus={focus} onClose={() => setFocus(null)} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm tabular-nums">
          <thead className="text-left text-stone-500">
            <tr><th className="py-1 font-medium">#</th><th className="font-medium">วันที่</th><th className="font-medium">สาขา</th>
              <th className="text-right font-medium">ยอดจริง</th><th className="text-right font-medium">ปกติ</th><th className="pl-4 font-medium">ต่างจากปกติ</th></tr>
          </thead>
          <tbody>
            {top.map((a, i) => {
              const sel = focus && focus.date === a.date && focus.branch === a.branch;
              return (
                <tr key={a.date + a.branch} onClick={() => setFocus(sel ? null : a)}
                    className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${sel ? "bg-emerald-50" : ""}`}>
                  <td className="py-1.5 text-stone-400">{i + 1}</td>
                  <td>{thaiDay(a.date)} <span className="text-stone-400">{new Date(a.date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short" })}</span></td>
                  <td>{a.branch}</td>
                  <td className="text-right">{fmtBaht(a.actual)}</td>
                  <td className="text-right text-stone-500">{fmtBaht(a.expected)}</td>
                  <td className="pl-4">
                    {a.change < 0
                      ? <span className="font-medium text-red-700">▼ ต่ำกว่าปกติ {Math.round(-a.change * 100)}%</span>
                      : <span className="font-medium text-amber-700">▲ สูงกว่าปกติ {Math.round(a.change * 100)}%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Insight>
        อันดับต้น ๆ คือวันที่ควรโทรถามผู้จัดการสาขาว่าเกิดอะไรขึ้น · ระบบบอกได้ว่า “ผิดปกติ” แต่บอกไม่ได้ว่า “เพราะอะไร”
        {holidayHits.length > 0 && <> · วันหยุดที่ยอดเปลี่ยนมากแต่ไม่นับ เช่น {holidayHits.slice(0, 3).map((h) => `${h.holiday} (${h.branch})`).join(", ")}</>}
      </Insight>
    </Card>
  );
}

export default function ForecastTab({ source }) {
  const state = useAnalytics(source);
  return (
    <AnalyticsShell source={source} state={state} title="พยากรณ์และวันผิดปกติ">
      {(d) => d.daily.error ? <Pending lab="pipeline" error={d.daily.error} /> : (
        <div className="space-y-6">
          {d.meta.alerts?.length > 0 && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              🚨 ยอดวันล่าสุดผิดปกติ: {d.meta.alerts.map((a) => `${a.branch} ${fmtBaht(a.actual)} (ปกติ ${fmtBaht(a.expected)})`).join(", ")}
            </p>
          )}
          <ForecastCard daily={d.daily.rows} abc={d.abc} />
          <AnomalyCard daily={d.daily.rows} holidays={d.meta.holidays ?? {}} />
        </div>
      )}
    </AnalyticsShell>
  );
}
