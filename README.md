# Project Experience Database

A lightweight static website that turns a published Google Sheet into a live, searchable database of company project experiences. Data is fetched fresh from the Google Sheet on every page load — no backend, no database server, no build step required to run it.

## Features

- **Live Google Sheets sync** — data is pulled from the published CSV every time the page loads (with a cache-buster so updates appear on refresh)
- **Full-text search** — searches across all fields (ID, agency, title, contract no, value, officer, phone, kod bidang, tags, equipment, company, dates)
  - Multi-word AND search: `network selangor`
  - OR search: `cctv or pabx`
  - Exact phrase: `"supply and install"`
  - `/` keyboard shortcut to focus search, `Esc` to clear everything
- **Tag filtering** — multi-select: click tags (on cards or in the filter bar) to combine them with AND logic; a checkmark marks selected tags; "All" clears the selection
- **Year filter** — dropdown to narrow results to a specific project year (`Tahun` column), with per-year counts; combines with search and tags
- **Dark / light mode** — smooth fade toggle, remembers your preference, defaults to OS preference
- **Export to Excel** — downloads the *currently filtered* results as `.xlsx` (falls back to `.csv` if the SheetJS CDN is unreachable); filename reflects active filters, e.g. `experience_export_2023_cctv_2026-08-18.xlsx`
- **Auto-formatting** — currency normalized to `RM`, dates normalized to `DD/Mon/YY` regardless of how they were entered in the sheet
- **Equipment & Link columns** — equipment shown as chips; links shown as download buttons that open in a new tab (rendered only when populated)
- **Robust loading** — detects Google error pages, missing header rows, and empty sheets, and shows a clear error with a Try Again button instead of a silently empty page
- **Responsive** — works on mobile and desktop

## Project structure

```
STSPengalaman/
├── index.html          # Page structure, custom CSS (theme variables), CDN script tags
├── app.js              # Data fetching, parsing, search, filters, export, theme logic
├── tailwind.css        # Precompiled Tailwind utilities (generated — see Maintenance)
├── tailwind.input.css  # Tailwind build input (just @import "tailwindcss")
├── favicon.png         # Browser tab icon (32x32)
└── README.md           # This file
```

## Google Sheet setup

The sheet must be **published to the web as CSV** (publishing is different from sharing):

1. In Google Sheets: **File → Share → Publish to web**
2. Choose the sheet tab, format: **Comma-separated values (.csv)**
3. Copy the published link and paste it into `app.js`:

```js
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv";
```

### Required columns (header row)

| Column | Description |
|---|---|
| `ID` | Unique record ID (e.g. `id_1`) for cross-referencing with Excel |
| `NAMA AGENSI` | Agency / client name |
| `TAJUK KONTRAK` | Project / contract title (rows without this are skipped) |
| `NO SST/KONTRAK/LO` | Contract, SST, or LO number |
| `Tahun` | Project start year (e.g. `2023`) — powers the year filter |
| `TARIKH BERKUATKUASA` | Start date (any format — auto-normalized) |
| `TARIKH TAMAT` | End date |
| `NILAI (RM)` | Contract value (`$` prefix auto-converted to `RM`) |
| `Nama Pegawai` | Contact officer |
| `Telefon` | Phone number |
| `KOD BIDANG` | Bidang codes (comma-separated) |
| `TAG` | Tags (comma-separated) — used for filtering |
| `Equipment` | Equipment/tools used (comma-separated, optional) |
| `SYARIKAT` | Company badge (e.g. STS, SGS) |
| `Link` | URL to supporting document (optional) — shows a download button; `https://` is added automatically if missing |

> **Note:** Empty rows above the header row are fine — the app auto-detects the header. Blank `Equipment`/`Link` cells simply render nothing.

## Running locally

Browsers block `fetch()` from `file://` pages, so serve the folder with any static server:

```powershell
cd C:\Users\User\Documents\STSPengalaman
python -m http.server 8000
```

Then open <http://localhost:8000>.

Alternatives: VS Code **Live Server** extension, `npx serve`, etc.

## Deployment (free hosting)

It's a pure static site — deploy the folder as-is. Include **all files** (especially `tailwind.css`).

### GitHub Pages

1. Create a repository and push these files
2. **Settings → Pages → Source: Deploy from a branch** → select `main` / root
3. Site goes live at `https://<username>.github.io/<repo>/`

### Cloudflare Pages

1. Dashboard → **Workers & Pages → Create → Pages → Upload assets**
2. Drag and drop the project folder (no build command needed)
3. Site goes live at `https://<project>.pages.dev`

## Tech stack

- **Tailwind CSS** — precompiled static CSS (`tailwind.css`, generated with the Tailwind v4 standalone CLI); no runtime compiler
- [PapaParse 5.4.1](https://www.papaparse.com/) (CDN) — CSV parsing
- [SheetJS 0.20.2](https://sheetjs.com/) (CDN) — `.xlsx` export
- [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) — typography
- Vanilla JS, inline SVG icons (Lucide paths) — no framework

CDN scripts are version-pinned and protected with SRI (subresource integrity) hashes where the CDN allows it, so a compromised CDN cannot inject arbitrary code.

## Maintenance

**Editing data:** just edit the Google Sheet — nothing to rebuild. Changes appear on next page refresh (Google republishes every few minutes).

**Editing HTML/JS:** if you add a *new* Tailwind utility class to `index.html` or `app.js` (one not already used anywhere), rebuild the CSS — otherwise that class won't be styled:

```powershell
# One-time: download the standalone CLI (no Node.js needed)
# https://github.com/tailwindlabs/tailwindcss/releases (tailwindcss-windows-x64.exe)

# Rebuild (run from the project folder)
tailwindcss.exe -i tailwind.input.css -o tailwind.css -m
```

Classes already in use are permanently covered — no rebuild needed for content, data, or custom CSS in `<style>`.

**Changing the sheet link:** edit `SHEET_CSV_URL` at the top of `app.js`.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "Failed to load Google Sheet" on `file://` | Browsers block fetch from local files | Serve with a local server or deploy |
| "Google Sheets returned a web page instead of CSV" | The sheet was unpublished, or the link is wrong | Re-publish via File → Share → Publish to web; verify `SHEET_CSV_URL` in `app.js` |
| "The sheet loaded but contained no valid project rows" | Header exists but `TAJUK KONTRAK` column is empty | Restore the data or check the correct tab (`gid`) is published |
| "Could not find the header row" | Column headers renamed or removed | Restore the exact header names (see table above) |
| Data looks stale | Browser cache | Hard refresh with `Ctrl+F5`; the app already appends a cache-buster to the CSV URL |
| Dates display oddly | Inconsistent entry in sheet | Already handled — all dates are normalized to `DD/Mon/YY` at display time |
| Sheet edits not appearing | Google republish delay | Wait ~5 minutes, then hard refresh. Ensure the sheet is still published (not just shared) |
| New Tailwind class has no styling | `tailwind.css` is a compiled snapshot | Rebuild with the CLI (see Maintenance) |
| Icons missing after editing | — | Icons are inline SVG in `app.js` (`ICONS` object) and `index.html`; no library call needed |
