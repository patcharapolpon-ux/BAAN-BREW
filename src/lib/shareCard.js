import { formatBaht, formatNumber, formatPercent } from './metrics'

// "Wrapped"-style summary card, drawn with the plain Canvas 2D API (no screenshot library)
// at 1080×1350 — the portrait size Instagram/Facebook posts use — in the current theme's colors.
// Nothing runs until the button is pressed, so it costs the page nothing otherwise.

const W = 1080
const H = 1350
const SANS = '"IBM Plex Sans Thai", sans-serif'
const SERIF = '"Noto Serif Thai", serif'

function tokens() {
  const css = getComputedStyle(document.documentElement)
  const t = (name) => css.getPropertyValue(`--${name}`).trim()
  return { canvas: t('canvas'), surface: t('surface'), ink: t('ink'), muted: t('muted'), accent: t('accent'), soft: t('accent-soft'), line: t('line') }
}

function bean(g, x, y, size, angle, color) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  g.scale(size, size)
  g.fillStyle = color
  g.beginPath()
  g.ellipse(0, 0, 6, 8.5, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(0,0,0,0.28)'
  g.lineWidth = 1.3
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(0, -6.5)
  g.bezierCurveTo(-2.5, -2, 2.5, 2, 0, 6.5)
  g.stroke()
  g.restore()
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

export async function downloadShareCard({ branch, range, kpi, topBranch, recentChange }) {
  // Canvas can only use fonts that have finished loading.
  await Promise.all([
    document.fonts.load(`300 100px ${SANS}`),
    document.fonts.load(`500 40px ${SANS}`),
    document.fonts.load(`600 100px ${SERIF}`),
  ])
  const c = tokens()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')

  // Background: canvas color with two soft glows, like the site's ambient blobs.
  g.fillStyle = c.canvas
  g.fillRect(0, 0, W, H)
  for (const [x, y, r, color, a] of [
    [150, 120, 700, c.soft, 0.55],
    [1000, 1250, 650, c.accent, 0.35],
  ]) {
    const glow = g.createRadialGradient(x, y, 0, x, y, r)
    glow.addColorStop(0, color)
    glow.addColorStop(1, 'transparent')
    g.globalAlpha = a
    g.fillStyle = glow
    g.fillRect(0, 0, W, H)
  }
  g.globalAlpha = 1

  // Scattered beans for decoration (fixed positions so every card looks the same).
  ;[
    [930, 150, 3.2, 0.6],
    [1010, 330, 2, -0.4],
    [860, 290, 1.4, 1.2],
    [110, 1190, 2.6, -0.9],
    [230, 1270, 1.5, 0.3],
  ].forEach(([x, y, s, a]) => bean(g, x, y, s, a, c.accent))

  const left = 90
  g.textBaseline = 'alphabetic'
  g.fillStyle = c.accent
  g.font = `500 34px ${SANS}`
  g.fillText('BAANBREW WRAPPED ☕', left, 150)
  g.fillStyle = c.ink
  g.font = `600 110px ${SERIF}`
  g.fillText('บ้านบรู', left, 280)
  g.fillStyle = c.muted
  g.font = `400 36px ${SANS}`
  g.fillText(`${branch ? `สาขา${branch}` : 'ทุกสาขา'} · ${range}`, left, 345)

  // Hero number
  g.fillStyle = c.muted
  g.font = `400 40px ${SANS}`
  g.fillText('ยอดขายรวม', left, 480)
  g.fillStyle = c.ink
  g.font = `300 150px ${SANS}`
  g.fillText(formatBaht(kpi.totalSales), left - 6, 630)
  if (recentChange != null) {
    const up = recentChange >= 0
    const label = `${up ? '▲' : '▼'} ${formatPercent(Math.abs(recentChange), 1)} ใน 30 วันล่าสุด`
    g.font = `500 34px ${SANS}`
    const w = g.measureText(label).width + 48
    roundRect(g, left, 670, w, 64, 32)
    g.fillStyle = c.surface
    g.fill()
    g.fillStyle = c.accent
    g.fillText(label, left + 24, 714)
  }

  // Three stat tiles
  const stats = [
    ['จำนวนบิล', formatNumber(kpi.orderCount)],
    ['เฉลี่ยต่อบิล', formatBaht(kpi.averageOrderValue, 0)],
    ['ลูกค้าสมาชิก', formatNumber(kpi.uniqueMembers)],
  ]
  const tileW = (W - left * 2 - 40) / 3
  stats.forEach(([label, value], i) => {
    const x = left + i * (tileW + 20)
    roundRect(g, x, 800, tileW, 190, 32)
    g.fillStyle = c.surface
    g.fill()
    g.strokeStyle = c.line
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = c.muted
    g.font = `400 30px ${SANS}`
    g.fillText(label, x + 32, 870)
    g.fillStyle = c.ink
    g.font = `500 54px ${SANS}`
    g.fillText(value, x + 32, 950)
  })

  // Top branch line
  if (topBranch) {
    g.fillStyle = c.ink
    g.font = `500 44px ${SANS}`
    g.fillText(`🏆 สาขาขายดีที่สุด: ${topBranch.branch}`, left, 1100)
    g.fillStyle = c.muted
    g.font = `400 32px ${SANS}`
    g.fillText(`${formatBaht(topBranch.sales)} · ${formatPercent(topBranch.share, 0)} ของยอดทั้งหมด`, left, 1155)
  }

  g.fillStyle = c.muted
  g.font = `400 28px ${SANS}`
  g.fillText('สร้างจาก BaanBrew Dashboard', left, H - 80)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `baanbrew-${branch ?? 'all'}-summary.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
