// What the barista says about a heatmap cell. The mood comes from the cell's sales compared
// with the busiest cell (level 0–1), with a few special cases for mornings, evenings and weekends.
// The line is picked by a stable index (day × hour), so hovering the same cell always gives
// the same sentence instead of flickering between random ones.

const LINES = {
  slammed: [
    'ชงไม่ทันแล้ววว คิวยาวถึงหน้าประตู 😵‍💫',
    'มือเป็นระวิง! นมหมดไปสองแกลลอนแล้ว',
    'ช่วงพีคของจริง ขอกาแฟให้ตัวเองสักแก้วได้มั้ย ☕😭',
    'เครื่องชงร้อนจนควันขึ้นแล้วครับพี่',
  ],
  busy: [
    'ยุ่งกำลังดี มีจังหวะให้หายใจบ้าง 😮‍💨',
    'ลูกค้าเข้าเรื่อยๆ ยิ้มจนแก้มปวด 😄',
    'ออเดอร์ไหลมาไม่ขาดสาย สนุกดี',
  ],
  normal: [
    'ชิลๆ ได้คุยกับลูกค้าประจำด้วย ☺️',
    'จังหวะสบายๆ ได้ทำลาเต้อาร์ตสวยๆ 🎨',
    'พอมีลูกค้า ไม่ยุ่งไม่เหงา',
  ],
  quiet: [
    'เงียบนิดนึง ขอเช็ดเครื่องชงรอ 🧽',
    'มีเวลาลองสูตรเมนูใหม่ 🧪',
    'ลูกค้าประปราย เปิดเพลงคลอเบาๆ 🎶',
  ],
  dead: [
    'เงียบกริบ… ได้ยินเสียงตู้เย็นเลย 🥲',
    'นั่งนับเมล็ดกาแฟเล่น 1… 2… 3…',
    'ไม่มีใครมาเลย ขอแอบงีบแป๊บ 😴',
  ],
}

const EXTRA = {
  morning: 'เช้านี้ใครยังไม่ตื่น ให้กาแฟช่วย ☀️',
  evening: 'ใกล้ปิดร้านแล้ว เก็บของรอได้เลย 🌙',
  weekendRush: 'เสาร์อาทิตย์ทีไร คนแน่นร้านทุกที 🎉',
}

export function baristaLine({ weekday, hour, sales, max }) {
  const level = max ? sales / max : 0
  const seed = weekday * 24 + hour
  const weekend = weekday === 0 || weekday === 6
  if (level >= 0.85 && weekend && seed % 3 === 0) return EXTRA.weekendRush
  if (level < 0.35 && hour <= 8 && seed % 2 === 0) return EXTRA.morning
  if (level < 0.35 && hour >= 19 && seed % 2 === 0) return EXTRA.evening
  const mood = level >= 0.85 ? 'slammed' : level >= 0.6 ? 'busy' : level >= 0.35 ? 'normal' : level >= 0.15 ? 'quiet' : 'dead'
  const lines = LINES[mood]
  return lines[seed % lines.length]
}
