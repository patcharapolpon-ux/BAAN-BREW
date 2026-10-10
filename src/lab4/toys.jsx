// ของเล่นของแท็บ Lab 4: หมอดูยอดขาย 🔮, ไล่จับผีลูกค้า 👻, แผ่นดินไหวยอดขาย 🌋
// ตัวเลขทุกตัวมาจากผลวิเคราะห์จริง (ตรรกะอยู่ใน src/lib/lab4Toys.js) ส่วนคำพูดสุ่มเอาฮา
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Overlay from "../components/Overlay.jsx";
import { useReducedMotion } from "../lib/motion.js";
import { playSound } from "../lib/sound.js";
import { showToast } from "../lib/toast.js";
import { fortune, ghostCount, richter, shakePx, wonBack } from "../lib/lab4Toys.js";
import { toSeries } from "../lib/analytics/daily.js";
import { seasonalForecast, backtest } from "../lib/analytics/forecast.js";
import { fmtBaht } from "../lib/metrics.js";
import { DOWN, DOWN_HEX, UP, UP_HEX, thaiDay } from "./ui.jsx";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];

// ---------------- 🔮 หมอดูยอดขาย ----------------
/** พยากรณ์ "พรุ่งนี้" ของทุกสาขา (วันแรกของ seasonalForecast) พร้อมความกว้างแถบจากการย้อนทดสอบ */
function useTomorrow(daily) {
  return useMemo(() => {
    try {
      const branches = BRANCHES.map((branch) => {
        const series = toSeries(daily, branch);
        const [next] = seasonalForecast(series, 1);
        return { branch, forecast: next.forecast, band: backtest(series, 28).band, date: next.date };
      });
      return { branches, date: branches[0].date };
    } catch (e) {
      return { error: e.message };
    }
  }, [daily]);
}

function Typewriter({ text }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 28);
    return () => clearInterval(t);
  }, [text, reduced]);
  const shown = reduced ? text.length : n;
  return (
    <p className="min-h-48 whitespace-pre-line text-left text-base leading-relaxed text-ink sm:text-lg" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      {shown < text.length && <span className="lab4-caret" aria-hidden="true">▍</span>}
    </p>
  );
}

export function FortuneOverlay({ daily, abc, onClose }) {
  const base = useTomorrow(daily);
  const [roll, setRoll] = useState(0);
  const menus = useMemo(() => abc?.items?.filter((i) => i.cls === "A").map((i) => i.name) ?? [], [abc]);
  // roll อยู่ใน deps เพื่อให้กด "เขย่าใหม่" แล้วสุ่มคำทำนายใหม่
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const f = useMemo(() => (base.error ? null : fortune({ branches: base.branches, menus, date: base.date })), [base, menus, roll]);

  const text = f && [
    `ดวงวัน${f.weekday}ที่ ${thaiDay(f.date)}`,
    `${f.omen}…`,
    ``,
    `✨ สาขา${f.branch} จะขายได้ราว ${fmtBaht(f.forecast)}`,
    `(ฟ้าลิขิตไว้ระหว่าง ${fmtBaht(f.low)} – ${fmtBaht(f.high)})`,
    f.menu ? `☕ โชคลาภอยู่ที่ "${f.menu}"` : null,
    `🎲 เลขนำโชค ${String(f.lucky).padStart(2, "0")}`,
    `📜 คำแนะนำ: ${f.advice}`,
  ].filter((l) => l !== null).join("\n");

  return (
    <Overlay title="หมอดูยอดขาย" onClose={onClose} className="lab4-mystic max-w-xl text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="lab4-smoke" style={{ left: `${8 + i * 13}%`, animationDelay: `${i * -0.9}s` }} />
        ))}
      </div>
      <div className="relative">
        <div className="lab4-ball mx-auto grid size-28 place-items-center rounded-full text-7xl" aria-hidden="true">🔮</div>
        <h2 className="shimmer mt-4 font-display text-2xl font-bold">หมอดูยอดขายบ้านบรู</h2>
        <p className="text-xs text-muted">ทำนายแม่นราว ± {f ? Math.round(f.band * 100) : "–"}% (เท่ากับแถบในกราฟ ไม่ได้มั่ว 😌)</p>
        <div className="mt-5 rounded-2xl border border-line bg-surface-2/60 p-4 sm:p-5">
          {base.error ? <p className="text-muted">ลูกแก้วขุ่นมัว: {base.error}</p> : <Typewriter key={roll} text={text} />}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="lab4-btn rounded-full px-5 py-2 font-medium"
                  onClick={() => { playSound("secret"); setRoll((r) => r + 1); }}>
            🔁 เขย่าลูกแก้วใหม่
          </button>
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 text-muted ring-1 ring-line hover:text-ink">พอแล้ว ขอบคุณหมอ</button>
        </div>
        <p className="mt-4 text-xs text-muted">ตัวเลขมาจากผลพยากรณ์จริง (ค่าเฉลี่ยวันเดียวกันของสัปดาห์) · คำทำนายสุ่มเอาฮา</p>
      </div>
    </Overlay>
  );
}

// ---------------- 👻 ไล่จับผีลูกค้า ----------------
export function GhostHunt({ customers, onClose }) {
  const reduced = useReducedMotion();
  const [ghosts] = useState(() =>
    Array.from({ length: ghostCount(customers) }, (_, i) => ({
      id: i,
      top: 14 + Math.random() * 68,
      dur: 8 + Math.random() * 8,
      delay: -Math.random() * 12,
      reverse: i % 2 === 1,
      size: 2.2 + Math.random() * 1.6,
    })),
  );
  const [caught, setCaught] = useState(() => new Set());
  const total = ghosts.length;
  const done = caught.size >= total;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [done, onClose]);

  const grab = (id) => {
    if (caught.has(id)) return;
    const next = new Set(caught).add(id);
    setCaught(next);
    if (next.size >= total) {
      playSound("fanfare");
      showToast({ icon: "☕", title: "ดึงลูกค้ากลับครบแล้ว!", text: `${customers.toLocaleString()} คนกลับมาเป็นลูกค้า (ในจินตนาการ 😆)` });
    } else playSound("ding");
  };

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {ghosts.map((g, i) => {
        const got = caught.has(g.id);
        return (
          <span key={g.id} className={`absolute ${reduced ? "" : g.reverse ? "lab4-ghost-l" : "lab4-ghost-r"}`}
                style={{
                  top: `${g.top}%`,
                  left: reduced ? `${6 + (i * 86) / total}%` : undefined,
                  animationDuration: `${g.dur}s`,
                  animationDelay: `${g.delay}s`,
                  animationPlayState: got ? "paused" : "running",
                }}>
            <button type="button" aria-label={got ? "จับได้แล้ว" : "จับผี"} disabled={got} onClick={() => grab(g.id)}
                    className={`pointer-events-auto block select-none ${got ? "lab4-caught" : "lab4-ghost-bob cursor-crosshair"}`}
                    style={{ fontSize: `${g.size}rem`, animationDelay: `${g.delay}s` }}>
              {got ? "☕" : "👻"}
            </button>
          </span>
        );
      })}
      <div role="status" className="pop pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-surface/85 py-1.5 pr-1.5 pl-4 text-sm shadow-card backdrop-blur-md">
        <span className="text-ink">
          {done ? "🎉 จับครบแล้ว!" : "👻 ไล่จับผีลูกค้าที่หายไป!"}{" "}
          <span className="text-muted">ดึงกลับแล้ว</span>{" "}
          <b className="text-accent tabular-nums">{wonBack(caught.size, total, customers).toLocaleString()}</b>
          <span className="text-muted"> / {customers.toLocaleString()} คน</span>
        </span>
        <button type="button" onClick={onClose} aria-label="เลิกจับผี" className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">✕</button>
      </div>
    </div>,
    document.body,
  );
}

// ---------------- 🌋 แผ่นดินไหวยอดขาย ----------------
/** เส้นเครื่องวัดแผ่นดินไหว: สั่นแรงสุดตรงกลาง ยิ่งริกเตอร์สูงยิ่งแกว่งกว้าง */
function seismoPath(mag) {
  const amp = 4 + (mag - 4) * 3.2;
  const pts = Array.from({ length: 121 }, (_, i) => {
    const x = (i / 120) * 300;
    const env = Math.exp(-(((i - 55) / 22) ** 2));
    const y = 30 + (Math.random() * 2 - 1) * (1.5 + amp * env);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts.join(" L")}`;
}

export function SalesQuake({ anomaly, onDone }) {
  const reduced = useReducedMotion();
  const mag = richter(anomaly.change);
  const [path] = useState(() => seismoPath(mag));
  const low = anomaly.change < 0;

  useEffect(() => {
    const root = document.documentElement;
    playSound("rumble");
    if (!reduced) {
      root.style.setProperty("--quake", `${shakePx(mag)}px`);
      root.classList.add("lab4-quake");
    }
    const stop = setTimeout(() => root.classList.remove("lab4-quake"), 1500);
    const end = setTimeout(onDone, 3600);
    return () => {
      clearTimeout(stop);
      clearTimeout(end);
      root.classList.remove("lab4-quake");
    };
  }, [mag, reduced, onDone]);

  return createPortal(
    <div role="alert" className="pop fixed top-24 left-1/2 z-[60] w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border bg-surface/90 p-4 shadow-card backdrop-blur-md"
         style={{ borderColor: low ? DOWN_HEX : UP_HEX }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">🌋 แผ่นดินไหวยอดขาย!</p>
          <p className="text-xs text-muted">สาขา{anomaly.branch} · {thaiDay(anomaly.date)}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums" style={{ color: low ? DOWN : UP }}>{mag.toFixed(1)}</div>
          <div className="text-[10px] tracking-widest text-muted">ริกเตอร์</div>
        </div>
      </div>
      <svg viewBox="0 0 300 60" className="mt-2 h-14 w-full" aria-hidden="true">
        <line x1="0" y1="30" x2="300" y2="30" stroke="var(--line)" strokeDasharray="2 4" />
        <path d={path} pathLength="1" className="lab4-seismo" fill="none" stroke={low ? DOWN_HEX : UP_HEX} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <p className="text-sm font-medium" style={{ color: low ? DOWN : UP }}>
        {low ? "▼ ต่ำกว่าปกติ" : "▲ สูงกว่าปกติ"} {Math.round(Math.abs(anomaly.change) * 100)}% · ยอด {fmtBaht(anomaly.actual)} (ปกติ {fmtBaht(anomaly.expected)})
      </p>
    </div>,
    document.body,
  );
}
