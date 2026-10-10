// Lab 4.1–4.2 · ลูกค้าและเมนู: RFM, Cohort, ABC
import { useCallback, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, Cell, ReferenceLine,
} from "recharts";
import { AnalyticsShell, Card, ChartFrame, GlassTip, Pending, Insight, pct, thaiMonth, useChartKit } from "./ui.jsx";
import { useAnalytics } from "./useAnalytics.js";
import { SEGMENTS } from "../lib/analytics/rfm.js";
import { fmtBaht } from "../lib/metrics.js";
import ToyBoundary from "../components/ToyBoundary.jsx";
import { GhostHunt } from "./toys.jsx";

const SEG_TH = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));
const SEG_EMOJI = { Champions: "👑", Loyal: "💛", New: "🌱", "Need Attention": "👀", "At Risk": "⚠️", Lost: "👻" };

// ---------------- RFM ----------------
function RfmCard({ rfm, onPick, picked }) {
  const { c, anim, axis, grid, legend } = useChartKit();
  if (rfm.error) return <Card emoji="👑" title="RFM · กลุ่มลูกค้า"><Pending lab="Lab 4.1" error={rfm.error} /></Card>;
  const data = rfm.segments.map((s) => ({ ...s, label: `${SEG_EMOJI[s.segment]} ${SEG_TH[s.segment].th}` }));
  const ch = rfm.segments.find((s) => s.segment === "Champions");
  const risk = rfm.segments.find((s) => s.segment === "At Risk");
  const pick = (d) => onPick?.(d.payload?.segment ?? d.segment);
  return (
    <Card emoji="👑" title="RFM · กลุ่มลูกค้าสมาชิก" sub="สัดส่วนจำนวนลูกค้า เทียบกับสัดส่วนยอดซื้อ · คลิกแท่งหรือแถวเพื่อดูรายชื่อ (ลองกด 👻 ดูสิ)">
      <ChartFrame className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 52 }} barGap={3}>
            <defs>
              <linearGradient id="rfm-rev" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={c.accent} stopOpacity={0.55} />
                <stop offset="100%" stopColor={c.accent} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal={false} {...grid} />
            <XAxis type="number" tickFormatter={(v) => pct(v)} domain={[0, 0.45]} {...axis} />
            <YAxis type="category" dataKey="label" width={120} {...axis} tick={{ fontSize: 13, fill: c.ink2 }} />
            <Tooltip content={<GlassTip fmt={(v) => pct(v, 1)} />} cursor={{ fill: c.surface2, opacity: 0.7 }} />
            <Legend {...legend} />
            <Bar name="% ลูกค้า" dataKey="customerShare" fill={c.muted} fillOpacity={0.45} radius={[0, 6, 6, 0]}
                 isAnimationActive={anim} animationDuration={900} onClick={pick} style={{ cursor: "pointer" }} />
            <Bar name="% ยอดซื้อ" dataKey="revenueShare" fill="url(#rfm-rev)" radius={[0, 6, 6, 0]}
                 isAnimationActive={anim} animationBegin={250} animationDuration={1200} onClick={pick} style={{ cursor: "pointer" }}>
              {data.map((d) => <Cell key={d.segment} fill="url(#rfm-rev)" fillOpacity={picked && picked !== d.segment ? 0.3 : 1} />)}
              <LabelList dataKey="revenueShare" position="right" formatter={(v) => pct(v)} style={{ fontSize: 12, fill: c.ink, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <Insight>
        ลูกค้าชั้นยอด {ch.customers.toLocaleString()} คน ({pct(ch.customerShare)} ของสมาชิก) ทำยอด {pct(ch.revenueShare)} ·
        กลุ่มเสี่ยงหาย {risk.customers.toLocaleString()} คน ยังถือยอด {pct(risk.revenueShare)} เป็นเป้าหมายแรกของแคมเปญดึงกลับ
      </Insight>
      <div className="mt-4 overflow-x-auto">
        <table className="lab4-table w-full min-w-[560px] text-sm">
          <thead className="text-left"><tr><th className="py-2">กลุ่ม</th><th className="text-right">ลูกค้า</th><th className="text-right">ยอดซื้อ</th><th className="pl-4">ควรทำอะไร</th></tr></thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.segment} onClick={() => onPick?.(d.segment)} data-sound="select"
                  className={`cursor-pointer ${picked === d.segment ? "is-picked" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
                <td className="py-2 pl-2 text-ink">{d.label} <span className="text-xs text-muted">{d.segment}</span></td>
                <td className="text-right text-ink tabular-nums">{d.customers.toLocaleString()}</td>
                <td className="text-right font-medium text-ink tabular-nums">{fmtBaht(d.revenue)}</td>
                <td className="pl-4 text-ink-2">{SEG_TH[d.segment].action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------- Lab 4.1B · รายชื่อลูกค้าในกลุ่มที่เลือก ----------------
const CSV_COLUMNS = [
  ["id", "รหัสลูกค้า"], ["R", "ไม่ได้มา (วัน)"], ["F", "จำนวนบิล"], ["M", "ยอดซื้อรวม (บาท)"],
  ["r", "คะแนน R"], ["f", "คะแนน F"], ["m", "คะแนน M"], ["segment", "กลุ่ม"],
];

/** ดาวน์โหลดทั้งกลุ่มเป็น CSV · ใส่ BOM (﻿) ไว้หน้าไฟล์ ไม่งั้น Excel เปิดภาษาไทยเป็นตัวเพี้ยน */
function downloadCsv(list, segment, asOf) {
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const lines = [
    CSV_COLUMNS.map(([, th]) => th).join(","),
    ...list.map((c) => CSV_COLUMNS.map(([k]) => cell(k === "M" ? Math.round(c.M) : c[k])).join(",")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rfm-${segment.replace(/\s+/g, "-")}-${asOf ?? "data"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MEDAL = ["🥇", "🥈", "🥉"];

/** คะแนน R/F/M 1–5 เป็นจุด 5 จุด อ่านง่ายกว่าตัวเลข */
function ScoreDots({ v }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${v} จาก 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className="inline-block size-1.5 rounded-full" style={{ background: i <= v ? "var(--accent)" : "var(--line)" }} />
      ))}
    </span>
  );
}

function SegmentCustomers({ rfm, segment, onClose }) {
  // เรียงตามยอดซื้อรวมมากไปน้อย (คนที่มีมูลค่าสูงสุดควรได้รับการดูแลก่อน)
  const list = rfm.customers.filter((c) => c.segment === segment).sort((a, b) => b.M - a.M);
  const seg = SEG_TH[segment];
  // PDPA: รหัสลูกค้าโยงถึงตัวบุคคลได้ จึงให้อ่านคำเตือนและกดยืนยันก่อนดาวน์โหลดทุกครั้ง
  const [confirming, setConfirming] = useState(false);
  return (
    <Card
      emoji={SEG_EMOJI[segment]}
      title={`รายชื่อ${seg.th} (${segment})`}
      sub={`${list.length.toLocaleString()} คน · เรียงตามยอดซื้อรวม แสดง ${Math.min(15, list.length)} คนแรก · ควรทำ: ${seg.action}`}
      right={
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setConfirming(true)} disabled={!list.length || confirming}
                  className="lab4-btn rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-40">
            ⬇ ดาวน์โหลด CSV ({list.length.toLocaleString()} แถว)
          </button>
          <button onClick={onClose} aria-label="ปิดรายชื่อ"
                  className="rounded-full px-3 py-1.5 text-sm text-muted ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink">
            ✕ ปิด
          </button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted">🔒 ข้อมูลส่วนบุคคลของลูกค้า (PDPA) · ใช้เพื่อดูแลลูกค้าของร้านเท่านั้น</p>
      {confirming && (
        <div role="alertdialog" aria-labelledby="pdpa-title" className="lab4-demo pop mb-4 rounded-2xl p-4 text-sm">
          <p id="pdpa-title" className="font-semibold">🔒 ยืนยันการดาวน์โหลดข้อมูลส่วนบุคคล</p>
          <p className="mt-1">
            ไฟล์นี้มีรหัสสมาชิกและประวัติการซื้อของลูกค้า {list.length.toLocaleString()} คน ซึ่งเป็นข้อมูลส่วนบุคคลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            <li>ใช้เพื่อการตลาดและดูแลลูกค้าของร้านบ้านบรูเท่านั้น</li>
            <li>ห้ามส่งต่อหรือเผยแพร่ให้บุคคลภายนอก</li>
            <li>เก็บไว้ในเครื่องที่ปลอดภัย และลบไฟล์เมื่อใช้งานเสร็จ</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => { downloadCsv(list, segment, rfm.asOf); setConfirming(false); }}
                    className="lab4-btn rounded-full px-4 py-1.5 font-medium">
              ยืนยันและดาวน์โหลด
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-full px-4 py-1.5 ring-1 ring-current/40 hover:bg-surface/50">
              ยกเลิก
            </button>
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted">ไม่มีลูกค้าในกลุ่มนี้</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="lab4-table w-full min-w-[560px] text-sm">
            <thead className="text-left">
              <tr>
                <th className="py-2">#</th>
                <th>รหัส</th>
                <th className="text-right">ไม่ได้มา</th>
                <th className="text-right">บิล</th>
                <th className="text-right">ยอดซื้อ</th>
                <th className="pl-4 text-center">R · F · M</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 15).map((c, i) => (
                <tr key={c.id} style={{ animationDelay: `${i * 40}ms` }}>
                  <td className="py-2 text-muted tabular-nums">{MEDAL[i] ?? i + 1}</td>
                  <td className="font-mono text-ink">{c.id}</td>
                  <td className="text-right text-ink-2 tabular-nums">{c.R.toLocaleString()} วัน</td>
                  <td className="text-right text-ink-2 tabular-nums">{c.F.toLocaleString()}</td>
                  <td className="text-right font-medium text-ink tabular-nums">{fmtBaht(c.M)}</td>
                  <td className="pl-4 text-center" title={`${c.r}-${c.f}-${c.m}`}>
                    <span className="inline-flex items-center gap-2"><ScoreDots v={c.r} /><ScoreDots v={c.f} /><ScoreDots v={c.m} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------- Cohort ----------------
// ความเข้มของช่อง = ผสมสี accent กับพื้นการ์ด (รากที่สอง ให้ค่าน้อย ๆ ยังเห็นความต่าง)
const mix = (v) => 8 + 92 * Math.sqrt(Math.min(1, v));
const shade = (v) => `color-mix(in oklab, var(--accent) ${mix(v)}%, var(--surface-2))`;

function CohortCard({ cohort }) {
  if (cohort.error) return <Card emoji="🔁" title="Cohort · การกลับมาซื้อซ้ำ"><Pending lab="Lab 4.2" error={cohort.error} /></Card>;
  const MAXK = 12;
  const avg1 = (() => {
    const xs = cohort.cohorts.filter((c) => c.retention.length > 2).map((c) => c.retention[1]);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  })();
  return (
    <Card emoji="🔁" title="Cohort · การกลับมาซื้อซ้ำ" sub="แถว = เดือนแรกที่ซื้อ · คอลัมน์ = เดือนที่เท่าไรหลังจากนั้น · ช่องลายขีด = เดือนล่าสุดที่ข้อมูลยังไม่ครบ">
      <ChartFrame className="min-h-60">
        <div className="overflow-x-auto pb-2">
          <div className="inline-grid gap-[3px] text-xs tabular-nums" style={{ gridTemplateColumns: `72px 44px repeat(${MAXK + 1}, 40px)` }}>
            <div className="font-medium text-muted">เดือนแรก</div><div className="text-right font-medium text-muted">คน</div>
            {Array.from({ length: MAXK + 1 }, (_, k) => <div key={k} className="text-center font-medium text-muted">{k}</div>)}
            {cohort.cohorts.map((c, i) => (
              <Row key={c.cohort} c={c} i={i} MAXK={MAXK} partial={cohort.lastMonthPartial} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span>0%</span>
          <span className="h-2.5 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${shade(0)}, ${shade(0.1)}, ${shade(0.3)}, ${shade(0.6)}, ${shade(1)})` }} />
          <span>100% กลับมาซื้อ</span>
        </div>
      </ChartFrame>
      <Insight>
        โดยเฉลี่ยลูกค้าใหม่กลับมาซื้อในเดือนถัดไป {pct(avg1)} · ช่องแนวทแยงล่างขวาดูต่ำผิดปกติเพราะ{thaiMonth(cohort.lastMonth)}มีข้อมูล{" "}
        {cohort.daysInLastMonth} จาก {cohort.daysInMonth} วัน (กับดักเดียวกับกราฟ 4 ใน Lab 2.2)
      </Insight>
    </Card>
  );
}
function Row({ c, i, MAXK, partial }) {
  const last = c.retention.length - 1;
  return (
    <>
      <div className="py-1 text-ink-2">{thaiMonth(c.cohort)}</div>
      <div className="py-1 text-right text-muted">{c.size}</div>
      {Array.from({ length: MAXK + 1 }, (_, k) => {
        const v = c.retention[k];
        if (v === undefined) return <div key={k} />;
        const isPartial = partial && k === last && k > 0;
        return (
          <div key={k} title={`${thaiMonth(c.cohort)} เดือนที่ ${k}: ${pct(v, 1)}${isPartial ? " (เดือนไม่ครบ)" : ""}`}
               className="lab4-cell flex h-7 cursor-default items-center justify-center rounded-md"
               style={{
                 animationDelay: `${(i + k) * 28}ms`,
                 background: isPartial ? `repeating-linear-gradient(45deg, ${shade(v)}, ${shade(v)} 4px, var(--surface) 4px, var(--surface) 6px)` : shade(v),
                 color: mix(v) >= 60 ? "var(--surface)" : "var(--ink)",
                 fontWeight: mix(v) >= 60 ? 600 : 400,
               }}>
            {k === 0 ? "★" : Math.round(v * 100)}
          </div>
        );
      })}
    </>
  );
}

// ---------------- ABC ----------------
function AbcCard({ abc }) {
  const { c, anim, axis, grid } = useChartKit();
  if (abc.error) return <Card emoji="🏆" title="Pareto · ABC ของเมนู"><Pending lab="Lab 4.2" error={abc.error} /></Card>;
  const items = abc.items;
  const nA = items.filter((i) => i.cls === "A").length;
  const C = items.filter((i) => i.cls === "C");
  const fill = { A: c.accent, B: c.accentSoft, C: c.muted };
  const opacity = { A: 1, B: 0.95, C: 0.4 };
  const label = { A: "🥇 ตัวทำเงิน", B: "🥈 ตัวเสริม", C: "🪫 ตัวรั้งท้าย" };
  return (
    <Card emoji="🏆" title="Pareto · ABC ของเมนู" sub="แท่ง = สัดส่วนยอดขายแต่ละเมนู · เส้น = ยอดสะสม · แกนเดียวกันเป็น %">
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {["A", "B", "C"].map((k) => {
          const xs = items.filter((i) => i.cls === k);
          return (
            <div key={k} className="card rounded-2xl border border-line bg-surface-2/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                <i className="inline-block size-3 rounded-sm" style={{ background: fill[k], opacity: opacity[k] }} />กลุ่ม {k}
              </div>
              <div className="mt-1 text-2xl font-light text-ink tabular-nums">{xs.length} <span className="text-sm text-muted">เมนู</span></div>
              <div className="text-xs text-ink-2">{label[k]} · {pct(xs.reduce((s, i) => s + i.share, 0))}</div>
            </div>
          );
        })}
      </div>
      <ChartFrame className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="abc-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.ink} stopOpacity={0.12} />
                <stop offset="100%" stopColor={c.ink} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} {...grid} />
            <XAxis dataKey="rank" interval={4} {...axis} label={{ value: "อันดับเมนู", position: "insideBottomRight", offset: -2, fontSize: 12, fill: c.muted }} />
            <YAxis tickFormatter={(v) => pct(v)} domain={[0, 1]} width={44} {...axis} />
            <Tooltip cursor={{ fill: c.surface2, opacity: 0.7 }}
                     content={<GlassTip fmt={(v) => pct(v, 1)} labelFormat={(r) => { const it = items[r - 1]; return it ? `#${r} ${it.name} · กลุ่ม ${it.cls}` : r; }} />} />
            <ReferenceLine y={0.8} stroke={c.accent} strokeDasharray="5 5" label={{ value: "80%", position: "right", fontSize: 11, fill: c.accent }} />
            <Bar name="สัดส่วนยอดขาย" dataKey="share" radius={[5, 5, 0, 0]} isAnimationActive={anim} animationDuration={1000}>
              {items.map((i) => <Cell key={i.product_id} fill={fill[i.cls]} fillOpacity={opacity[i.cls]} />)}
            </Bar>
            <Line name="ยอดสะสม" type="monotone" dataKey="cumShare" stroke={c.ink} strokeWidth={2.5} dot={false}
                  activeDot={{ r: 5, fill: c.accent, stroke: c.surface, strokeWidth: 2 }}
                  isAnimationActive={anim} animationBegin={500} animationDuration={1400} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      <Insight>
        {nA} เมนูจาก {items.length} ทำยอด 80% · กลุ่ม C ({C.map((i) => i.name).join(", ")}) รวมกันแค่ {pct(C.reduce((s, i) => s + i.share, 0), 1)} ควรทบทวนก่อนเพิ่มเมนูใหม่
      </Insight>
    </Card>
  );
}

export default function CustomersTab({ source }) {
  const state = useAnalytics(source);
  const [picked, setPicked] = useState(null);
  const [hunt, setHunt] = useState(false);
  const endHunt = useCallback(() => setHunt(false), []);
  // เลือกกลุ่ม "หายไปแล้ว" = ปล่อยผีลูกค้าออกมาให้ไล่จับ
  const pick = (s) => {
    setPicked((p) => (p === s ? null : s));
    if (s === "Lost" && picked !== "Lost") setHunt(true);
  };
  return (
    <AnalyticsShell source={source} state={state} title="ลูกค้าและเมนู" emoji="👥" lab="Lab 4.1 – 4.2"
                    tagline="ใครคือลูกค้าตัวจริง ใครกำลังจะหาย และเมนูไหนแบกร้าน">
      {(d) => (
        <div className="space-y-6">
          <RfmCard rfm={d.rfm} picked={picked} onPick={pick} />
          {hunt && !d.rfm.error && (
            <ToyBoundary onError={endHunt}>
              <GhostHunt customers={d.rfm.segments.find((s) => s.segment === "Lost")?.customers ?? 0} onClose={endHunt} />
            </ToyBoundary>
          )}
          {picked && !d.rfm.error && <SegmentCustomers key={picked} rfm={d.rfm} segment={picked} onClose={() => setPicked(null)} />}
          <CohortCard cohort={d.cohort} />
          <AbcCard abc={d.abc} />
        </div>
      )}
    </AnalyticsShell>
  );
}
