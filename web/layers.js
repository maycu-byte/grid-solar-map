// Grid layers: the real high-voltage grid (OpenStreetMap) and the modelled
// medium-voltage network with its MV/LV transformers (ding0), coloured by the
// solar behind each transformer or by the loading in the worst feed-in case.

const $ = (s) => document.querySelector(s);
const HV = [[380, "#d6212a", "380 kV"], [220, "#ef7d00", "220 kV"], [110, "#2b6fb3", "110 kV"], [1, "#8a8f8c", "< 110 kV"]];
const RATIO = [[0.25, "#2e9e4f", "< 0.25"], [0.5, "#9ccf4a", "0.25–0.5"], [0.8, "#f2c12e", "0.5–0.8"], [1.0, "#ef7d00", "0.8–1.0"], [Infinity, "#b3261e", "> 1.0"]];
const LOAD = [[50, "#7aa7c7", "< 50%"], [80, "#f2c12e", "50–80%"], [100, "#ef7d00", "80–100%"], [Infinity, "#b3261e", "> 100%"]];

let ctx, hv = null, mv = null, tr = null, trMode = "ratio", data = {};
const cls = (table, v) => table.find(([lim]) => v < lim) ?? table[table.length - 1];
const hvColour = (kv) => (HV.find(([lim]) => kv >= lim) ?? HV[HV.length - 1])[1];

async function get(name) {
  if (!data[name]) {
    const r = await fetch(`data/${name}.geojson?v=${ctx.build}`);
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    data[name] = await r.json();
  }
  return data[name];
}

export async function initLayers(context) {
  ctx = context;
  const { map } = ctx;
  map.createPane("grid");
  map.getPane("grid").style.zIndex = 450;
  map.on("zoomend", dim);
  $("#ly-hv").addEventListener("change", toggleHv);
  $("#ly-mv").addEventListener("change", toggleMv);
  $("#ly-tr").addEventListener("change", toggleTr);
  $("#tr-mode").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    trMode = b.dataset.v; ctx.press("#tr-mode", trMode);
    if (tr) { tr.remove(); tr = null; toggleTr(); }
    refreshLayers();
  });
  refreshLayers();
  await toggleHv();
}

// The districts fade when the grid is drawn over them, and almost vanish close up.
export function districtOpacity(map) {
  const any = ["#ly-hv", "#ly-mv", "#ly-tr"].some((id) => $(id)?.checked);
  if (!any) return 0.8;
  return map && map.getZoom() >= 11 ? 0.12 : 0.45;
}

function dim() {
  ctx.districtLayer()?.setStyle({ fillOpacity: districtOpacity(ctx.map) });
}

async function toggleHv() {
  if (!$("#ly-hv").checked) { hv?.remove(); dim(); return; }
  const g = await get("power_lines");
  hv = ctx.Leaflet.geoJSON(g, {
    pane: "grid", interactive: true,
    style: (f) => ({ color: f.properties.rail ? "#7b52ab" : hvColour(f.properties.kv), weight: f.properties.kv >= 220 ? 2.6 : 1.8,
      dashArray: f.properties.rail ? "5 4" : f.properties.cable ? "2 3" : null, opacity: 0.95 }),
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindTooltip(`${p.kv ? `${p.kv} kV` : "?"}${p.cable ? " cable" : ""}${p.rail ? " · 16.7 Hz railway" : ""}${p.operator ? ` · ${p.operator}` : ""}${p.name ? ` · ${p.name}` : ""}`, { sticky: true });
    },
  }).addTo(ctx.map);
  dim();
}

async function toggleMv() {
  $("#key-mv").hidden = !$("#ly-mv").checked;
  if (!$("#ly-mv").checked) { mv?.remove(); dim(); return; }
  const g = await get("mv_lines");
  mv = ctx.Leaflet.geoJSON(g, {
    pane: "grid",
    style: (f) => ({ color: cls(LOAD, f.properties.load)[1], weight: f.properties.load >= 80 ? 2.4 : 1.2, dashArray: f.properties.rf ? "4 3" : null, opacity: 0.9 }),
    onEachFeature: (f, l) => l.bindTooltip(`MV · ${f.properties.load}%${f.properties.rf ? " · +1 cable" : ""}`, { sticky: true }),
  }).addTo(ctx.map);
  dim();
}

async function toggleTr() {
  $("#tr-box").hidden = !$("#ly-tr").checked;
  if (!$("#ly-tr").checked) { tr?.remove(); tr = null; dim(); return; }
  const g = await get("mvlv_transformers");
  const L = ctx.L(), nf = ctx.nf;
  tr = ctx.Leaflet.geoJSON(g, {
    pane: "grid",
    pointToLayer: (f, ll) => {
      const p = f.properties;
      const colour = trMode === "ratio" ? cls(RATIO, p.ratio)[1] : cls(LOAD, p.load)[1];
      return ctx.Leaflet.circleMarker(ll, { radius: p.kva >= 400 ? 5 : 3.5, fillColor: colour, fillOpacity: 0.95,
        color: p.rf ? "#000" : "#fff", weight: p.rf ? 2 : 0.6 });
    },
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindTooltip(`${nf(p.kva)} kVA · ${nf(p.kwp, 1)} kWp (${nf(p.ratio, 2)} kWp/kVA) · ${p.load}%${p.rf ? " · reinforced" : ""}`);
    },
  }).addTo(ctx.map);
  dim();
}

export function refreshLayers() {
  if (!ctx) return;
  const key = (rows, dot = false) => rows.map(([, c, t]) => `<span><i class="${dot ? "dot" : ""}" style="background:${c}"></i>${t}</span>`).join("");
  $("#key-hv").innerHTML = key(HV) + `<span style="color:#7b52ab"><i class="dash"></i>16.7 Hz</span>`;
  $("#key-mv").innerHTML = key(LOAD);
  $("#key-tr").innerHTML = trMode === "ratio" ? key(RATIO.map(([a, c, t]) => [a, c, `${t} kWp/kVA`]), true) : key(LOAD, true);
}
