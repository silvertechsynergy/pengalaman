/* =========================================================
 * Project Experience Database — v3 design
 * Live Google Sheets sync, tag filters, dark/light mode,
 * and Excel export of filtered results.
 * ========================================================= */

// ----- Config -----
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQU3eZ65_KRWXgfiYikF83dGBvyg4ybR_tD-tgLUCTR7FX9hcWjpqQ0Ce0BYMXY_XPw8gECunSkslfz/pub?gid=0&single=true&output=csv";

const COL = {
  id: "ID",
  agency: "NAMA AGENSI",
  title: "TAJUK KONTRAK",
  contractNo: "NO SST/KONTRAK/LO",
  tahun: "Tahun",
  startDate: "TARIKH BERKUATKUASA",
  endDate: "TARIKH TAMAT",
  value: "NILAI (RM)",
  officer: "Nama Pegawai",
  phone: "Telefon",
  bidang: "KOD BIDANG",
  tags: "TAG",
  company: "SYARIKAT",
  equipment: "Equipment",
  link: "Link",
};

// ----- DOM -----
const $ = (id) => document.getElementById(id);
const els = {
  grid: $("resultsGrid"),
  loading: $("loadingState"),
  error: $("errorState"),
  errorMsg: $("errorMessage"),
  noResults: $("noResults"),
  search: $("searchInput"),
  clearBtn: $("clearBtn"),
  filterTags: $("filterTags"),
  yearFilter: $("yearFilter"),
  activeFilter: $("activeFilter"),
  activeFilterText: $("activeFilterText"),
  totalCount: $("totalCount"),
  statusDot: $("statusDot"),
  statTotal: $("statTotal"),
  statClients: $("statClients"),
  statTags: $("statTags"),
  statShowing: $("statShowing"),
  lastSync: $("lastSync"),
  themeToggle: $("themeToggle"),
  exportBtn: $("exportBtn"),
  refreshBtn: $("refreshBtn"),
  refreshIcon: $("refreshIcon"),
  retryBtn: $("retryBtn"),
  clearAllBtn: $("clearAllBtn"),
};

// ----- State -----
const state = {
  records: [],
  tags: [],
  years: [],
  query: "",
  activeTags: [], // multi-select
  activeYear: null,
};

/* ================= Theme ================= */

function initTheme() {
  const saved = localStorage.getItem("theme");
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  setTheme(saved || preferred);
}

// Pre-built inline SVGs (Lucide sun/moon paths) so toggling the theme
// never needs to re-run lucide.createIcons() over the whole document.
const THEME_ICONS = {
  sun: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
};

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  els.themeToggle.innerHTML = theme === "dark" ? THEME_ICONS.sun : THEME_ICONS.moon;
}

function setThemeSmooth(theme) {
  const root = document.documentElement;
  root.classList.add("theme-fading");
  // Fade out, swap theme at the opacity midpoint, fade back in.
  setTimeout(() => {
    setTheme(theme);
    requestAnimationFrame(() =>
      setTimeout(() => root.classList.remove("theme-fading"), 60)
    );
  }, 180);
}

els.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  setThemeSmooth(current === "dark" ? "light" : "dark");
});

/* ================= Data ================= */

function clean(v) {
  return (v || "").toString().trim();
}

function splitList(v) {
  return clean(v)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// The sheet stores values like "$409,608.17" — display as RM instead.
function formatRM(v) {
  const s = clean(v);
  if (!s) return "";
  return s.replace(/^\$\s*/, "RM ");
}

// Normalize every date variant in the sheet to "DD/Mon/YY".
// Handles: "05/Jan/18", "4/Aug/23", "17/Sep/2025", "1/23/2018", "4/30/2019".
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(v) {
  const s = clean(v);
  if (!s) return "";

  // Case 1: "D/Mon/YY", "DD/Mon/YY", "D/Mon/YYYY" (month as name)
  let m = s.match(/^(\d{1,2})\/([A-Za-z]{3,})\/(\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const monIdx = MONTHS.findIndex(
      (mo) => mo.toLowerCase() === m[2].slice(0, 3).toLowerCase()
    );
    if (monIdx === -1) return s; // unknown month name — leave as-is
    const yr = m[3].length === 4 ? m[3].slice(2) : m[3];
    return `${day}/${MONTHS[monIdx]}/${yr}`;
  }

  // Case 2: legacy numeric "M/D/YYYY" (e.g. 1/23/2018, 4/30/2019)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, "0")}/${MONTHS[month - 1]}/${m[3].slice(2)}`;
    }
  }

  return s; // anything else — display unchanged
}

async function loadCSVText() {
  const url = SHEET_CSV_URL + "&_cb=" + Date.now();
  try {
    const res = await fetch(url);
    if (res.ok) return await res.text();
  } catch (e) {
    console.warn("Direct fetch failed, trying proxy fallback...", e);
  }
  // Fallback for file:// or strict networks
  const proxy = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
  const res = await fetch(proxy);
  if (!res.ok) throw new Error("HTTP " + res.status + " via proxy");
  return await res.text();
}

async function fetchProjects() {
  showLoading();
  els.refreshIcon.classList.add("animate-spin");
  try {
    if (typeof Papa === "undefined") throw new Error("CSV parser (PapaParse) failed to load from CDN. Check connection/ad-blocker.");
    let csvText = await loadCSVText();

    // Skip any blank rows above the real header row
    const lines = csvText.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.includes(COL.title));
    if (idx > 0) csvText = lines.slice(idx).join("\n");

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });

    state.records = parsed.data
      .filter((row) => clean(row[COL.title]))
      .map((row) => ({
        id: clean(row[COL.id]),
        agency: clean(row[COL.agency]),
        title: clean(row[COL.title]),
        contractNo: clean(row[COL.contractNo]),
        tahun: clean(row[COL.tahun]),
        startDate: formatDate(row[COL.startDate]),
        endDate: formatDate(row[COL.endDate]),
        value: formatRM(row[COL.value]),
        officer: clean(row[COL.officer]),
        phone: clean(row[COL.phone]),
        bidang: clean(row[COL.bidang]),
        tags: splitList(row[COL.tags]),
        company: clean(row[COL.company]),
        equipment: splitList(row[COL.equipment]),
        link: clean(row[COL.link]),
      }));

    // Collect unique tags with counts
    const tagCount = {};
    state.records.forEach((r) =>
      r.tags.forEach((t) => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      })
    );
    state.tags = Object.keys(tagCount)
      .sort((a, b) => tagCount[b] - tagCount[a])
      .map((t) => ({ name: t, count: tagCount[t] }));

    // Collect unique years (numeric descending)
    state.years = [...new Set(state.records.map((r) => r.tahun).filter(Boolean))]
      .sort((a, b) => b - a);

    showReady();
    renderAll();
  } catch (err) {
    console.error("Data load failed:", err);
    showError(err);
  } finally {
    els.refreshIcon.classList.remove("animate-spin");
    lucide.createIcons();
  }
}

/* ================= Filtering ================= */

function getFiltered() {
  const q = state.query.toLowerCase();
  return state.records.filter((r) => {
    // Year filter
    if (state.activeYear && r.tahun !== state.activeYear) return false;

    // Multi-tag filter: record must have ALL selected tags
    if (
      state.activeTags.length > 0 &&
      !state.activeTags.every((sel) =>
        r.tags.some((t) => t.toLowerCase() === sel.toLowerCase())
      )
    )
      return false;

    if (!q) return true;

    const haystack = [
      r.id, r.agency, r.title, r.contractNo, r.tahun, r.value, r.officer, r.phone,
      r.bidang, r.company, r.startDate, r.endDate, r.link,
      ...r.tags, ...r.equipment,
    ]
      .join(" ")
      .toLowerCase();

    if (q.startsWith('"') && q.endsWith('"') && q.length > 2)
      return haystack.includes(q.slice(1, -1));
    if (q.includes(" or ")) {
      const terms = q.split(" or ").map((t) => t.trim()).filter(Boolean);
      return terms.some((t) => haystack.includes(t));
    }
    return q.split(/\s+/).every((w) => haystack.includes(w));
  });
}

/* ================= Rendering ================= */

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlight(text) {
  const safe = escapeHtml(text || "");
  const q = state.query.trim();
  if (!q) return safe;
  let out = safe;
  q.split(/\s+/)
    .filter((w) => w.length > 1)
    .forEach((word) => {
      const re = new RegExp(
        "(" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
        "gi"
      );
      out = out.replace(re, "<mark>$1</mark>");
    });
  return out;
}

function renderFilterTags() {
  const btn = (label, active, count) =>
    `<button class="tag flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${active ? "active" : ""}" data-tagfilter="${escapeHtml(
      label
    )}">${active ? '<i data-lucide="check" class="w-3 h-3 inline -mt-0.5"></i> ' : ""}${escapeHtml(label)}${count != null ? ` <span class="ml-1 opacity-50">${count}</span>` : ""}</button>`;

  let html = btn("All", state.activeTags.length === 0, state.records.length);
  state.tags.forEach((t) => {
    html += btn(t.name, state.activeTags.includes(t.name), t.count);
  });
  els.filterTags.innerHTML = html;
}

function renderYearFilter() {
  const current = els.yearFilter.value;
  els.yearFilter.innerHTML =
    '<option value="">All Years</option>' +
    state.years
      .map((y) => {
        const count = state.records.filter((r) => r.tahun === y).length;
        return `<option value="${escapeHtml(y)}">${escapeHtml(y)} (${count})</option>`;
      })
      .join("");
  els.yearFilter.value = state.activeYear || current || "";
}

function companyBadge(company) {
  if (!company) return "";
  return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border" style="background: var(--tag-bg); border-color: var(--tag-border); color: var(--tag-text);">${escapeHtml(company)}</span>`;
}

function metaRow(icon, label, value, useHighlight) {
  if (!value) return "";
  const v = useHighlight ? highlight(value) : escapeHtml(value);
  return `
    <div class="flex items-start gap-1.5">
      <i data-lucide="${icon}" class="w-3 h-3 faint mt-0.5 flex-shrink-0"></i>
      <span class="text-[11px] faint w-20 flex-shrink-0">${label}</span>
      <span class="text-xs muted flex-1">${v}</span>
    </div>`;
}

function linkBtn(link) {
  if (!link) return "";
  const url = /^https?:\/\//i.test(link) ? link : "https://" + link;
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="link-btn" title="Open link: ${escapeHtml(link)}" onclick="event.stopPropagation()">
    <i data-lucide="download" class="w-3.5 h-3.5"></i>
  </a>`;
}

function cardHtml(r, i) {
  const delay = Math.min(i * 40, 400);
  const period = [r.startDate, r.endDate].filter(Boolean).join(" → ");
  const tags = r.tags
    .map(
      (t) =>
        `<button class="tag px-2 py-0.5 rounded text-[10px] font-medium" data-tag="${escapeHtml(t)}">${highlight(t)}</button>`
    )
    .join("");
  const equipment = r.equipment
    .map(
      (e) =>
        `<span class="equip-chip px-2 py-0.5 rounded text-[10px] font-medium">${highlight(e)}</span>`
    )
    .join("");

  return `
  <div class="project-card rounded-2xl p-6 flex flex-col fade-in-up" style="animation-delay: ${delay}ms">
    <div class="flex items-start justify-between gap-2 mb-3">
      <span class="text-[11px] faint uppercase tracking-wider font-medium leading-snug">${highlight(r.agency)}</span>
      <span class="flex items-center gap-1.5 flex-shrink-0">
        ${r.tahun ? `<span class="text-[11px] faint font-mono">${escapeHtml(r.tahun)}</span>` : ""}
        ${linkBtn(r.link)}
        ${companyBadge(r.company)}
      </span>
    </div>

    <h3 class="text-base font-medium mb-2 leading-snug">${highlight(r.title)}</h3>

    ${r.value ? `<div class="text-sm font-semibold mb-3" style="color: var(--accent-text);">${escapeHtml(r.value)}</div>` : ""}

    <div class="flex flex-col gap-1.5 mb-4 flex-1">
      ${metaRow("file-text", "Contract No", r.contractNo, true)}
      ${metaRow("calendar", "Period", period)}
      ${metaRow("hash", "Kod Bidang", r.bidang, true)}
      ${metaRow("user", "Pegawai", r.officer)}
      ${metaRow("phone", "Telefon", r.phone)}
      ${r.id ? metaRow("bookmark", "ID", r.id, true) : ""}
    </div>

    ${equipment ? `<div class="flex flex-wrap gap-1.5 mb-3">${equipment}</div>` : ""}
    ${tags ? `<div class="flex flex-wrap gap-1.5 pt-3" style="border-top: 1px solid var(--border);">${tags}</div>` : ""}
  </div>`;
}

function renderAll() {
  const filtered = getFiltered();

  // Stats
  const uniqueAgencies = new Set(state.records.map((r) => r.agency).filter(Boolean)).size;
  els.totalCount.textContent = state.records.length;
  els.statTotal.textContent = state.records.length;
  els.statClients.textContent = uniqueAgencies;
  els.statTags.textContent = state.tags.length;
  els.statShowing.textContent = filtered.length;

  renderFilterTags();
  renderYearFilter();
  updateActiveFilter();

  // Grid / empty state
  if (filtered.length === 0) {
    els.grid.innerHTML = "";
    els.noResults.classList.remove("hidden");
  } else {
    els.noResults.classList.add("hidden");
    els.grid.innerHTML = filtered.map(cardHtml).join("");
  }
  lucide.createIcons();
}

function updateActiveFilter() {
  const parts = [];
  if (state.activeYear) parts.push(`year: ${state.activeYear}`);
  if (state.activeTags.length > 0) parts.push(`tags: ${state.activeTags.join(" + ")}`);
  if (state.query) parts.push(`"${state.query}"`);
  if (parts.length) {
    els.activeFilter.classList.remove("hidden");
    els.activeFilterText.textContent = parts.join("  •  ");
  } else {
    els.activeFilter.classList.add("hidden");
  }
}

/* ================= UI states ================= */

function setDot(cls) {
  els.statusDot.className = "w-1.5 h-1.5 rounded-full pulse-dot " + cls;
}

function showLoading() {
  els.loading.classList.remove("hidden");
  els.error.classList.add("hidden");
  els.grid.classList.add("hidden");
  els.noResults.classList.add("hidden");
  setDot("bg-amber-500");
}

function showReady() {
  els.loading.classList.add("hidden");
  els.grid.classList.remove("hidden");
  setDot("bg-emerald-500");
  els.lastSync.textContent =
    "Last synced " +
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function showError(err) {
  els.loading.classList.add("hidden");
  els.error.classList.remove("hidden");
  setDot("bg-rose-500");
  let hint = err && err.message ? err.message : String(err);
  if (location.protocol === "file:") {
    hint +=
      " — Note: opening via file:// is restricted by browsers. Serve with a local server (python -m http.server) or deploy to GitHub/Cloudflare Pages.";
  }
  els.errorMsg.textContent = hint;
}

/* ================= Export ================= */

function exportFiltered() {
  const filtered = getFiltered();
  if (filtered.length === 0) {
    alert("No results to export.");
    return;
  }

  const rows = filtered.map((r) => ({
    ID: r.id,
    "NAMA AGENSI": r.agency,
    "TAJUK KONTRAK": r.title,
    "NO SST/KONTRAK/LO": r.contractNo,
    Tahun: r.tahun,
    "TARIKH BERKUATKUASA": r.startDate,
    "TARIKH TAMAT": r.endDate,
    "NILAI (RM)": r.value,
    "Nama Pegawai": r.officer,
    Telefon: r.phone,
    "KOD BIDANG": r.bidang,
    TAG: r.tags.join(", "),
    SYARIKAT: r.company,
    Equipment: r.equipment.join(", "),
    Link: r.link,
  }));

  const stamp = new Date().toISOString().slice(0, 10);
  const nameParts = [];
  if (state.activeYear) nameParts.push(state.activeYear);
  if (state.activeTags.length > 0)
    nameParts.push(state.activeTags.map((t) => t.replace(/[^\w-]+/g, "-")).join("-"));
  const namePart = nameParts.length ? "_" + nameParts.join("_") : "";

  // Prefer real Excel when SheetJS is available; fall back to CSV.
  if (typeof XLSX !== "undefined") {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 8 },  { wch: 34 }, { wch: 60 }, { wch: 22 }, { wch: 8 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
      { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 30 }, { wch: 34 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Experience");
    XLSX.writeFile(wb, `experience_export${namePart}_${stamp}.xlsx`);
  } else {
    const headers = Object.keys(rows[0]);
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const csv = [
      headers.map(esc).join(","),
      ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experience_export${namePart}_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/* ================= Events ================= */

let debounceTimer;
els.search.addEventListener("input", (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    state.query = e.target.value.trim();
    els.clearBtn.classList.toggle("hidden", !state.query);
    renderAll();
  }, 180);
});

function clearSearchAndFilters() {
  state.query = "";
  state.activeTags = [];
  state.activeYear = null;
  els.search.value = "";
  els.yearFilter.value = "";
  els.clearBtn.classList.add("hidden");
  renderAll();
}

// Toggle a tag in/out of the multi-select set
function toggleTag(tag) {
  const i = state.activeTags.indexOf(tag);
  if (i === -1) state.activeTags.push(tag);
  else state.activeTags.splice(i, 1);
}

els.clearBtn.addEventListener("click", () => {
  clearSearchAndFilters();
  els.search.focus();
});
els.clearAllBtn.addEventListener("click", clearSearchAndFilters);
els.retryBtn.addEventListener("click", fetchProjects);
els.refreshBtn.addEventListener("click", fetchProjects);
els.exportBtn.addEventListener("click", exportFiltered);
els.yearFilter.addEventListener("change", (e) => {
  state.activeYear = e.target.value || null;
  renderAll();
});

// Tag clicks (card tags + filter bar) via delegation
document.addEventListener("click", (e) => {
  const cardTag = e.target.closest("[data-tag]");
  if (cardTag) {
    toggleTag(cardTag.dataset.tag);
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const filterTag = e.target.closest("[data-tagfilter]");
  if (filterTag) {
    const t = filterTag.dataset.tagfilter;
    if (t === "All") state.activeTags = [];
    else toggleTag(t);
    renderAll();
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== els.search) {
    e.preventDefault();
    els.search.focus();
  }
  if (e.key === "Escape") {
    clearSearchAndFilters();
    els.search.blur();
  }
});

/* ================= Init ================= */

initTheme();
lucide.createIcons();
fetchProjects();
