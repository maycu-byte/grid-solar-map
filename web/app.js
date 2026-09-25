import { LOCALE, T } from "./i18n.js";
import { modelsHtml, sourcesHtml } from "./blocks.js";

// Leaflet is the global L; in this module L holds the texts of the chosen language.
const Leaflet = window.L;
const $ = (s) => document.querySelector(s);
const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const SOLAR_RAMP = ["--r0", "--r1", "--r2", "--r3", "--r4", "--r5"];
const GRID_RAMP = ["--g0", "--g1", "--g2", "--g3", "--g4", "--g5"];
const METRICS = {
  solar: ["net_mw", "density_kw_km2", "new_mw_12m", "growth_share"],
  grid: ["firm_mw", "flex_mw", "rooftop_room_mw", "lv_double_share"],
};
const SHARE = new Set(["growth_share", "lv_double_share"]);
const GATEWAY = "https://maycu-byte.github.io/grid-edge-gateway/";
const STUDY = "https://github.com/maycu-byte/lv-grid-stress-test/blob/main/docs/regional.md";
const BUILD = document.documentElement.dataset.build;

let lang = "en", L = T.en, metric = "firm_mw", rule = "pro", districts, summary, layer, breaks = [], selected = null;

const nf = (v, d = 0) => v.toLocaleString(LOCALE[lang], { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (m, v) => (v == null ? "–" : SHARE.has(m) ? `${nf(v * 100)}%` : m === "density_kw_km2" ? `${nf(v)} kW/km²` : `${nf(v, v < 10 ? 1 : 0)} MW`);
const value = (p, m) => (m === "flex_mw" ? (rule === "pro" ? p.flex_prorata_mw : p.flex_lifo_mw) : p[m]);
const isGrid = (m) => METRICS.grid.includes(m);

function pickLanguage() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q && T[q]) return q;
  try { const v = localStorage.getItem("lang"); if (v && T[v]) return v; } catch { /* storage blocked */ }
  const nav = (navigator.language || "en").slice(0, 2);
  return T[nav] ? nav : "en";
}

function press(sel, v) { document.querySelectorAll(`${sel} button`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v))); }

function applyLanguage(v) {
  lang = v; L = T[v];
  document.documentElement.lang = v;
  try { localStorage.setItem("lang", v); } catch { /* storage blocked */ }
  press("#lang-seg", v);
  document.querySelectorAll("[data-t]").forEach((e) => { const t = L[e.dataset.t]; if (typeof t === "string") e.innerHTML = t; });
  $("#what").innerHTML = `<h2>${L.whatTitle}</h2><p>${L.what1}</p><p>${L.what2}</p><p>${L.what3}</p>`;
  $("#metric").innerHTML = [["groupGrid", METRICS.grid], ["groupSolar", METRICS.solar]].map(([g, ms]) =>
    `<optgroup label="${L[g]}">${ms.map((m) => `<option value="${m}"${m === metric ? " selected" : ""}>${L["m_" + m]}</option>`).join("")}</optgroup>`).join("");
  $("#tab-models").innerHTML = modelsHtml(v);
  $("#tab-sources").innerHTML = sourcesHtml(v);
  if (districts) { renderStats(); render(); }
}

function renderStats() {
  const s = summary;
  $("#stats").innerHTML = [
    [`${nf(s.net_mw)} MW`, L.stInstalled], [`${nf(s.new_mw_12m)} MW`, L.stAdded],
    [`${nf(s.firm_mw)} MW`, L.stFirm], [`${nf(rule === "pro" ? s.flex_prorata_mw : s.flex_lifo_mw)} MW`, L.stFlex(nf(s.loss_target * 100))],
  ].map(([b, t]) => `<div class="stat"><b>${b}</b><span>${t}</span></div>`).join("");
  $("#missing").textContent = s.missing.map((id) => L.missing(id)).join(" ");
}

function quantileBreaks(values) {
  const v = values.filter((x) => x != null && x > 0).sort((a, b) => a - b);
  return [1, 2, 3, 4, 5].map((k) => v[Math.floor((k / 6) * (v.length - 1))] ?? 0);
}

function colour(v) {
  if (v == null) return cssVar("--hair");
  if (isGrid(metric) && metric === "firm_mw" && v <= 0.5) return cssVar("--bad");
  const ramp = isGrid(metric) ? GRID_RAMP : SOLAR_RAMP;
  return cssVar(ramp[breaks.filter((b) => v > b).length]);
}

function render() {
  const feats = districts.features;
  const values = feats.map((f) => (f.properties.data ? value(f.properties, metric) : null));
  breaks = quantileBreaks(values);
  if (layer) layer.remove();
  layer = Leaflet.geoJSON(districts, {
    style: (f) => ({
      fillColor: colour(f.properties.data ? value(f.properties, metric) : null), fillOpacity: 0.8,
      color: f.properties.id === selected ? "#000" : "#ffffff", weight: f.properties.id === selected ? 2.5 : 1,
      dashArray: f.properties.data ? null : "4 3",
    }),
    onEachFeature: (f, l) => {
      l.bindTooltip(`${f.properties.name}: ${f.properties.data ? fmt(metric, value(f.properties, metric)) : L.noData}`, { sticky: true });
      l.on("click", () => select(f.properties.id));
    },
  }).addTo(map);
  const ramp = (isGrid(metric) ? GRID_RAMP : SOLAR_RAMP).map(cssVar);
  $("#legend").innerHTML = (metric === "firm_mw" ? [cssVar("--bad"), ...ramp.slice(1)] : ramp).map((c) => `<i style="background:${c}"></i>`).join("");
  const present = values.filter((x) => x != null);
  $("#lmin").textContent = fmt(metric, Math.min(...present));
  $("#lmax").textContent = fmt(metric, Math.max(...present));
  $("#rule-box").hidden = metric !== "flex_mw" && !selected;
  const top = feats.filter((f) => f.properties.data).sort((a, b) => value(b.properties, metric) - value(a.properties, metric)).slice(0, 10);
  $("#ranking").innerHTML = top.map((f) => `<li data-id="${f.properties.id}">${f.properties.name}: <b>${fmt(metric, value(f.properties, metric))}</b></li>`).join("");
  document.querySelectorAll("#ranking li").forEach((li) => li.addEventListener("click", () => select(li.dataset.id, true)));
  if (selected) renderDetail();
}

function select(id, zoom = false) {
  selected = id;
  render();
  if (zoom) layer.eachLayer((l) => { if (l.feature.properties.id === id) map.fitBounds(l.getBounds(), { maxZoom: 11 }); });
  if (window.innerWidth <= 860) $("#detail").scrollIntoView({ behavior: "smooth" });
}

function renderDetail() {
  const p = districts.features.find((f) => f.properties.id === selected).properties;
  if (!p.data) { $("#detail").innerHTML = `<h3>${p.name}</h3><p class="note">${L.missing(p.id)}</p>`; return; }
  const pct = (v) => `${nf(v * 100, v < 0.1 ? 1 : 0)}%`;
  const firm = p.firm_mw > 0.5 ? `${nf(p.firm_mw)} MW` : `${L.firmNone} ${nf(p.n1_today_loading)}%`;
  const rows = p.flex_steps.map((s) => {
    const last = s.lifo[s.lifo.length - 1];
    const cls = (v) => (v > 0.1 ? "hi" : v <= 0.03 ? "lo" : "");
    return `<tr><td>${nf(s.mw)}</td><td class="${cls(s.pro_rata)}">${pct(s.pro_rata)}</td><td class="${cls(last)}">${pct(last)}</td><td>${nf(s.hours)}</td></tr>`;
  }).join("");
  const r = p.reinforced;
  $("#detail").innerHTML = `<h3>${p.name}</h3>
    <div class="kv">
      <span>${L.popSolar}</span><b>${L.installedIn(fmt("net_mw", p.net_mw), nf(p.units))}</b>
      <span>${L.added12}</span><b>${fmt("new_mw_12m", p.new_mw_12m)} (${pct(p.growth_share)})</b>
      <span>${L.rooftopShare}</span><b>${pct(p.rooftop_share)}</b>
      <span>${L.wind}</span><b>${nf(p.wind_mw)} MW</b>
      <span>${L.peakLoad}</span><b>${nf(p.peak_load_mw)} MW</b>
      <span>${L.hvmv}</span><b>${nf(p.hvmv_mva)} MVA</b>
      <span>${L.firm}</span><b>${firm}</b>
      <span>${L.firmAll}</span><b>${nf(p.firm_all_mw)} MW</b>
      <span>${L.roofRoom}</span><b>${nf(p.rooftop_room_mw)} MW</b>
      <span>${L.lvDouble}</span><b>${pct(p.lv_double_share)}</b>
      <span>${L.area} · ${L.people}</span><b>${nf(p.area_km2)} km² · ${nf(p.population)}</b>
    </div>
    <p class="note">${L.reinforced(r.transformers, r.lines, r.lv_grids_doubled)}</p>
    <h2 style="margin-top:6px">${L.flexTitle}</h2>
    <table><thead><tr>${L.flexHead.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
    <p class="links"><a href="${GATEWAY}?lang=${lang}&district=${p.id}#calculator" target="_blank" rel="noopener">${L.openGateway} →</a><br>
    <a href="${STUDY}" target="_blank" rel="noopener">${L.openStudy} →</a></p>`;
}

const map = Leaflet.map("map", { zoomSnap: 0.25 });
Leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · grids: ding0 (CC BY-SA 4.0)',
  maxZoom: 14, opacity: 0.35,
}).addTo(map);

$("#lang-seg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) applyLanguage(b.dataset.v); });
$("#tab-seg").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  press("#tab-seg", b.dataset.v);
  for (const t of ["map", "models", "sources"]) $(`#tab-${t}`).hidden = t !== b.dataset.v;
});
$("#metric").addEventListener("change", (e) => { metric = e.target.value; render(); });
$("#rule-seg").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  rule = b.dataset.v; press("#rule-seg", rule); renderStats(); render();
});

applyLanguage(pickLanguage());
Promise.all(["data/districts.geojson", "data/capacity_summary.json", "data/summary.json"].map((u) => fetch(`${u}?v=${BUILD}`).then((r) => {
  if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
  return r.json();
}))).then(([d, s, old]) => {
  districts = d; summary = s;
  $("#snapshot").textContent = old.snapshot;
  renderStats();
  render();
  map.fitBounds(layer.getBounds(), { padding: [10, 10] });
}).catch((err) => { $("#stats").textContent = L.loadError + err.message; });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { map.invalidateSize(); if (layer) map.fitBounds(layer.getBounds(), { padding: [10, 10] }); }, 200);
});
