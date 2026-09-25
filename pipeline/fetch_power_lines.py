"""High-voltage power lines and cables of the state from OpenStreetMap.

Every way tagged power=line or power=cable inside the state, with its voltage
(the highest one when a way carries several circuits), whether it is a cable,
its operator and its frequency (16.7 Hz lines belong to the railway grid).

Writes web/data/power_lines.geojson. Data © OpenStreetMap contributors, ODbL.

Usage: python fetch_power_lines.py [answer.json]   (an Overpass answer saved
before, for when the public servers are busy)
"""
import json
import sys
import time
from pathlib import Path

import requests

from config import OVERPASS_URL, STATE_ISO, USER_AGENT, WEB_DATA

QUERY = f"""
[out:json][timeout:120];
area["ISO3166-2"="{STATE_ISO}"]->.a;
(way["power"="line"](area.a); way["power"="cable"](area.a););
out tags geom;
"""


def max_kv(tag: str) -> int:
    vals = []
    for part in (tag or "").replace(",", ";").split(";"):
        try:
            vals.append(int(float(part.strip())) // 1000)
        except ValueError:
            continue
    return max(vals) if vals else 0


def overpass():
    r = None
    # Overpass answers 504 when busy: retry, then try a mirror
    for url in (OVERPASS_URL, OVERPASS_URL, "https://overpass.kumi.systems/api/interpreter"):
        try:
            r = requests.post(url, data={"data": QUERY}, headers={"User-Agent": USER_AGENT}, timeout=180)
            r.raise_for_status()
            break
        except requests.RequestException as e:
            print(f"{url}: {e}; retrying")
            r = None
            time.sleep(20)
    if r is None:
        raise SystemExit("Overpass did not answer; pass a saved answer as argument")
    return r.json()


def main() -> None:
    answer = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")) if len(sys.argv) > 1 else overpass()
    features = []
    for e in answer["elements"]:
        geom = e.get("geometry") or []
        if len(geom) < 2:
            continue
        t = e.get("tags", {})
        kv = max_kv(t.get("voltage", ""))
        features.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[round(p["lon"], 5), round(p["lat"], 5)] for p in geom]},
                         "properties": {"kv": kv, "cable": t.get("power") == "cable", "operator": t.get("operator", ""),
                                        "name": t.get("name", ""), "rail": "16.7" in t.get("frequency", "")}})
    (WEB_DATA / "power_lines.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")), encoding="utf-8")
    by = {}
    for f in features:
        by[f["properties"]["kv"]] = by.get(f["properties"]["kv"], 0) + 1
    print(f"{len(features)} lines and cables; by kV: {dict(sorted(by.items(), reverse=True))}")


if __name__ == "__main__":
    main()
