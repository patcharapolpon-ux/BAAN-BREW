import { authErrorText } from "../lab3/AuthBar.jsx";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useCountUp, useInView, useReducedMotion, useTilt } from "../lib/motion.js";

export const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
export const thaiDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
export const thaiMonth = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("th-TH", { month: "short", year: "2-digit" });

// สีขึ้น/ลง ผสมกับสีตัวอักษรของธีม: ธีมสว่างได้สีเข้ม ธีมมืดได้สีสว่าง อ่านออกทั้งสองแบบ
export const DOWN = "color-mix(in oklab, #e5484d 72%, var(--ink))";
export const UP = "color-mix(in oklab, #f5a524 68%, var(--ink))";
export const DOWN_HEX = "#e5484d";
export const UP_HEX = "#f5a524";

/**
 * อ่านสีจาก CSS token ของเว็บ (index.css) ให้กราฟ Recharts ใช้ เพราะ SVG attribute ใช้ var(--x) ไม่ได้ทุกเบราว์เซอร์
 * อ่านใหม่ทุกครั้งที่สลับธีม (data-theme) หรือเข้าโหมดนีออน (data-mode)
 */
export function useTokens() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setVersion((v) => v + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
    return () => obs.disconnect();
  }, []);
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const t = (n) => css.getPropertyValue(`--${n}`).trim();
    return {
      accent: t("accent"), accentSoft: t("accent-soft"), ink: t("ink"), ink2: t("ink-2"), muted: t("muted"),
      grid: t("grid"), line: t("line"), surface: t("surface"), surface2: t("surface-2"),
      cat: [1, 2, 3, 4, 5].map((i) => t(`cat-${i}`)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

/** ตั้งค่าแกน/เส้นตาราง/อนิเมชันของกราฟให้เหมือนกันทุกใบ */
export function useChartKit() {
  const c = useTokens();
  const reduced = useReducedMotion();
  return {
    c,
    anim: !reduced,
    axis: { tick: { fontSize: 12, fill: c.muted }, stroke: c.line, tickLine: false },
    grid: { stroke: c.grid, strokeDasharray: "3 5" },
    legend: { wrapperStyle: { fontSize: 13, color: c.ink2 } },
  };
}

// ---------------- การ์ด ----------------
const InViewContext = createContext(true);

/**
 * การ์ดหลักของ Lab 4: โผล่ขึ้นมาเมื่อเลื่อนถึง + แสงไฟตามเมาส์ (ใช้คลาส .card เดียวกับ KPI หน้ายอดขาย)
 * กราฟข้างในจะเริ่มวาดเมื่อการ์ดเข้าจอ (ดู ChartFrame)
 */
export function Card({ title, sub, children, right, emoji, delay = 0 }) {
  const [ref, inView] = useInView({ threshold: 0.08 });
  const tilt = useTilt({ max: 1.2 });
  return (
    <section ref={ref} className={`reveal ${inView ? "is-visible" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <div ref={tilt} className="card lab4-card rounded-3xl border border-line bg-surface/85 p-4 shadow-card backdrop-blur-sm sm:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {emoji && (
              <span className="card-icon grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl ring-1 ring-line" aria-hidden="true">
                {emoji}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink sm:text-xl">{title}</h2>
              {sub && <p className="mt-0.5 text-xs text-muted sm:text-sm">{sub}</p>}
            </div>
          </div>
          {right}
        </div>
        <div className="relative mt-4">
          <InViewContext.Provider value={inView}>{children}</InViewContext.Provider>
        </div>
      </div>
    </section>
  );
}

/** กล่องกราฟ: ก่อนการ์ดเข้าจอแสดงโครงกระพริบ พอเข้าจอค่อยวาด เพื่อให้อนิเมชันเล่นตอนผู้ใช้เห็นจริง */
export function ChartFrame({ className = "h-72", children }) {
  const inView = useContext(InViewContext);
  return <div className={className}>{inView ? children : <div className="skeleton h-full rounded-2xl" />}</div>;
}

/** แสดงแทนส่วนที่ยังคำนวณไม่ได้ เช่น ฟังก์ชันยังเป็น "ยังไม่ได้ทำ" */
export function Pending({ lab, error }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-muted">
      <div className="text-3xl" aria-hidden="true">🚧</div>
      <div className="mt-1 font-medium text-ink-2">รอ {lab}</div>
      <div className="mt-1 text-sm">{error}</div>
    </div>
  );
}

export function Insight({ children }) {
  return (
    <div className="lab4-insight mt-4 flex gap-3 rounded-2xl px-4 py-3 text-sm text-ink-2">
      <span className="lab4-bulb shrink-0 text-lg leading-5" aria-hidden="true">💡</span>
      <p>{children}</p>
    </div>
  );
}

/** ตัวเลขเด่น: นับขึ้นจาก 0 แบบการ์ด KPI หน้ายอดขาย · value เป็นตัวเลข แล้ว format แปลงเป็นข้อความ */
export function Stat({ label, value, format, note, muted, icon, delay = 0 }) {
  const shown = useCountUp(value, { delay });
  const tilt = useTilt();
  return (
    <div ref={tilt} className="card relative overflow-hidden rounded-2xl border border-line bg-surface-2/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted">{label}</div>
        {icon && <span className="card-icon text-xl" aria-hidden="true">{icon}</span>}
      </div>
      <div className={`mt-1 text-2xl font-light tracking-tight tabular-nums sm:text-3xl ${muted ? "text-muted" : "text-ink"}`}>
        <span aria-hidden="true">{format(shown)}</span>
        <span className="sr-only">{format(value)}</span>
      </div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
      {!muted && <span className="lab4-stat-glow" aria-hidden="true" />}
    </div>
  );
}

// สีจุดหน้าชื่อซีรีส์: ซีรีส์ที่ระบายด้วย gradient (url(#…)) หรือไม่มีเส้นขอบ ใช้สี accent แทน
const swatch = (p) => {
  const col = p.color && p.color !== "none" ? p.color : p.payload?.fill;
  return !col || String(col).startsWith("url(") ? "var(--accent)" : col;
};

/** กล่อง tooltip แก้วฝ้าแบบเดียวกับกราฟหน้ายอดขาย · fmt(value, name) คืนข้อความ */
export function GlassTip({ active, payload, label, labelFormat = (l) => l, fmt = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pop min-w-44 rounded-xl border border-line bg-surface/80 px-3.5 py-2.5 text-sm shadow-card backdrop-blur-md">
      <p className="text-xs text-muted">{labelFormat(label, payload)}</p>
      {payload.filter((p) => p.value != null).map((p) => (
        <p key={p.dataKey + p.name} className="mt-1.5 flex items-center gap-2 tabular-nums">
          <span className="inline-block size-2 rounded-full ring-2 ring-surface" style={{ background: swatch(p) }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="ml-auto pl-4 font-medium text-ink">{fmt(p.value, p.name)}</span>
        </p>
      ))}
    </div>
  );
}

/** ปุ่มเลือกแบบชิป (เช่น เลือกสาขา) */
export function Chip({ active, children, ...props }) {
  return (
    <button type="button" aria-pressed={active} data-sound="select" {...props}
            className={`rounded-full px-3 py-1 text-sm transition-all duration-300 active:scale-95 ${
              active ? "lab4-chip-on font-medium" : "text-muted ring-1 ring-line hover:-translate-y-0.5 hover:text-ink hover:ring-accent/50"}`}>
      {children}
    </button>
  );
}

// ---------------- หัวหน้า + ล็อกอิน ----------------
function LoginCard({ onSignIn, error }) {
  return (
    <div className="rise mx-auto max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
      <div className="lab4-float text-5xl" aria-hidden="true">🔐</div>
      <h2 className="mt-3 text-xl font-semibold text-ink">ต้องเข้าสู่ระบบก่อน</h2>
      <p className="mt-2 text-ink-2">ผลวิเคราะห์เปิดให้เฉพาะพนักงานที่ล็อกอินแล้ว</p>
      <button onClick={onSignIn} className="lab4-btn mt-5 rounded-full px-6 py-2.5 font-medium">เข้าสู่ระบบด้วย Google</button>
      {error && <p className="mt-3 text-sm" style={{ color: DOWN }}>{error}</p>}
    </div>
  );
}

function UserChip({ user, onSignOut }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1 pr-1 pl-1.5 text-sm shadow-card backdrop-blur">
      {user.photoURL && <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full ring-2 ring-accent/60" referrerPolicy="no-referrer" />}
      <span className="max-w-40 truncate text-ink-2">{user.displayName ?? user.email}</span>
      <button onClick={onSignOut} className="rounded-full px-2.5 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink">ออกจากระบบ</button>
    </div>
  );
}

function MetaChip({ children, tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${tone === "demo" ? "lab4-demo" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}>
      {children}
    </span>
  );
}

function RowCount({ n }) {
  const shown = useCountUp(n, { delay: 300 });
  return <span className="tabular-nums">{Math.round(shown).toLocaleString()}</span>;
}

/** ส่วนหัวร่วม: ล็อกอิน, ความสดของข้อมูล, จำนวนเอกสารที่อ่าน */
export function AnalyticsShell({ source, state, title, emoji, lab, tagline, onEmoji, emojiHint, children }) {
  const { user, data, error } = state;
  const [authError, setAuthError] = useState(null);
  if (user === undefined) return <p className="text-muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (!user) return <LoginCard onSignIn={() => source.signIn().catch((e) => setAuthError(authErrorText(e)))} error={authError} />;
  const m = data?.meta;
  return (
    <div>
      <header className="lab4-hero rise relative mb-6 overflow-hidden rounded-3xl border border-line p-5 shadow-card sm:p-8">
        <span className="lab4-orb lab4-orb-a" aria-hidden="true" />
        <span className="lab4-orb lab4-orb-b" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {onEmoji ? (
              // ไอคอนหัวหน้าที่กดได้ (เช่น ลูกแก้วหมอดู) มีวงกระเพื่อมและป้าย "กดสิ" ชวนให้ลอง
              <button type="button" onClick={onEmoji} title={emojiHint} aria-label={emojiHint}
                      className="lab4-float lab4-ping relative grid size-16 shrink-0 cursor-pointer place-items-center rounded-3xl bg-surface/80 text-4xl shadow-card ring-1 ring-line transition-transform hover:scale-110 sm:size-20 sm:text-5xl">
                {emoji}
                <span className="absolute -top-2 -right-3 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-surface shadow-card">กดสิ!</span>
              </button>
            ) : (
              <span className="lab4-float grid size-16 shrink-0 place-items-center rounded-3xl bg-surface/80 text-4xl shadow-card ring-1 ring-line sm:size-20 sm:text-5xl" aria-hidden="true">
                {emoji}
              </span>
            )}
            <div className="min-w-0">
              {lab && <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">{lab}</p>}
              <h1 className="shimmer font-display text-3xl font-bold sm:text-4xl">{title}</h1>
              {tagline && <p className="mt-1 text-sm text-ink-2">{tagline}</p>}
            </div>
          </div>
          <UserChip user={user} onSignOut={() => source.signOut()} />
        </div>
        {m && (
          <div className="relative mt-5 flex flex-wrap gap-2">
            <MetaChip>📅 ข้อมูลถึง {thaiDay(m.asOf)}</MetaChip>
            <MetaChip>🧾 <RowCount n={m.rows ?? 0} /> รายการ</MetaChip>
            {m.builtBy === "demo" ? (
              <MetaChip tone="demo">🧪 โหมดสาธิต คำนวณในเบราว์เซอร์</MetaChip>
            ) : (
              <>
                <MetaChip>🔄 อัปเดต {m.builtAt ? new Date(m.builtAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "–"}</MetaChip>
                <MetaChip>🤖 โดย {m.builtBy === "github-actions" ? "GitHub Actions" : "เครื่องผู้สอน/ผู้เรียน"}</MetaChip>
                <MetaChip>📖 อ่าน {data.reads} เอกสาร</MetaChip>
              </>
            )}
          </div>
        )}
      </header>
      {error && <p className="mb-4 rounded-2xl border p-3 text-sm" style={{ color: DOWN, borderColor: DOWN }}>{error}</p>}
      {!data && !error && (
        <div className="space-y-6">
          <div className="skeleton h-80 rounded-3xl" />
          <div className="skeleton h-64 rounded-3xl" />
        </div>
      )}
      {data && children(data)}
    </div>
  );
}
