// Convert an extracted xlsx folder (sheet1 + sharedStrings) into a real CSV.
// Used by scripts/restore-sales-csv.ps1 to rebuild public/sales.csv from sales.xlsx.
import fs from 'node:fs'
import path from 'node:path'

const [dir, out] = process.argv.slice(2)
const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&')

const sst = fs.readFileSync(path.join(dir, 'xl/sharedStrings.xml'), 'utf8')
const strings = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
)

const colIndex = (ref) => {
  const letters = ref.match(/^[A-Z]+/)[0]
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}
const esc = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

const sheet = fs.readFileSync(path.join(dir, 'xl/worksheets/sheet1.xml'), 'utf8')
const lines = []
let width = 0
for (const row of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = []
  for (const c of row[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, ref, attrs, inner = ''] = c
    const type = (attrs.match(/t="(\w+)"/) || [])[1]
    let value = ''
    if (type === 's') value = strings[+inner.match(/<v>(.*?)<\/v>/)[1]]
    else if (type === 'inlineStr') value = decode((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [, ''])[1])
    else {
      const v = (inner.match(/<v>(.*?)<\/v>/) || [])[1]
      if (v !== undefined) value = type === 'str' ? decode(v) : String(Number(v))
    }
    cells[colIndex(ref)] = value
  }
  if (lines.length === 0) width = cells.length
  const padded = Array.from({ length: width }, (_, i) => esc(cells[i] ?? ''))
  if (padded.some((v) => v !== '')) lines.push(padded.join(','))
}
// BOM first so Excel reads the Thai text as UTF-8 (PapaParse skips it).
fs.writeFileSync(out, '﻿' + lines.join('\n') + '\n', 'utf8')
console.log(`rows (incl. header): ${lines.length}, columns: ${width}`)
