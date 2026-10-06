"""Fetch daily COVID-19 cases for every English lower-tier local authority from
the UKHSA dashboard API, 2020-08-15 .. 2021-03-15, one row per area."""
import json, urllib.request, urllib.parse, time, csv, sys
B = ("https://api.ukhsa-dashboard.data.gov.uk/themes/infectious_disease/sub_themes/"
     "respiratory/topics/COVID-19/geography_types/Lower%20Tier%20Local%20Authority")
geos = json.load(open("geos.json"))
rows = []
for i, g in enumerate(geos):
    name = g["name"]
    url = (f"{B}/geographies/{urllib.parse.quote(name)}/metrics/COVID-19_cases_casesByDay"
           f"?page_size=365&date_from=2020-08-15&date_to=2021-03-15")
    for attempt in range(4):
        try:
            d = json.load(urllib.request.urlopen(url, timeout=60))
            break
        except Exception as e:
            time.sleep(2 + 3 * attempt); d = None
    if not d:
        print("FAIL", name, flush=True); continue
    res = sorted(d["results"], key=lambda r: r["date"])
    code = res[0]["geography_code"] if res else ""
    for r in res:
        rows.append((code, name, r["date"], r["metric_value"]))
    if i % 25 == 0:
        print(i, name, len(res), flush=True)
    time.sleep(0.15)
with open("covid_ltla.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["areaCode", "areaName", "date", "cases"]); w.writerows(rows)
print("done", len(rows))
