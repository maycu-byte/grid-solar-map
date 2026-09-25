"""Grid districts with solar and grid capacity, for the map.

Joins, per MV grid district of the Saarland (ding0/eGon service areas of the
HV/MV substations, data/grid/):
- solar of February 2025 placed on the grids (by_district.csv);
- firm capacity: rooftop room per LV grid and the substation's n-1 headroom
  (capacity_firm.json);
- flexible connections above the firm capacity and the energy they lose over
  2025 under two curtailment rules (flexible.json).

A district is named after the OSM 110 kV substation inside it, else after the
municipality closest to its centre.

Writes web/data/districts.geojson, web/data/capacity_summary.json and
web/data/flex_days.json (each district's worst day for flexible plants).
"""
import json

import pandas as pd
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform

from config import PROCESSED, ROOT, WEB_DATA

GRID = ROOT / "data" / "grid"
LOSS_TARGET = 0.03  # "fits flexibly" = loses at most 3% of its energy


def km2(geom):
    """Area in km² with a local equirectangular projection (fine at state scale)."""
    import math
    lat0 = geom.centroid.y
    k = math.cos(math.radians(lat0))
    return transform(lambda x, y, z=None: (x * 111.32 * k, y * 110.57), geom).area


def name_for(geom, substations, municipalities):
    inside = [s for s in substations if geom.contains(Point(s["lon"], s["lat"])) and s["name"] != "Unnamed substation"]
    if inside:
        return inside[0]["name"], inside[0].get("operator", "")
    c = geom.centroid
    m = min(municipalities.values(), key=lambda m: (m["lon"] - c.x) ** 2 + (m["lat"] - c.y) ** 2)
    return f"Area {m['name']}", ""


def fits(steps, key, target=LOSS_TARGET):
    ok = [s["flexible_mw"] for s in steps if (s["lifo_loss_by_plant"][-1] if key == "lifo" else s["pro_rata_loss"]) <= target]
    return max(ok) if ok else 0.0


def main() -> None:
    districts = json.loads((GRID / "ding0_mv_grid_districts_saarland.geojson").read_text(encoding="utf-8"))
    solar = pd.read_csv(GRID / "by_district.csv", dtype={"grid": str}).set_index("grid")
    firm = {d["grid"]: d for d in json.loads((GRID / "capacity_firm.json").read_text())["districts"]}
    flex = {d["grid"]: d for d in json.loads((GRID / "flexible.json").read_text())["districts"]}
    subs = json.loads((PROCESSED / "substations.json").read_text(encoding="utf-8"))
    muns = json.loads((PROCESSED / "municipalities.json").read_text(encoding="utf-8"))

    features = []
    for f in districts["features"]:
        grid = f["properties"]["grid"]
        geom = shape(f["geometry"])
        name, operator = name_for(geom, subs, muns)
        area = round(km2(geom), 1)
        p = {"id": grid, "name": name, "operator": operator, "population": f["properties"]["population"], "area_km2": area,
             "data": grid in firm}
        if grid in solar.index:
            s = solar.loc[grid]
            net = float(s.rooftop_mw + s.ground_mw)
            p.update({"units": int(s.units), "net_mw": round(net, 2), "rooftop_mw": round(float(s.rooftop_mw), 2),
                      "ground_mw": round(float(s.ground_mw), 2), "rooftop_share": round(float(s.rooftop_mw) / net, 3) if net else 0.0,
                      "new_mw_12m": round(float(s.new_12m_mw), 2), "growth_share": round(float(s.new_12m_mw) / net, 3) if net else 0.0,
                      "density_kw_km2": round(net * 1000 / area, 1) if area else 0.0})
        if grid in firm:
            d, x = firm[grid], flex[grid]
            p.update({
                "wind_mw": d["wind_mw"], "peak_load_mw": d["peak_load_mw"], "hvmv_mva": d["hvmv_mva"],
                "reinforced": d["reinforced"], "lv_grids": d["lv_grids"],
                "lv_double_share": d["lv_grids_at_least_double"], "lv_no_room_share": d["lv_grids_no_room"],
                "rooftop_room_mw": d["rooftop_extra_mw"],
                "firm_mw": d["substation_n1_mw"], "firm_all_mw": d["substation_mw"],
                "n1_today_loading": d["substation_n1_today_loading"],
                "flex_steps": [{"mw": s["flexible_mw"], "pro_rata": s["pro_rata_loss"], "lifo": s["lifo_loss_by_plant"],
                                "hours": s["hours_curtailed"]} for s in x["steps"]],
                "flex_prorata_mw": fits(x["steps"], "pro_rata"), "flex_lifo_mw": fits(x["steps"], "lifo"),
            })
        features.append({"type": "Feature", "properties": p, "geometry": mapping(geom)})

    # the same substation or municipality can name two districts: add the district number
    names = pd.Series([f["properties"]["name"] for f in features])
    for f, dup in zip(features, names.duplicated(keep=False)):
        if dup:
            f["properties"]["name"] += f" ({f['properties']['id']})"
    have = [f["properties"] for f in features if f["properties"]["data"]]
    summary = {
        "districts": len(features), "with_data": len(have),
        "missing": [f["properties"]["id"] for f in features if not f["properties"]["data"]],
        "net_mw": round(sum(p.get("net_mw", 0) for p in have), 1),
        "new_mw_12m": round(sum(p.get("new_mw_12m", 0) for p in have), 1),
        "firm_mw": round(sum(p["firm_mw"] for p in have)),
        "no_firm_room": sum(p["firm_mw"] <= 0.5 for p in have),
        "rooftop_room_mw": round(sum(p["rooftop_room_mw"] for p in have)),
        "lv_grids": sum(p["lv_grids"] for p in have),
        "lv_double_share": round(sum(p["lv_double_share"] * p["lv_grids"] for p in have) / sum(p["lv_grids"] for p in have), 3),
        "flex_prorata_mw": round(sum(p["flex_prorata_mw"] for p in have)),
        "flex_lifo_mw": round(sum(p["flex_lifo_mw"] for p in have)),
        "loss_target": LOSS_TARGET,
        "reinforced": {k: sum(p["reinforced"][k] for p in have) for k in have[0]["reinforced"]},
    }
    # Each district's worst day for flexible plants, with the export allowed in each hour,
    # for the grid-edge gateway's flexible-connection mode.
    days = json.loads((GRID / "flex_days.json").read_text())
    flex_days = {}
    for p in have:
        day = days[p["id"]]
        date = (pd.Timestamp("2025-01-01") + pd.Timedelta(days=day["day"])).strftime("%Y-%m-%d")
        flex_days[p["id"]] = {"name": p["name"], "firm_mw": p["firm_mw"], "date": date, **{k: v for k, v in day.items() if k != "day"}}
    (WEB_DATA / "flex_days.json").write_text(json.dumps(flex_days), encoding="utf-8")
    (WEB_DATA / "districts.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    (WEB_DATA / "capacity_summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
