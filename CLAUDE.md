# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BaanBrew (บ้านบรู) is a course project: a sales dashboard for a mock 5-branch coffee chain, built lab by lab (Lab 1 → Lab 3) and extended with many "fun" features. React 19 + Vite 8 + Tailwind v4 + Recharts + PapaParse, Firebase (Firestore + Google Auth) for the live tabs, three.js / matter-js lazy-loaded for toys. Plain JavaScript (no TypeScript). UI text and many comments are Thai. The folder name `baanbrew-dasboard` is misspelled on purpose — don't rename it.

## Commands

```bash
npm run dev                 # Vite dev server (add `-- --host` to open from a phone on the same Wi-Fi)
npm run build               # production build → dist/
npm run lint                # oxlint (.oxlintrc.json: react rules-of-hooks, only-export-components)
npm test                    # vitest run (all *.test.js / *.test.mjs in src/ and scripts/)
npx vitest run src/lib/metrics.test.js          # one file
npx vitest run src/lib/metrics.test.js -t "name" # one test by name

npm run seed:dry            # preview Firestore import (no key needed)
npm run seed                # import last 90 days of sales into Firestore (needs .env + secrets/service-account.json)
npm run verify-import       # check Firestore matches the import
npm run lottery             # refresh public/lottery.json from the GLO API (API has no CORS, so it's fetched at build-time, not in the browser)
npm run analytics:dry       # Lab 4: compute analytics from public/sales.csv, print results, write nothing
npm run analytics           # Lab 4: write the 5 docs analytics/{meta,daily,rfm,cohort,abc} (Admin SDK, same key as seed)
```

Demo mode (no Firebase, computed in the browser): `http://localhost:5173/?demo#insights`.

If an edit doesn't show up in the browser, restart `npm run dev` (Vite has served stale modules here before).

Deploy: Vercel auto-deploys `main` (https://baan-brew.vercel.app). Firebase Hosting is manual: `npm run build && npx firebase-tools deploy --only hosting`. Firestore rules: `firestore.rules` (deployed); `firestore.test-mode.rules` is the Lab 3.1 open-access variant.

## Course rules (from LAB3_GUIDE.md / PROMPTS_LAB3.md / LAB4_GUIDE.md)

- Day 4 workflow: work on a branch (`day4-am`, `day4-pm`) and open a Pull Request — **never commit directly to `main`**, never `git push --force`. Vercel builds a Preview per branch; `main` = Production.
- The web app reads analytics only from the `analytics` collection (5 docs). **Never read all of `sales` from the browser** (free quota is 50k reads/day; the history is ~53k rows).
- `src/lib/analytics/` must stay pure functions (no Firestore calls); `scripts/build-analytics.mjs` and `.github/workflows/analytics.yml` run them and write the results.
- Before editing more than one file, summarize the plan briefly; after writing code, run `npm test` and report the result.

- **Never edit test files** to make tests pass — fix the implementation. Tests are how labs are graded.
- All sales calculation logic lives in `src/lib/metrics.js` (pure functions, tested in `metrics.test.js`); components only call it.
- Thai dates/times: use `src/lab3/time.js` (`nowBangkokISO`, `todayBangkok`, `addDays`, `daysBetween`) or `toThaiDate` in metrics. Never use `new Date(...).toISOString()` for a Thai calendar date — it yields UTC and shifts sales after midnight to the wrong day.
- The user follows the teacher's pace; don't run ahead into later lab steps unless asked.
- Never read, print or paste the contents of `.env` secrets or `secrets/service-account.json`.

## Data

Static CSVs in `public/` are fetched at runtime by PapaParse (`header: true`); they're UTF-8 **with BOM** so Excel shows Thai correctly (`.gitattributes` marks `*.csv -text` — keep bytes intact).

- `sales.csv` — one row per **line item**; a bill is `order_id` (can span rows). Sales = `qty × unit_price`. Blank `customer_id` = walk-in. Datetimes carry `+07:00`. This is the cleaned output of Lab 2.1 (~53k rows, 2025-04-01 → 2026-09-20).
- `products.csv`, `branches.csv` (with lat/lng for the 3D map), `customers.csv` (profiled in the Lab 2.1 notebook), `lottery.json`.
- `sales.xlsx` at the root is the backup source. If `public/sales.csv` gets clobbered (e.g. Excel saving one sheet over it), restore with `git checkout public/sales.csv` or `powershell -ExecutionPolicy Bypass -File scripts\restore-sales-csv.ps1`. Never save over it from Excel.
- `data/` holds raw inputs; `verify/` holds Excel pivot cross-check evidence.

## Architecture

**Routing** is a URL hash read by `useHash()` in `src/App.jsx`; `PageTabs` switches between `#` (sales, default), `#customers`, `#lab2`, `#live`, `#rules`, `#play`. App loads `sales.csv` once and passes rows down.

**Static vs Firebase pages.** Sales/customers/Lab 2.2 run purely on `public/` CSVs. `#live`, `#rules`, `#play` go through `firebaseTab()` in App.jsx, which lazy-imports `src/lab3/firebase.js`; if `isConfigured` is false (no `VITE_FIREBASE_*` env) it renders `SetupGuide` instead, so the site still works without Firebase. Course pages are styled for a light background and are wrapped in `CoursePanel` to stay light in dark/neon mode.

**Folders by origin:**
- `src/lib/` — dashboard logic and hooks. `metrics.js` (all KPIs/aggregations), `staticData.js` (cached promise loaders + `useStatic` hook for products/branches/lottery), `theme.js` (light/dark/system; chart colors read from CSS tokens in `src/index.css`), `motion.js` (count-up, in-view, reduced-motion), `sound.js` (Web Audio synthesized sounds via delegated `data-sound` attributes), `eggs.js`/`secret.js` (easter eggs), `map3d.js` (three.js scene, lazy chunk), plus feature models (`newspaper.js`, detective/what-if logic) with tests.
- `src/components/` — dashboard UI. Heavy/optional toys are wrapped in `ToyBoundary` so a failure doesn't take down the page.
- `src/lab2/` — Lab 2.2 bad-vs-fixed charts (`lab2Metrics.js`).
- `src/lab3/` — Lab 3 Firestore: `firebase.js` (init), `saleModel.js` (form validation → `buildSale` doc), `LiveTab`, `SaleForm`, `RulesTester`.
- `src/lib/analytics/` — Lab 4 pure analytics (rfm, cohort, abc, forecast, anomaly, daily, build) with tests; `realdata.test.js` checks results against the real CSV.
- `src/lab4/` — Lab 4 tabs `#insights` (CustomersTab: RFM/cohort/ABC) and `#forecast` (ForecastTab). They take a `source` from `src/lab3/dataSource.js` (`firestoreSource.loadAnalytics()` reads 5 docs; `createDemoSource` for `?demo`), wired by `analyticsTab()` in App.jsx. Our `#customers` is the older Lab 2 customer page, so the starter's "customers" tab is named `#insights` here.
- `src/play/` — `#play` realtime toys; writes only to `playground` / `presence` collections, never `sales`, and is rate-capped in `playModel.js`.
- `scripts/` — Node CLIs: `seed.mjs` + `seedTransform.mjs` (CSV → Firestore docs, id = `order_id-product_id`, date shift so the latest day = yesterday), `verify-import.mjs`, `fetch-lottery.mjs`, `xlsx2csv.mjs`.

**Firestore security.** The web config is public; protection is entirely in `firestore.rules`: signed-in read, `sales` create-only with an exact field set matching `buildSale()` plus server-checked price, branch, payment, qty and `created_by == auth.uid`; no update/delete. If you change the shape of `buildSale()`, update `isValidSale` in the rules (and `RulesTester`) to match. Seed/verify scripts use the Admin SDK and bypass rules.

## Style

- Heavy animations and easter eggs are intentional — don't remove or "optimize away" effects; respect `prefersReducedMotion()` for new ones.
- Code comments in `src/lib` and components are short English explanations of *why*; course-provided files (lab3, scripts, rules) use Thai comments — match the file you're in.
