# Project Experience Database

A lightweight static website that turns a published Google Sheet into a live, searchable database of company project experiences. Data is fetched fresh from the Google Sheet on every page load — no backend, no database server, no build step.

## Features

- **Live Google Sheets sync** — data is pulled from the published CSV every time the page loads
- **Full-text search** — searches across all fields (agency, title, contract no, ID, tags, equipment, kod bidang, etc.)
  - Multi-word AND search: `network selangor`
  - OR search: `cctv or pabx`
  - Exact phrase: `"supply and install"`
  - `/` keyboard shortcut to focus search, `Esc` to clear
- **Tag filtering** — click any tag on a card (or in the filter bar) to filter; click again to clear
- **Dark / light mode** — instant toggle with smooth fade, remembers your preference
- **Export to Excel** — downloads the currently filtered results as `.xlsx` (falls back to `.csv`)
- **Auto-formatting** — currency normalized to `RM`, dates normalized to `DD/Mon/YY` regardless of how they're entered in the sheet
- **Record IDs** — each row has a unique ID for cross-referencing with Excel
- **Equipment & Link columns** — equipment shown as chips; links shown as download buttons (when populated)
- **Responsive** — works on mobile and desktop

## Project structure

```
STSPengalaman/
├── index.html    # Page structure, styles (Tailwind + custom CSS)
├── app.js        # Data fetching, search, filtering, export, theme logic
├── favicon.png   # Browser tab icon (32x32)
└── README.md     # This file
```

## Google Sheet setup

The sheet must be **published to the web as CSV**:

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
| `TAJUK KONTRAK` | Project / contract title |
| `NO SST/KONTRAK/LO` | Contract, SST, or LO number |
| `TARIKH BERKUATKUASA` | Start date (any format — auto-normalized) |
| `TARIKH TAMAT` | End date |
| `NILAI (RM)` | Contract value (auto-converted to RM display) |
| `Nama Pegawai` | Contact officer |
| `Telefon` | Phone number |
| `KOD BIDANG` | Bidang codes (comma-separated) |
| `TAG` | Tags (comma-separated) — used for filtering |
| `Equipment` | Equipment/tools used (comma-separated, optional) |
| `SYARIKAT` | Company badge (e.g. STS, SGS) |
| `Link` | URL to supporting document (optional) — shows a download button |

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

It's a pure static site — deploy the folder as-is.

### GitHub Pages

1. Create a repository and push these files
2. **Settings → Pages → Source: Deploy from a branch** → select `main` / root
3. Site goes live at `https://<username>.github.io/<repo>/`

### Cloudflare Pages

1. Dashboard → **Workers & Pages → Create → Pages → Upload assets**
2. Drag and drop the project folder (no build command needed)
3. Site goes live at `https://<project>.pages.dev`

## Tech stack

- [Tailwind CSS](https://cdn.tailwindcss.com) (CDN) — utility styling
- [Lucide](https://unpkg.com/lucide@latest) (CDN) — icons
- [PapaParse](https://www.papaparse.com/) (CDN) — CSV parsing
- [SheetJS](https://sheetjs.com/) (CDN) — `.xlsx` export
- Vanilla JS — no framework, no build step

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "Failed to load Google Sheet" on `file://` | Browsers block fetch from local files | Serve with a local server or deploy |
| Data looks stale | Browser cache | Hard refresh with `Ctrl+F5`; the app already appends a cache-buster to the CSV URL |
| Dates display oddly | Inconsistent entry in sheet | Already handled — all dates are normalized to `DD/Mon/YY` at display time |
| Sheet edits not appearing | Google republish delay | Wait ~5 minutes, then hard refresh. Ensure the sheet is still published (not just shared) |
"# pengalaman" 
