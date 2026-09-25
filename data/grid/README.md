# Grid data for the capacity layers

| File | What | Source | Licence |
|---|---|---|---|
| `ding0_mv_grid_districts_saarland.geojson` | The 47 MV grid districts of the Saarland (HV/MV substation service areas), simplified to 40 m | ding0 v0.3.0-alpha, eGo^n project, doi:10.5281/zenodo.10405129 | CC BY-SA 4.0 |
| `by_district.csv` | Solar of 10 February 2025 per district (rooftop, ground-mounted, added in 12 months, units) | open-MaStR placed on the ding0 grids by `lv-grid-stress-test/regional/mastr_today.py` | dl-de/by-2-0 (register) |
| `capacity_firm.json` | Firm capacity per district: rooftop room per LV grid, substation headroom (n-1) | `lv-grid-stress-test/regional/capacity.py` | CC BY-SA 4.0 (derived from ding0) |
| `flex_days.json` | Each district's worst day of 2025 for flexible plants and the share of their output allowed in each hour | `lv-grid-stress-test/regional/flexible.py` | CC BY-SA 4.0 (derived from ding0) |
| `flexible.json` | Flexible connections above the firm capacity: energy lost over 2025, pro rata and last in first out | `lv-grid-stress-test/regional/flexible.py` | CC BY-SA 4.0 (derived from ding0) |

Method, validation and limits: https://github.com/maycu-byte/lv-grid-stress-test/blob/main/docs/regional.md
