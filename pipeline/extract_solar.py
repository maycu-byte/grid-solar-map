"""Step 1 — extract the solar units of one German state from the open-MaStR dump.

The national file has millions of rows (≈723 MB zipped). It is read straight from the
zip in chunks, so it never has to be unzipped or held in memory at once.

Output: data/processed/solar_units.parquet
"""
import zipfile

import pandas as pd

from config import PROCESSED, SOLAR_ZIP, STATE_NAME

COLUMNS = {
    "EinheitMastrNummer": "unit_id",
    "EinheitBetriebsstatus": "status",
    "Bundesland": "state",
    "Landkreis": "district",
    "Gemeinde": "municipality",
    "Gemeindeschluessel": "municipality_code",
    "Postleitzahl": "postcode",
    "Laengengrad": "lon",
    "Breitengrad": "lat",
    "Bruttoleistung": "gross_kw",
    "Nettonennleistung": "net_kw",
    "Inbetriebnahmedatum": "commissioned",
    "Lage": "placement",
    "Einspeisungsart": "feed_in",
}


def main() -> None:
    with zipfile.ZipFile(SOLAR_ZIP) as z:
        member = next(n for n in z.namelist() if n.endswith(".csv"))
        with z.open(member) as f:
            chunks = pd.read_csv(
                f,
                usecols=lambda c: c in COLUMNS,
                dtype=str,
                chunksize=200_000,
                low_memory=True,
            )
            kept, total = [], 0
            for chunk in chunks:
                total += len(chunk)
                kept.append(chunk[chunk["Bundesland"] == STATE_NAME])
                print(f"\r  read {total:,} rows, kept {sum(map(len, kept)):,}", end="", flush=True)
    print()

    df = pd.concat(kept, ignore_index=True).rename(columns=COLUMNS)
    for col in ("lon", "lat", "gross_kw", "net_kw"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["commissioned"] = pd.to_datetime(df["commissioned"], errors="coerce")

    # Only units that are actually producing.
    df = df[df["status"].eq("In Betrieb")]
    out = PROCESSED / "solar_units.parquet"
    df.to_parquet(out, index=False)

    with_coords = df["lat"].notna().mean()
    print(f"{STATE_NAME}: {len(df):,} operating units, {df['net_kw'].sum() / 1000:,.1f} MW net")
    print(f"units with exact coordinates: {with_coords:.1%} (small rooftop units are published without them)")
    print(f"saved {out}")


if __name__ == "__main__":
    main()
