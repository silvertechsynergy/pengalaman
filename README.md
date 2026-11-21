# STS Database

A lightweight static website that turns published Google Sheets into a live, searchable database — two pages (**Pengalaman** for company project experience, **Partner** for the distributor network). Data is fetched fresh from the sheets on every page load — no backend, no database server, no build step required to run it.

## Features

### Both pages
- **Live Google Sheets sync** — data is pulled from the published CSVs every time the page loads (with a cache-buster so updates appear on refresh)
- **Dark / light mode** — smooth fade toggle, remembers your preference, defaults to OS preference
- **Responsive** — works on mobile and desktop
- **Crawler-blocking** — `robots.txt` + `noindex, nofollow` meta tag keep search engines away
- **Two-page navigation** — pill-style nav in the header; hash routing (`#/pengalaman`, `#/partner`) means deep links and browser back/forward work

### Pengalaman page
- **Full-text search** — searches across all fields (ID, agency, title, contract no, value, officer, phone, kod bidang, tags, equipment, company, dates)
  - Multi-word AND search: `network selangor`
  - OR search: `cctv or pabx`
  - Exact phrase: `"supply and install"`
  - `/` keyboard shortcut to focus search, `Esc` to clear everything
- **Tag filtering** — multi-select: click tags (on cards or in the filter bar) to combine them with AND logic; a checkmark marks selected tags; "All" clears the selection
- **Year filter** — dropdown to narrow results to a specific project year (`Tahun` column), with per-year counts
- **Owner filter** — dropdown for the `SYARIKAT` column (e.g. STS, SGS) with live counts; blank rows appear as **Unassigned** so unassigned projects can be isolated during data entry
- **Export to Excel** — downloads the *currently filtered* results as `.xlsx` (falls back to `.csv` if the SheetJS CDN is unreachable); filename reflects active filters, e.g. `experience_export_STS_2023_cctv_2026-08-18.xlsx`
- **Auto-formatting** — currency normalized to `RM`, dates normalized to `DD/Mon/YY` regardless of how they were entered in the sheet
- **Equipment & Link columns** — equipment shown as chips; links shown as download buttons that open in a new tab (rendered only when populated)
- **Robust loading** — detects Google error pages, missing header rows, and empty sheets, and shows a clear error with a Try Again button instead of a silently empty page

### Partner page
- **Card directory** — one card per distributor: company ID, website link, general email/phone, sales contact(s), office address, credit term, brands carried (as chips), and specialty tags (clickable filters)
- **Search & tag filtering** — same interaction model as the Pengalaman page; loads lazily on first visit and is cached for the session

### Performance
- **Lightweight** — all icons are inline SVG, the Excel library loads only after the page is idle, Tailwind ships as a small precompiled CSS file, and the Partner sheet is fetched only when its tab is first opened (~53% less JavaScript than the initial version)
- Entrance animations replay on page switches but are suppressed while typing, so search stays instant

## Project structure

```
STSPengalaman/
├── index.html          # Page structure, custom CSS (theme variables), CDN script tags
├── app.js              # Data fetching, parsing, search, filters, export, router, theme logic
├── tailwind.css        # Precompiled Tailwind utilities (generated — see Maintenance)
├── tailwind.input.css  # Tailwind build input (just @import "tailwindcss")
├── robots.txt          # Blocks all crawlers
├── favicon.png         # Browser tab icon + header logo (32x32)
└── README.md           # This file
```

## Google Sheet setup

Both pages read from **published CSV links** (publishing is different from sharing). There are two sheets: one for Pengalaman (projects), one for Partner (distributors).

1. In Google Sheets: **File → Share → Publish to web**
2. Choose the sheet tab, format: **Comma-separated values (.csv)**
3. Copy the published link and paste it into `app.js`:

```js
// Pengalaman page (projects)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv";

// Partner page (distributors) — in the "Partner config & state" block
const PARTNER_CSV_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv";
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
| `SYARIKAT` | Company owner (e.g. STS, SGS) — powers the owner filter; blank rows appear as "Unassigned" |
| `Link` | URL to supporting document or folder (optional) — shows a download button; `https://` is added automatically if missing |

> **Note:** Empty rows above the header row are fine — the app auto-detects the header. Blank `Equipment`/`Link` cells simply render nothing.

### Partner sheet columns (header row)

| Column | Description |
|---|---|
| `company_id` | Unique partner ID (e.g. `cid_001`) |
| `company_name` | Partner / distributor name (rows without this are skipped) |
| `website` | Company website — shown as an external-link button |
| `general_email` | General contact email (mailto link) |
| `general_phone` | General phone number |
| `sales_person` | Sales contact(s), comma-separated |
| `sales_email` | Sales email(s), comma-separated (mailto links) |
| `sales_phone` | Sales phone(s), comma-separated |
| `office_address` | Office address |
| `brand_carry` | Brands carried, comma-separated (shown as chips) |
| `tags` | Specialty tags, comma-separated — used for filtering |
| `credit_term` | Credit term (optional) |

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
- [SheetJS 0.20.2](https://sheetjs.com/) (CDN, lazy-loaded after idle) — `.xlsx` export; loads only after the page has rendered, with CSV fallback
- [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) — typography
- Vanilla JS, inline SVG icons (Lucide paths) — no framework, no icon library at runtime

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

**Changing the sheet link:** edit `SHEET_CSV_URL` (Pengalaman) and `PARTNER_CSV_URL` (Partner) at the top of `app.js`.

**Adding a third company / owner:** nothing to do — the Owner dropdown auto-populates from the distinct values in the `SYARIKAT` column on next refresh.

**Adding a new partner:** just add a row to the partner sheet — the Partner page picks it up on next visit/refresh.

**Crawler-blocking:** handled by `robots.txt` (must stay at the site root when deployed) and the `noindex, nofollow` meta tag in `index.html`. Don't remove these if the site should stay out of search engines.

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
| Export downloads `.csv` instead of `.xlsx` | SheetJS CDN was unreachable at click time (offline / blocked) | Export still works; retry later for Excel format — the library loads automatically |
| Partner page shows "Failed to load partner sheet" | Partner sheet unpublished, or link wrong | Re-publish the partner sheet; verify `PARTNER_CSV_URL` in `app.js` |
| Site still appears in Google | Crawlers may take weeks to drop indexed pages, or the site was indexed before `robots.txt` was added | The `noindex` meta tag now requests removal; can also request removal in Google Search Console |
