// Lab 3.1 · แปลงแถวจาก sales.csv (ผลลัพธ์ Lab 2.1) เป็นเอกสาร Firestore
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.1 ใน PROMPTS_LAB3.md) จนกว่า npm test จะผ่านทุกข้อ
// scripts/seed.mjs เรียกใช้ฟังก์ชันเหล่านี้ ไม่ต้องแก้ seed.mjs
import { addDays, daysBetween } from "../src/lab3/time.js";

// วันที่ใน CSV เป็นเวลาไทยอยู่แล้ว จึงตัด 10 ตัวแรกได้เลย ไม่ต้องผ่าน new Date() ที่จะแปลงเป็น UTC
const DATETIME = /^(20\d\d-\d\d-\d\d)T(\d\d):\d\d:\d\d\+07:00$/;
const dateOf = (iso) => iso.slice(0, 10);

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];

/**
 * เลือกเฉพาะ N วันล่าสุดของข้อมูล นับจากวันล่าสุดในไฟล์ (ไม่ใช่วันนี้) รวมวันสุดท้ายด้วย
 * @returns {{ rows: object[], start: string, end: string }}  start/end เป็น YYYY-MM-DD
 */
export function selectLastDays(rows, days) {
  const end = rows.reduce((max, r) => (dateOf(r.datetime) > max ? dateOf(r.datetime) : max), "");
  const start = addDays(end, -(days - 1));
  return { rows: rows.filter((r) => dateOf(r.datetime) >= start), start, end };
}

/** จำนวนวันที่ต้องเลื่อน ให้วันล่าสุดของข้อมูลกลายเป็น "เมื่อวาน" ของ today · ห้ามติดลบ */
export function computeShift(lastDataDate, today) {
  return Math.max(0, daysBetween(lastDataDate, today) - 1);
}

/** เลื่อนวันที่ใน datetime ("2026-09-20T16:05:09+07:00") ไป days วัน โดยคงเวลาและ +07:00 */
export function shiftDateTime(iso, days) {
  return addDays(dateOf(iso), days) + iso.slice(10);
}

/**
 * แปลง 1 แถว CSV (ทุกค่าเป็นข้อความ) เป็น { id, data }
 * id = order_id + "-" + product_id
 * data มีฟิลด์: order_id, datetime, date, hour, branch, product_id, qty, unit_price, revenue,
 *               customer_id (ว่าง = null), payment_method, channel, source = "import"
 * ต้อง throw Error ถ้าข้อมูลยังไม่สะอาด: qty ไม่ใช่จำนวนเต็มบวก, ราคาไม่ใช่ตัวเลขบวก,
 * สาขาไม่อยู่ใน BRANCHES, datetime ไม่ใช่ 20YY-MM-DDTHH:MM:SS+07:00
 */
export function toSaleDoc(row, shiftDays = 0) {
  const qty = Number(row.qty);
  const unitPrice = Number(row.unit_price);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error(`${row.order_id}: qty "${row.qty}" ต้องเป็นจำนวนเต็มบวก`);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`${row.order_id}: unit_price "${row.unit_price}" ต้องเป็นตัวเลขบวก`);
  if (!BRANCHES.includes(row.branch)) throw new Error(`${row.order_id}: ไม่รู้จักสาขา "${row.branch}"`);
  if (!DATETIME.test(row.datetime)) throw new Error(`${row.order_id}: datetime "${row.datetime}" ไม่ใช่รูปแบบ 20YY-MM-DDTHH:MM:SS+07:00`);

  const datetime = shiftDateTime(row.datetime, shiftDays);
  const [, date, hour] = datetime.match(DATETIME);
  return {
    id: `${row.order_id}-${row.product_id}`,
    data: {
      order_id: row.order_id,
      datetime,
      date,
      hour: Number(hour),
      branch: row.branch,
      product_id: row.product_id,
      qty,
      unit_price: unitPrice,
      revenue: qty * unitPrice,
      customer_id: row.customer_id || null,
      payment_method: row.payment_method,
      channel: row.channel,
      source: "import",
    },
  };
}

/** สรุป: { docs, bills (นับ order_id ไม่ซ้ำ), revenue, byBranch: {สาขา: ยอด}, start, end } */
export function summarize(docs) {
  const bills = new Set();
  const byBranch = {};
  let revenue = 0;
  let start = "";
  let end = "";
  for (const { data } of docs) {
    bills.add(data.order_id);
    revenue += data.revenue;
    byBranch[data.branch] = (byBranch[data.branch] ?? 0) + data.revenue;
    if (!start || data.date < start) start = data.date;
    if (data.date > end) end = data.date;
  }
  return { docs: docs.length, bills: bills.size, revenue, byBranch, start, end };
}
