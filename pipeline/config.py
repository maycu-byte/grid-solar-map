"""Shared settings for the pipeline."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
WEB_DATA = ROOT / "web" / "data"

# Region to analyse. Saarland is small (≈2,570 km²) and good for validating the method;
# any German state works by changing these two values.
STATE_NAME = "Saarland"          # value of the MaStR "Bundesland" column
STATE_ISO = "DE-SL"              # ISO 3166-2 code used by OpenStreetMap

SOLAR_ZIP = RAW / "bnetza_mastr_solar_raw.csv.zip"
SOLAR_URL = "https://zenodo.org/records/14843222/files/bnetza_mastr_solar_raw.csv.zip?download=1"

# Identify ourselves to public APIs (Overpass asks for it).
USER_AGENT = "grid-solar-map/0.1 (open-source portfolio project)"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

for folder in (RAW, PROCESSED, WEB_DATA):
    folder.mkdir(parents=True, exist_ok=True)
