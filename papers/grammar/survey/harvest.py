"""Harvest the frame for the stopping claim.

The claim in the grammar paper is about what conformal methods do to the empirical
rank map. The defensible frame is every arXiv paper with "conformal prediction" in
the TITLE, which was 686 records on 2026-08-20. Papers with it only in the abstract
(1500) are mostly applications that consume conformal output, which is a separate
category and not a counterexample.

Exhaustive over a stated frame beats a sample. Run:

    python harvest.py            # writes frame.csv
    python harvest.py --refresh  # re-query arXiv

Then classify. The label set is the taxonomy in ../STOPPING-SURVEY.md:

    STOP        keeps the map, quotes its output as the answer
    REPLACE     substitutes a conditional estimate for the pooled quantile
    TUNE        keeps the map, adapts the level online
    CONSUME     conformal output feeds a downstream decision (filtering,
                pseudo-labelling, RL). NOT a counterexample: the set is used as a
                decision, not as a coordinate system to keep modelling in.
    COMPOSE     keeps the map and fits a model on its output  <-- the refuter
    NA          survey, theory, application with no method proposed
    UNCLEAR     needs full text

Only COMPOSE refutes the claim. Anything labelled COMPOSE or UNCLEAR should get a
full-text read and a quoted sentence in `evidence`.
"""

import argparse
import csv
import re
import sys
import time
import urllib.parse
import urllib.request

API = "http://export.arxiv.org/api/query"
QUERY = 'ti:"conformal prediction"'
PAGE = 100
FIELDS = ["arxiv_id", "title", "year", "primary_category", "label", "evidence", "checked"]


def fetch(start, page=PAGE, retries=4):
    url = (f"{API}?search_query={urllib.parse.quote(QUERY)}"
           f"&start={start}&max_results={page}"
           f"&sortBy=submittedDate&sortOrder=descending")
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.read().decode("utf-8")
        except Exception as exc:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1} after {exc}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    return ""


def parse(xml):
    """Minimal Atom parse. Avoids a dependency; the schema here is stable."""
    out = []
    for entry in re.findall(r"<entry>(.*?)</entry>", xml, re.S):
        def tag(name):
            m = re.search(rf"<{name}>(.*?)</{name}>", entry, re.S)
            return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
        idm = re.search(r"<id>http://arxiv\.org/abs/([^<]+)</id>", entry)
        cat = re.search(r'<arxiv:primary_category[^>]*term="([^"]+)"', entry)
        out.append({
            "arxiv_id": idm.group(1) if idm else "",
            "title": tag("title"),
            "year": tag("published")[:4],
            "primary_category": cat.group(1) if cat else "",
            "label": "",
            "evidence": "",
            "checked": "",
        })
    return out


def total(xml):
    m = re.search(r"<opensearch:totalResults[^>]*>(\d+)<", xml)
    return int(m.group(1)) if m else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="frame.csv")
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    first = fetch(0, page=1)
    n = total(first)
    print(f"frame size: {n} papers with 'conformal prediction' in the title")

    rows, start = [], 0
    while start < n:
        print(f"  {start}..{min(start + PAGE, n)}")
        rows.extend(parse(fetch(start)))
        start += PAGE
        time.sleep(3)  # arXiv asks for one request per three seconds

    # csv.writer quotes embedded commas and quotes properly. The earlier
    # survey100.csv was written without this and has at least one broken row.
    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
