// Lab 4.4 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.4A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.4 · พยากรณ์ยอดขายแบบอธิบายได้ และวัดความแม่นด้วยการย้อนทดสอบ (backtest)
import { addDays } from "../../lab3/time.js";

const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = อาทิตย์

/** ค่าเฉลี่ยยอดขายวันเดียวกันของสัปดาห์ K ครั้งล่าสุด (ฤดูกาลรายสัปดาห์) */
export function seasonalForecast(series, horizon, K = 8) {
  // แยกยอดตามวันในสัปดาห์ (0–6) เก็บเฉพาะ K ครั้งล่าสุดของแต่ละวัน
  const byDow = Array.from({ length: 7 }, () => []);
  for (const s of series) byDow[dow(s.date)].push(s.revenue);
  const avg = byDow.map((xs) => {
    const recent = xs.slice(-K);
    return recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  });
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => {
    const date = addDays(last, i + 1);
    return { date, forecast: avg[dow(date)] };
  });
}

/** ค่าเฉลี่ย K วันล่าสุด เส้นตรง (ตัวเปรียบเทียบที่ไม่สนวันในสัปดาห์) */
export function flatForecast(series, horizon, K = 28) {
  const recent = series.slice(-K);
  const avg = recent.reduce((a, s) => a + s.revenue, 0) / recent.length;
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => ({ date: addDays(last, i + 1), forecast: avg }));
}

/** Mean Absolute Percentage Error (%) · ข้ามวันที่ยอดจริงเป็น 0 เพราะหารไม่ได้ */
export function mape(actual, forecast) {
  let sum = 0, n = 0;
  actual.forEach((a, i) => {
    if (a === 0) return; // ร้านปิด/ไม่มียอด: หารด้วย 0 ไม่ได้ จึงไม่นับวันนั้น
    sum += Math.abs(a - forecast[i]) / a;
    n += 1;
  });
  return n ? (sum / n) * 100 : NaN; // ไม่มีวันให้วัดเลย = ไม่รู้ ไม่ใช่ 0%
}

/**
 * ย้อนทดสอบ: ซ่อน horizon วันสุดท้าย พยากรณ์จากข้อมูลก่อนหน้า แล้วเทียบกับของจริง
 * band = ±1.28 × ส่วนเบี่ยงเบนมาตรฐานของ % ความคลาดเคลื่อน (ช่วงประมาณ 80%)
 */
export function backtest(series, horizon = 28, K = 8) {
  // ซ่อนท้าย horizon วัน: โมเดลเห็นแค่ train แล้วต้องเดา test โดยไม่รู้คำตอบ
  const train = series.slice(0, -horizon);
  const test = series.slice(-horizon);
  const seasonal = seasonalForecast(train, horizon, K);
  const flat = flatForecast(train, horizon);
  const actual = test.map((s) => s.revenue);

  // % คลาดเคลื่อนเทียบกับค่าพยากรณ์ (ยอดจริง = พยากรณ์ × (1 + e)) แถบจึงเป็น พยากรณ์ × (1 ± band)
  const errors = test
    .map((s, i) => (seasonal[i].forecast ? (s.revenue - seasonal[i].forecast) / seasonal[i].forecast : null))
    .filter((e) => e !== null);
  const mean = errors.reduce((a, b) => a + b, 0) / (errors.length || 1);
  const sd = Math.sqrt(errors.reduce((a, e) => a + (e - mean) ** 2, 0) / (errors.length || 1));

  return {
    test: test.map((s, i) => ({ date: s.date, actual: s.revenue, seasonal: seasonal[i].forecast, flat: flat[i].forecast })),
    mapeSeasonal: mape(actual, seasonal.map((f) => f.forecast)),
    mapeFlat: mape(actual, flat.map((f) => f.forecast)),
    band: 1.28 * sd, // 1.28 ส่วนเบี่ยงเบนมาตรฐาน ≈ ครอบคลุมราว 80% ของวัน (การแจกแจงปกติ)
  };
}
