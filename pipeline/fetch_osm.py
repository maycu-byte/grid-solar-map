"""Step 2 — fetch grid and boundary data for the state from OpenStreetMap (Overpass API).

- 110 kV substations ("Umspannwerke"): where the high-voltage grid feeds the distribution
  grid. Each one becomes the centre of a service area.
- Municipality centres, keyed by the official municipality code (AGS), used to place the
  small rooftop units that MaStR publishes without coordinates.
- The state boundary, to clip the service areas.

Output: data/processed/substations.json, municipalities.json, boundary.geojson
"""
import json
import time

import requests
from shapely.geometry import LineString, mapping
from shapely.ops import polygonize, unary_union

from config import OVERPASS_URL, PROCESSED, STATE_ISO, USER_AGENT


def overpass(query: str) -> dict:
    for attempt in range(3):
        r = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=180,
        )
        if r.status_code == 200:
            return r.json()
        print(f"  Overpass HTTP {r.status_code}, retrying in 20 s…")
        time.sleep(20)
    r.raise_for_status()


def substations() -> list[dict]:
    data = overpass(f"""
        [out:json][timeout:120];
        area["ISO3166-2"="{STATE_ISO}"]->.a;
        nwr["power"="substation"]["voltage"~"110000"](area.a);
        out center tags;""")
    out = []
    for el in data["elements"]:
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        tags = el.get("tags", {})
        if lat is None:
            continue
        out.append({
            "id": f"{el['type']}/{el['id']}",
            "name": tags.get("name") or tags.get("ref") or "Unnamed substation",
            "operator": tags.get("operator", ""),
            "voltage": tags.get("voltage", ""),
            "lat": lat,
            "lon": lon,
        })
    return out


def municipalities() -> dict[str, dict]:
    data = overpass(f"""
        [out:json][timeout:120];
        area["ISO3166-2"="{STATE_ISO}"]->.a;
        relation["boundary"="administrative"]["admin_level"="8"](area.a);
        out center tags;""")
    out = {}
    for el in data["elements"]:
        tags = el.get("tags", {})
        code = tags.get("de:amtlicher_gemeindeschluessel")
        if code and "center" in el:
            out[code] = {"name": tags.get("name", ""), "lat": el["center"]["lat"], "lon": el["center"]["lon"]}
    return out


def postcodes() -> dict[str, dict]:
    """Centres of postcode areas — much finer than municipalities for placing small units."""
    data = overpass(f"""
        [out:json][timeout:120];
        area["ISO3166-2"="{STATE_ISO}"]->.a;
        relation["boundary"="postal_code"](area.a);
        out center tags;""")
    out = {}
    for el in data["elements"]:
        code = el.get("tags", {}).get("postal_code")
        if code and "center" in el:
            out[code] = {"lat": el["center"]["lat"], "lon": el["center"]["lon"]}
    return out


def boundary() -> dict:
    data = overpass(f"""
        [out:json][timeout:120];
        relation["boundary"="administrative"]["ISO3166-2"="{STATE_ISO}"];
        out geom;""")
    rel = data["elements"][0]
    lines = [
        LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
        for m in rel["members"]
        if m.get("type") == "way" and m.get("role") in ("outer", "") and "geometry" in m
    ]
    shape = unary_union(list(polygonize(unary_union(lines))))
    return {"type": "Feature", "properties": {"name": rel["tags"].get("name")}, "geometry": mapping(shape)}


def main() -> None:
    subs = substations()
    (PROCESSED / "substations.json").write_text(json.dumps(subs, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"110 kV substations: {len(subs)}")

    mun = municipalities()
    (PROCESSED / "municipalities.json").write_text(json.dumps(mun, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"municipalities with official code: {len(mun)}")

    plz = postcodes()
    (PROCESSED / "postcodes.json").write_text(json.dumps(plz, indent=1), encoding="utf-8")
    print(f"postcode areas: {len(plz)}")

    b = boundary()
    (PROCESSED / "boundary.geojson").write_text(json.dumps(b), encoding="utf-8")
    print(f"boundary: {b['geometry']['type']}")


if __name__ == "__main__":
    main()
