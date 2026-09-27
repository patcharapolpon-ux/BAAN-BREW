# Rebuild public/sales.csv from the original sales.xlsx (e.g. after Excel saved over it).
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\restore-sales-csv.ps1
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$xlsx = Join-Path $project 'sales.xlsx'
$csv = Join-Path $project 'public\sales.csv'
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "baanbrew-xlsx-$([guid]::NewGuid())"

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($xlsx, $tmp)
try {
  node (Join-Path $PSScriptRoot 'xlsx2csv.mjs') $tmp $csv
  if ($LASTEXITCODE -ne 0) { throw 'conversion failed' }
  Write-Host "Restored $csv"
}
finally {
  Remove-Item $tmp -Recurse -Force
}
