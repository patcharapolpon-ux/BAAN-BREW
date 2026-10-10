// Lab 4.4–4.5 · พยากรณ์และวันผิดปกติ
// คำนวณในเบราว์เซอร์จาก analytics/daily (ยอดรายวันแยกสาขา ~2,700 แถว) จึงเปลี่ยนสาขาได้ทันทีโดยไม่อ่าน Firestore เพิ่ม
import { useCallback, useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceDot,
} from "recharts";
import { addDays } from "../lab3/time.js";
import { AnalyticsShell, Card, ChartFrame, Chip, GlassTip, Pending, Insight, Stat, thaiDay, useChartKit, DOWN, UP, DOWN_HEX, UP_HEX } from "./ui.jsx";
import { useAnalytics } from "./useAnalytics.js";
import { toSeries } from "../lib/analytics/daily.js";
import { seasonalForecast, backtest } from "../lib/analytics/forecast.js";
import { scoreAnomalies } from "../lib/analytics/anomaly.js";
import { fmtBaht, fmtShortBaht } from "../lib/metrics.js";
import ToyBoundary from "../components/ToyBoundary.jsx";
import { playSound } from "../lib/sound.js";
import { FortuneOverlay, SalesQuake } from "./toys.jsx";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
const HORIZON = 28;
const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const tryRun = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };
const fmtPct1 = (v) => `${v.toFixed(1)}%`;
const fmtMoney = (v) => fmtBaht(Math.round(v));
const tipMoney = (v) => (Array.isArray(v) ? `${fmtBaht(v[0])} – ${fmtBaht(v[1])}` : fmtBaht(v));

/** จุดกะพริบ "วันล่าสุด" แบบเดียวกับกราฟยอดรายวันหน้าแรก */
function PulseDot({ cx, cy, fill, stroke }) {
  if (cx == null || cy == null) return null;
  return (
    <g className="pulse-dot">
      <circle className="pulse-ring" cx={cx} cy={cy} r={6} fill={fill} />
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke={stroke} strokeWidth={2} />
    </g>
  );
}

function ForecastCard({ daily, abc }) {
  const { c, anim, axis, grid, legend } = useChartKit();
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
    return { bt, chart, next7, lastDate: last.date, lastRevenue: last.revenue };
  }), [daily, branch]);

  const r = result.value;
  return (
    <>
    <Card emoji="🔮" title="พยากรณ์ยอดขาย 28 วัน" sub="ค่าเฉลี่ยวันเดียวกันของสัปดาห์ 8 สัปดาห์ล่าสุด · แถบ = ช่วงที่คาดว่าครอบคลุมราว 80% ของวัน"
          right={<div className="flex flex-wrap gap-1.5" role="group" aria-label="เลือกสาขา">
            {[null, ...BRANCHES].map((b) => (
              <Chip key={b ?? "all"} active={branch === b} onClick={() => setBranch(b)}>{b ?? "รวม"}</Chip>
            ))}
          </div>}>
      {result.error ? <Pending lab="Lab 4.4" error={result.error} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <Stat icon="📦" label="คาดการณ์ 7 วันข้างหน้า" value={r.next7} format={fmtMoney} />
            <Stat icon="🎯" label="ย้อนทดสอบ 28 วัน: คลาดเคลื่อนเฉลี่ยต่อวัน" value={r.bt.mapeSeasonal} format={fmtPct1} note="วิธีดูวันในสัปดาห์" delay={120} />
            <Stat icon="📏" label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง" value={r.bt.mapeFlat} format={fmtPct1} note="ตัวเปรียบเทียบ" muted delay={240} />
          </div>
          <ChartFrame className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart key={branch ?? "all"} data={r.chart} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="fc-actual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.ink} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={c.ink} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fc-band" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={c.accent} stopOpacity={0.12} />
                  </linearGradient>
                  <filter id="fc-glow" x="-10%" y="-30%" width="120%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <CartesianGrid vertical={false} {...grid} />
                <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={36} {...axis} />
                <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} {...axis} />
                <Tooltip content={<GlassTip labelFormat={thaiDay} fmt={tipMoney} />} cursor={{ stroke: c.accent, strokeOpacity: 0.4 }} />
                <Legend {...legend} />
                <ReferenceLine x={r.lastDate} stroke={c.accent} strokeDasharray="3 3"
                               label={{ value: "◀ จริง | พยากรณ์ ▶", position: "insideTop", fontSize: 11, fill: c.accent }} />
                <Area name="ช่วงคาดการณ์" dataKey="band" stroke="none" fill="url(#fc-band)" isAnimationActive={anim} animationBegin={900} animationDuration={1000} />
                <Area name="ยอดจริง" dataKey="actual" stroke={c.ink} strokeWidth={2} fill="url(#fc-actual)" dot={false}
                      activeDot={{ r: 5, fill: c.ink, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={anim} animationDuration={1200} />
                <Line name="คาดการณ์" dataKey="forecast" stroke={c.accent} strokeWidth={2.5} strokeDasharray="7 5" dot={false} filter="url(#fc-glow)"
                      activeDot={{ r: 5, fill: c.accent, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={anim} animationBegin={1000} animationDuration={1200} />
                <ReferenceDot x={r.lastDate} y={r.lastRevenue} shape={(p) => <PulseDot {...p} fill={c.accent} stroke={c.surface} />} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartFrame>
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
    <details className="lab4-details mt-3 rounded-2xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-ink-2">
      <summary className="cursor-pointer font-medium text-ink">
        🧮 แถบสีจาง ๆ คำนวณจากอะไร? <span className="text-accent">({branch ?? "รวมทุกสาขา"}: ±{pctBand}%)</span>
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>ซ่อนยอดจริง 28 วันล่าสุด แล้วให้วิธี "ดูวันในสัปดาห์" พยากรณ์จากข้อมูลก่อนหน้า (ย้อนทดสอบ)</li>
        <li>ดูว่าแต่ละวันพลาดไปกี่ % เทียบกับค่าพยากรณ์ (ยอดจริง = พยากรณ์ × (1 + % พลาด))</li>
        <li>หาส่วนเบี่ยงเบนมาตรฐาน (SD) ของ % พลาดทั้ง 28 วัน แล้วคูณ 1.28 ได้ ±{pctBand}%</li>
        <li>แถบ = พยากรณ์ × (1 − {pctBand}%) ถึง พยากรณ์ × (1 + {pctBand}%) · ถ้าความคลาดเคลื่อนกระจายแบบระฆังคว่ำ ±1.28 SD จะครอบคลุมราว 80% ของวัน คือ 10 วันจะมีราว 8 วันที่ยอดจริงตกในแถบ</li>
      </ol>
      <p className="mt-2 text-muted">แถบกว้าง = ยอดรายวันของสาขานี้แกว่งมาก ทายยาก · แถบแคบ = ทายได้แม่น</p>
    </details>
  );
}

// Lab 4.4B · "ควรเตรียมของเท่าไร": ยอดคาดการณ์ 7 วัน × สัดส่วนยอดขายของเมนูกลุ่ม A (จาก ABC)
function PrepCard({ abc, next7, band, branch }) {
  const [showAll, setShowAll] = useState(false);
  const title = `ควรเตรียมของเท่าไร · 7 วันข้างหน้า${branch ? ` · สาขา${branch}` : ""}`;
  if (abc?.error || !abc?.items) return <Card emoji="🧺" title={title}><Pending lab="Lab 4.2 (ABC)" error={abc?.error ?? "ยังไม่มีผล ABC"} /></Card>;

  const items = abc.items.filter((i) => i.cls === "A").map((i) => ({ ...i, week: next7 * i.share }));
  const aShare = items.reduce((s, i) => s + i.share, 0);
  const maxWeek = Math.max(...items.map((i) => i.week));
  const shown = showAll ? items : items.slice(0, 10);
  return (
    <Card emoji="🧺" title={title}
          sub={`ยอดคาดการณ์ 7 วัน ${fmtBaht(next7)} × สัดส่วนยอดขายของเมนูกลุ่ม A ${items.length} เมนู (รวม ${(aShare * 100).toFixed(1)}% ของยอด)`}>
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat icon="🔮" label="ยอดคาดการณ์ 7 วัน" value={next7} format={fmtMoney} note="จากการ์ดพยากรณ์ด้านบน" />
        <Stat icon="☕" label={`เมนูกลุ่ม A ${items.length} เมนู ควรเตรียม`} value={next7 * aShare} format={fmtMoney} note={`${(aShare * 100).toFixed(1)}% ของยอดคาดการณ์`} delay={120} />
        <Stat icon="🛟" label="ถ้าเผื่อตามแถบคาดการณ์" value={next7 * aShare * (1 + band)} format={fmtMoney} note={`+${(band * 100).toFixed(0)}% กันของขาด (ขอบบนของแถบ)`} muted delay={240} />
      </div>
      <div className="mt-5 overflow-x-auto">
        <table key={branch ?? "all"} className="lab4-table w-full min-w-[520px] text-sm">
          <thead className="text-left">
            <tr>
              <th className="py-2">#</th>
              <th>เมนู</th>
              <th>หมวด</th>
              <th className="text-right">สัดส่วนยอด</th>
              <th className="w-48 text-right">ควรเตรียม 7 วัน</th>
              <th className="text-right">เฉลี่ยต่อวัน</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i, n) => (
              <tr key={i.product_id} style={{ animationDelay: `${n * 40}ms` }}>
                <td className="py-2 text-muted tabular-nums">{i.rank}</td>
                <td className="text-ink">{i.name}</td>
                <td><span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2 ring-1 ring-line">{i.category}</span></td>
                <td className="text-right text-ink-2 tabular-nums">{(i.share * 100).toFixed(1)}%</td>
                <td className="text-right">
                  <div className="font-medium text-ink tabular-nums">{fmtBaht(i.week)}</div>
                  <div className="lab4-bar ml-auto mt-1" style={{ width: `${(i.week / maxWeek) * 100}%`, background: "var(--accent)", animationDelay: `${200 + n * 40}ms` }} />
                </td>
                <td className="text-right text-muted tabular-nums">{fmtBaht(i.week / 7)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > 10 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-3 rounded-full px-3 py-1 text-sm text-accent ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent/50">
          {showAll ? "▲ แสดง 10 เมนูแรก" : `▼ ดูครบ ${items.length} เมนู`}
        </button>
      )}
      <Insight>
        ตัวเลขเป็นมูลค่าขาย (บาท) ไม่ใช่จำนวนแก้ว · สัดส่วนเมนูคิดจากทุกสาขาตลอดประวัติ
        {branch ? ` สาขา${branch}อาจขายเมนูไม่เหมือนภาพรวม ควรใช้เป็นจุดตั้งต้น แล้วปรับตามประสบการณ์หน้าร้าน` : " ใช้เป็นจุดตั้งต้นในการสั่งวัตถุดิบ"}
      </Insight>
    </Card>
  );
}

// Lab 4.5B · ซูมดูสาขานั้น ±28 วันรอบวันที่คลิก: ยอดจริง เทียบเส้นประ "ค่าปกติ" จาก scoreAnomalies
function FocusChart({ all, focus, onClose }) {
  const { c, anim, axis, grid, legend } = useChartKit();
  const from = addDays(focus.date, -28);
  const to = addDays(focus.date, 28);
  // all มีทุกวันที่คำนวณได้ (รวมวันหยุด) จึงได้ทั้งยอดจริงและค่าปกติของแต่ละวันในช่วงนี้
  const data = all
    .filter((a) => a.branch === focus.branch && a.date >= from && a.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
  const low = focus.change < 0;
  const hex = low ? DOWN_HEX : UP_HEX;
  return (
    <div className="pop mb-5 rounded-2xl border p-4" style={{ borderColor: `color-mix(in oklab, ${hex} 45%, var(--line))`, background: `color-mix(in oklab, ${hex} 6%, var(--surface))` }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">
            🔍 สาขา{focus.branch} · {thaiDay(focus.date)}{" "}
            <span style={{ color: low ? DOWN : UP }}>
              {low ? "▼ ต่ำกว่าปกติ" : "▲ สูงกว่าปกติ"} {Math.round(Math.abs(focus.change) * 100)}%
            </span>
          </div>
          <div className="text-xs text-muted">±28 วันรอบวันที่เลือก · เส้นประ = ค่าปกติ (ค่ากลางของวันเดียวกันของสัปดาห์ 8 สัปดาห์ก่อน)</div>
        </div>
        <button onClick={onClose} aria-label="ปิดกราฟ"
                className="rounded-full px-3 py-1 text-sm text-muted ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink">
          ✕ ปิด
        </button>
      </div>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="focus-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hex} stopOpacity={0.25} />
                <stop offset="100%" stopColor={hex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} {...grid} />
            <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={28} {...axis} />
            <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} {...axis} />
            <Tooltip cursor={{ stroke: hex, strokeOpacity: 0.4 }} content={<GlassTip fmt={(v) => fmtBaht(v)} labelFormat={(d) => {
              const h = data.find((x) => x.date === d)?.holiday;
              return `${thaiDay(d)}${h ? ` · ${h}` : ""}`;
            }} />} />
            <Legend {...legend} />
            <ReferenceLine x={focus.date} stroke={hex} strokeOpacity={0.5} strokeWidth={8} />
            <Area name="ยอดจริง" dataKey="actual" stroke={c.ink} strokeWidth={2} fill="url(#focus-fill)" dot={false} isAnimationActive={anim} animationDuration={900} />
            <Line name="ค่าปกติ" dataKey="expected" stroke={c.muted} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={anim} animationBegin={300} animationDuration={900} />
            <ReferenceDot x={focus.date} y={focus.actual} shape={(p) => <PulseDot {...p} fill={hex} stroke={c.surface} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const MEDAL = ["🥇", "🥈", "🥉"];

function AnomalyCard({ daily, holidays }) {
  const [focus, setFocus] = useState(null);
  const [quake, setQuake] = useState(null);
  const endQuake = useCallback(() => setQuake(null), []);
  const result = useMemo(() => tryRun(() => scoreAnomalies(daily, holidays)), [daily, holidays]);
  if (result.error) return <Card emoji="🚨" title="วันที่ยอดขายผิดปกติ"><Pending lab="Lab 4.5" error={result.error} /></Card>;
  const all = result.value;
  const top = all.filter((a) => !a.holiday).slice(0, 15);
  const holidayHits = all.filter((a) => a.holiday).slice(0, 5);
  const maxChange = Math.max(...top.map((a) => Math.abs(a.change)));
  return (
    <Card emoji="🚨" title="วันที่ยอดขายผิดปกติ 15 อันดับ"
          sub="เทียบกับค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน · ไม่นับวันหยุดราชการ · คลิกแถวเพื่อซูม (อันดับ 🥇 ระวังแผ่นดินไหว)">
      {quake && <ToyBoundary onError={endQuake}><SalesQuake key={quake.date + quake.branch} anomaly={quake} onDone={endQuake} /></ToyBoundary>}
      {focus && <FocusChart key={focus.date + focus.branch} all={all} focus={focus} onClose={() => setFocus(null)} />}
      <div className="overflow-x-auto">
        <table className="lab4-table w-full min-w-[640px] text-sm tabular-nums">
          <thead className="text-left">
            <tr><th className="py-2">#</th><th>วันที่</th><th>สาขา</th>
              <th className="text-right">ยอดจริง</th><th className="text-right">ปกติ</th><th className="w-52 pl-4">ต่างจากปกติ</th></tr>
          </thead>
          <tbody>
            {top.map((a, i) => {
              const sel = focus && focus.date === a.date && focus.branch === a.branch;
              const low = a.change < 0;
              return (
                <tr key={a.date + a.branch} onClick={() => { setFocus(sel ? null : a); if (!sel && i === 0) setQuake(a); }} data-sound="select"
                    className={`cursor-pointer ${sel ? "is-picked" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                  <td className="py-2 pl-2 text-muted"><span className={i === 0 ? "lab4-siren" : ""}>{MEDAL[i] ?? i + 1}</span></td>
                  <td className="text-ink">{thaiDay(a.date)} <span className="text-muted">{new Date(a.date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short" })}</span></td>
                  <td className="text-ink-2">{a.branch}</td>
                  <td className="text-right text-ink">{fmtBaht(a.actual)}</td>
                  <td className="text-right text-muted">{fmtBaht(a.expected)}</td>
                  <td className="pl-4">
                    <span className="font-medium" style={{ color: low ? DOWN : UP }}>
                      {low ? "▼ ต่ำกว่าปกติ" : "▲ สูงกว่าปกติ"} {Math.round(Math.abs(a.change) * 100)}%
                    </span>
                    <div className="lab4-bar mt-1" style={{ width: `${(Math.abs(a.change) / maxChange) * 100}%`, background: low ? DOWN_HEX : UP_HEX, animationDelay: `${200 + i * 40}ms` }} />
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
  const [ball, setBall] = useState(false);
  const closeBall = useCallback(() => setBall(false), []);
  return (
    <AnalyticsShell source={source} state={state} title="พยากรณ์และวันผิดปกติ" emoji="🔮" lab="Lab 4.4 – 4.5"
                    tagline="สัปดาห์หน้าจะขายได้เท่าไร และวันไหนที่ยอดแปลกจนต้องโทรถาม"
                    emojiHint="ให้ลูกแก้วทำนายยอดพรุ่งนี้" onEmoji={() => { playSound("secret"); setBall(true); }}>
      {(d) => d.daily.error ? <Pending lab="pipeline" error={d.daily.error} /> : (
        <div className="space-y-6">
          {ball && <ToyBoundary onError={closeBall}><FortuneOverlay daily={d.daily.rows} abc={d.abc} onClose={closeBall} /></ToyBoundary>}
          {d.meta.alerts?.length > 0 && (
            <p role="alert" className="lab4-alert rounded-2xl p-4 text-sm font-medium">
              <span className="lab4-siren mr-1" aria-hidden="true">🚨</span> ยอดวันล่าสุดผิดปกติ: {d.meta.alerts.map((a) => `${a.branch} ${fmtBaht(a.actual)} (ปกติ ${fmtBaht(a.expected)})`).join(", ")}
            </p>
          )}
          <ForecastCard daily={d.daily.rows} abc={d.abc} />
          <AnomalyCard daily={d.daily.rows} holidays={d.meta.holidays ?? {}} />
        </div>
      )}
    </AnalyticsShell>
  );
}
