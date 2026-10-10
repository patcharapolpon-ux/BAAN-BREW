// Lab 4.2 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.2A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.2 · Cohort retention รายเดือน
// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  // แปลง "YYYY-MM" เป็นจำนวนเดือนนับจากปี 0 แล้วลบกัน (ข้ามปีได้ถูกต้อง ไม่ต้องใช้ Date)
  const toMonths = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));
  return toMonths(b) - toMonths(a);
}

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  // เดือนที่ลูกค้าแต่ละคนมาซื้อ (Set = มาหลายครั้งในเดือนเดียวกันนับครั้งเดียว)
  const monthsByCustomer = new Map();
  for (const row of rows) {
    if (!row.customer_id) continue; // walk-in ติดตามการกลับมาไม่ได้
    const ym = row.date.slice(0, 7); // date เป็นวันที่ไทยอยู่แล้ว ตัด string ได้เลย
    let months = monthsByCustomer.get(row.customer_id);
    if (!months) monthsByCustomer.set(row.customer_id, (months = new Set()));
    months.add(ym);
  }

  const lastMonth = asOf.slice(0, 7);
  // รวมลูกค้าตาม cohort (เดือนแรกที่ซื้อ) และนับว่าเดือนที่ k หลังจากนั้นกลับมากี่คน
  const byCohort = new Map();
  for (const months of monthsByCustomer.values()) {
    const first = [...months].sort()[0];
    let c = byCohort.get(first);
    if (!c) byCohort.set(first, (c = { size: 0, counts: new Array(monthIndex(first, lastMonth) + 1).fill(0) }));
    c.size += 1;
    for (const ym of months) {
      const k = monthIndex(first, ym);
      if (k < c.counts.length) c.counts[k] += 1;
    }
  }

  const cohorts = [...byCohort.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, c]) => ({ cohort, size: c.size, retention: c.counts.map((n) => n / c.size) }));

  // เดือนสุดท้ายไม่ครบ ถ้า asOf ยังไม่ถึงวันสุดท้ายของเดือน
  // ใช้ Date.UTC (เดือนถัดไป วันที่ 0 = วันสุดท้ายของเดือนนี้) ไม่มีปัญหาเขตเวลา
  const [y, m, d] = asOf.split("-").map(Number);
  const monthLength = new Date(Date.UTC(y, m, 0)).getUTCDate();

  // daysInMonth ใช้ในข้อความใต้ heatmap ("มีข้อมูล 20 จาก 30 วัน")
  return { cohorts, lastMonth, lastMonthPartial: d < monthLength, daysInLastMonth: d, daysInMonth: monthLength };
}
