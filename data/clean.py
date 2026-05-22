"""
EV Data Cleaning Script
Outputs processed JSON files to data/processed/ for D3.js consumption.
"""

import csv
import json
import os
from collections import defaultdict

BASE = os.path.dirname(__file__)
OUT = os.path.join(BASE, "processed")
os.makedirs(OUT, exist_ok=True)


def write_json(name, data):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    n = len(data) if isinstance(data, list) else len(data)
    print(f"  wrote {name}  ({n} records)")


# ─── 1. EV SALES (global, 2010-2024) ─────────────────────────────────────────
print("Processing ev_sales.csv …")

sales_by_year = defaultdict(float)
sales_by_region_year = defaultdict(lambda: defaultdict(float))
powertrain_by_year = defaultdict(lambda: defaultdict(float))

with open(os.path.join(BASE, "ev_sales.csv"), encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row["parameter"] != "EV sales" or row["unit"] != "Vehicles":
            continue
        try:
            year = int(row["year"])
            value = float(row["value"])
        except ValueError:
            continue
        if year > 2024:
            continue
        region = row["region"].strip()
        powertrain = row["powertrain"].strip() or "Unknown"

        sales_by_year[year] += value
        sales_by_region_year[region][year] += value
        powertrain_by_year[year][powertrain] += value

write_json("sales_by_year.json", [
    {"year": y, "sales": round(v)}
    for y, v in sorted(sales_by_year.items())
])

region_year_list = []
for region, years in sales_by_region_year.items():
    for year, sales in years.items():
        region_year_list.append({"region": region, "year": year, "sales": round(sales)})
region_year_list.sort(key=lambda d: (d["year"], d["region"]))
write_json("sales_by_region_year.json", region_year_list)

region_totals = {}
for region, years in sales_by_region_year.items():
    latest_year = max(years)
    region_totals[region] = {"region": region, "year": latest_year, "sales": round(years[latest_year])}
write_json("region_latest_sales.json", list(region_totals.values()))

pt_year_list = []
for year, pt_dict in sorted(powertrain_by_year.items()):
    for pt, sales in pt_dict.items():
        pt_year_list.append({"year": year, "powertrain": pt, "sales": round(sales)})
write_json("powertrain_by_year.json", pt_year_list)


# ─── 2. EV POPULATION (Washington State registrations) ───────────────────────
print("Processing ev_population.csv …")

def classify_segment(make, model):
    make = make.upper().strip()
    model = model.upper().strip()
    truck_kw = ['TRUCK', 'CYBERTRUCK', 'F-150', 'F150', 'SILVERADO', 'FRONTIER',
                'RIDGELINE', 'R1T', 'MAVERICK', 'RANGER', 'TACOMA', 'TUNDRA', 'COLORADO']
    van_kw   = ['VAN', 'TRANSIT', 'PACIFICA', 'SIENNA', 'ODYSSEY', 'MINIVAN', 'CARNIVAL']
    suv_kw   = ['MODEL X', 'MODEL Y', 'R1S', 'MACH-E', 'MUSTANG MACH', 'LYRIQ',
                'NAVIGATOR', 'AVIATOR', 'EXPLORER', 'EXPEDITION', 'TAHOE', 'SUBURBAN',
                'TRAVERSE', 'EQUINOX', 'BLAZER', 'ENCLAVE', 'ENCORE', 'ENVISION',
                'CROSSTREK', 'FORESTER', 'OUTBACK', 'ASCENT', 'COMPASS', 'WRANGLER',
                'GRAND CHEROKEE', 'TUCSON', 'IONIQ 5', 'EV6', 'TELLURIDE', 'SORENTO',
                'SPORTAGE', 'RAV4', 'HIGHLANDER', 'RX ', 'UX ', 'NX ', 'GX ', 'LX ',
                'X1 ', 'X3 ', 'X5 ', 'X7 ', 'EQB', 'EQC', 'GLE', 'GLB',
                'Q4', 'Q5', 'Q7', 'Q8', 'E-TRON', 'ID.4', 'ID.6', 'TAOS',
                'MACAN', 'CAYENNE', 'STELVIO', 'GRECALE', 'LEVANTE',
                'F-PACE', 'I-PACE', 'E-PACE', 'DEFENDER', 'DISCOVERY',
                'IONIQ 9', 'GV70', 'GV80', 'PALISADE', 'SANTA FE', 'NEXO',
                'VOLVO XC', 'POLESTAR 3']
    luxury_make = {'BMW', 'MERCEDES-BENZ', 'AUDI', 'PORSCHE', 'JAGUAR', 'BENTLEY',
                   'MASERATI', 'FERRARI', 'LAMBORGHINI', 'ROLLS-ROYCE',
                   'CADILLAC', 'LINCOLN', 'GENESIS', 'LUCID', 'POLESTAR'}

    if any(k in model for k in truck_kw):
        return 'Truck'
    if any(k in model for k in van_kw):
        return 'Van'
    if any(k in model for k in suv_kw):
        return 'SUV'
    if make in luxury_make:
        return 'Luxury'
    if make == 'TESLA':
        if 'MODEL S' in model or 'ROADSTER' in model:
            return 'Luxury'
        return 'Sedan'
    return 'Compact'

make_counts = defaultdict(int)
type_counts = defaultdict(int)
year_counts = defaultdict(int)
make_year_counts = defaultdict(lambda: defaultdict(int))
segment_year_counts = defaultdict(lambda: defaultdict(int))

with open(os.path.join(BASE, "ev_population.csv"), encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        make = row.get("Make", "").strip().title()
        make_upper = make.upper()
        model = row.get("Model", "").strip().upper()
        model_year = row.get("Model Year", "").strip()
        ev_type = row.get("Electric Vehicle Type", "").strip()
        ev_range = row.get("Electric Range", "").strip()

        if not make:
            continue

        make_counts[make] += 1

        if ev_type:
            label = "BEV" if "Battery Electric" in ev_type else "PHEV"
            type_counts[label] += 1

        if model_year.isdigit():
            yr = int(model_year)
            year_counts[yr] += 1
            make_year_counts[make][yr] += 1
            seg = classify_segment(make_upper, model)
            segment_year_counts[seg][yr] += 1

top_makes = sorted(make_counts.items(), key=lambda x: x[1], reverse=True)[:15]
write_json("top_manufacturers.json", [{"make": m, "count": c} for m, c in top_makes])
write_json("ev_type_share.json", [{"type": t, "count": c} for t, c in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)])
write_json("registrations_by_year.json", [{"year": y, "count": c} for y, c in sorted(year_counts.items())])

# Tesla year trend for sparkline
tesla_by_year = make_year_counts.get("Tesla", {})
write_json("tesla_by_year.json", [{"year": y, "count": c} for y, c in sorted(tesla_by_year.items())])

# Segment × year heatmap (only years 2015–2024 for cleaner display)
SEGMENTS = ['Compact', 'Sedan', 'SUV', 'Luxury', 'Truck', 'Van']
YEARS = list(range(2015, 2025))
heatmap_rows = []
for seg in SEGMENTS:
    for yr in YEARS:
        heatmap_rows.append({
            "segment": seg,
            "year": yr,
            "count": segment_year_counts[seg].get(yr, 0)
        })
write_json("segment_by_year.json", heatmap_rows)


# ─── 3. EV SPECS ─────────────────────────────────────────────────────────────
print("Processing ev_specs.csv …")

specs = []
seen = set()

with open(os.path.join(BASE, "ev_specs.csv"), encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        brand = row.get("brand", "").strip()
        model = row.get("model", "").strip()
        key = (brand, model)
        if key in seen or not brand:
            continue
        seen.add(key)

        def safe_float(val, default=None):
            try:
                v = float(val)
                return v if v > 0 else default
            except (ValueError, TypeError):
                return default

        battery  = safe_float(row.get("battery_capacity_kWh"))
        range_km = safe_float(row.get("range_km"))
        top_speed = safe_float(row.get("top_speed_kmh"))
        accel    = safe_float(row.get("acceleration_0_100_s"))
        efficiency = safe_float(row.get("efficiency_wh_per_km"))
        fast_charge = safe_float(row.get("fast_charging_power_kw_dc"))
        seats    = safe_float(row.get("seats"))
        segment  = row.get("segment", "").strip()
        drivetrain = row.get("drivetrain", "").strip()
        body     = row.get("car_body_type", "").strip()

        if battery is None or range_km is None:
            continue

        specs.append({
            "brand": brand,
            "model": model,
            "battery_kWh": battery,
            "range_km": range_km,
            "top_speed_kmh": top_speed,
            "accel_s": accel,
            "efficiency_wh_km": efficiency,
            "fast_charge_kw": fast_charge,
            "seats": int(seats) if seats else None,
            "segment": segment,
            "drivetrain": drivetrain,
            "body": body,
        })

write_json("ev_specs.json", specs)
print(f"\nDone. Output in: {OUT}")
