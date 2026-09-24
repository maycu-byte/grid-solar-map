"""Step 3 — assign each solar unit to a 110 kV substation and summarise per service area.

Method (and its limits, stated honestly in the README):
- A unit's location is its exact coordinate when MaStR publishes one (mostly larger
  systems). Small rooftop units are published without coordinates, so they are placed at
  the centre of their municipality.
- Each unit is assigned to the nearest 110 kV substation. Real grid topology is not
  public; nearest-substation (a Voronoi partition) is a common first approximation.
- Service areas are the Voronoi cells of the substations, clipped to the state boundary.

Output: web/data/areas.geojson, web/data/substations.geojson, web/data/summary.json
"""
import json
from datetime import date

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from shapely.geometry import MultiPoint, Point, mapping, shape
from shapely.ops import voronoi_diagram

from config import PROCESSED, STATE_NAME, WEB_DATA

KM_PER_DEG_LAT = 111.32


def to_km(lon, lat, lat0):
    """Equirectangular projection, accurate enough within one German state."""
    return np.column_stack([lon * KM_PER_DEG_LAT * np.cos(np.radians(lat0)), lat * KM_PER_DEG_LAT])


def main() -> None:
    units = pd.read_parquet(PROCESSED / "solar_units.parquet")
    subs = pd.DataFrame(json.loads((PROCESSED / "substations.json").read_text(encoding="utf-8")))
    muns = json.loads((PROCESSED / "municipalities.json").read_text(encoding="utf-8"))
    plzs = json.loads((PROCESSED / "postcodes.json").read_text(encoding="utf-8"))
    border = shape(json.loads((PROCESSED / "boundary.geojson").read_text(encoding="utf-8"))["geometry"])

    # 1) Location of every unit: exact coordinates > postcode centre > municipality centre.
    exact = units["lat"].notna() & units["lon"].notna()
    plz = units["postcode"].fillna("").str.strip()
    code = units["municipality_code"].fillna("")
    plz_lat = plz.map(lambda c: plzs.get(c, {}).get("lat"))
    plz_lon = plz.map(lambda c: plzs.get(c, {}).get("lon"))
    by_plz = ~exact & plz_lat.notna()
    units["loc_lat"] = np.where(exact, units["lat"], np.where(by_plz, plz_lat, code.map(lambda c: muns.get(c, {}).get("lat"))))
    units["loc_lon"] = np.where(exact, units["lon"], np.where(by_plz, plz_lon, code.map(lambda c: muns.get(c, {}).get("lon"))))
    units["located_by"] = np.where(exact, "coordinates", np.where(by_plz, "postcode", "municipality"))
    placed = units.dropna(subset=["loc_lat", "loc_lon"]).copy()
    unplaced = len(units) - len(placed)

    # Substations without a name in OSM are labelled after the nearest municipality.
    lat0 = subs["lat"].mean()
    mun_names = [m["name"] for m in muns.values()]
    mun_tree = cKDTree(to_km(np.array([m["lon"] for m in muns.values()]), np.array([m["lat"] for m in muns.values()]), lat0))
    _, near = mun_tree.query(to_km(subs["lon"].to_numpy(), subs["lat"].to_numpy(), lat0))
    unnamed = subs["name"].eq("Unnamed substation")
    subs.loc[unnamed, "name"] = [f"Substation near {mun_names[i]}" for i in near[unnamed.to_numpy()]]

    # 2) Nearest 110 kV substation.
    tree = cKDTree(to_km(subs["lon"].to_numpy(), subs["lat"].to_numpy(), lat0))
    dist_km, idx = tree.query(to_km(placed["loc_lon"].astype(float).to_numpy(), placed["loc_lat"].astype(float).to_numpy(), lat0))
    placed["substation"] = subs["id"].to_numpy()[idx]
    placed["distance_km"] = dist_km

    # 3) Service areas: Voronoi cells clipped to the state.
    points = MultiPoint([Point(xy) for xy in zip(subs["lon"], subs["lat"])])
    cells = voronoi_diagram(points, envelope=border.envelope.buffer(0.5))
    cell_for = {}
    for cell in cells.geoms:
        for i, row in subs.iterrows():
            if cell.contains(Point(row["lon"], row["lat"])):
                cell_for[row["id"]] = cell.intersection(border)
                break

    # 4) Metrics per area.
    snapshot = placed["commissioned"].max()
    last_12m = placed["commissioned"] > (snapshot - pd.DateOffset(years=1))
    placed["rooftop"] = placed["placement"].fillna("").str.contains("Bauliche Anlagen", case=False)
    placed["new_kw"] = np.where(last_12m, placed["net_kw"], 0.0)

    agg = placed.groupby("substation").agg(
        units=("unit_id", "count"),
        net_kw=("net_kw", "sum"),
        new_kw_12m=("new_kw", "sum"),
        rooftop_share=("rooftop", "mean"),
        small_units=("net_kw", lambda s: (s <= 30).sum()),
    )

    features, sub_features = [], []
    for _, s in subs.iterrows():
        a = agg.loc[s["id"]] if s["id"] in agg.index else None
        geom = cell_for.get(s["id"])
        area_km2 = geom.area * (KM_PER_DEG_LAT ** 2) * np.cos(np.radians(lat0)) if geom is not None else 0
        props = {
            "id": s["id"],
            "name": s["name"],
            "operator": s["operator"],
            "units": int(a["units"]) if a is not None else 0,
            "net_mw": round(float(a["net_kw"]) / 1000, 2) if a is not None else 0.0,
            "new_mw_12m": round(float(a["new_kw_12m"]) / 1000, 2) if a is not None else 0.0,
            "rooftop_share": round(float(a["rooftop_share"]), 3) if a is not None else 0.0,
            "area_km2": round(area_km2, 1),
        }
        props["density_kw_km2"] = round(props["net_mw"] * 1000 / area_km2, 1) if area_km2 else 0.0
        props["growth_share"] = round(props["new_mw_12m"] / props["net_mw"], 3) if props["net_mw"] else 0.0
        if geom is not None and not geom.is_empty:
            features.append({"type": "Feature", "properties": props, "geometry": mapping(geom)})
        sub_features.append({"type": "Feature", "properties": {"name": s["name"], "operator": s["operator"], "voltage": s["voltage"]},
                             "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]}})

    (WEB_DATA / "areas.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    (WEB_DATA / "substations.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": sub_features}), encoding="utf-8")

    summary = {
        "state": STATE_NAME,
        "snapshot": str(snapshot.date()) if pd.notna(snapshot) else None,
        "operating_units": int(len(units)),
        "placed_units": int(len(placed)),
        "unplaced_units": int(unplaced),
        "share_exact_coordinates": round(float(exact.mean()), 3),
        "share_by_postcode": round(float(by_plz.mean()), 3),
        "total_net_mw": round(float(placed["net_kw"].sum()) / 1000, 1),
        "new_mw_12m": round(float(placed["new_kw"].sum()) / 1000, 1),
        "substations": int(len(subs)),
        "median_distance_km": round(float(np.median(dist_km)), 1),
    }
    (WEB_DATA / "summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
