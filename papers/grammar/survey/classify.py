"""Provisional classification of the stopping-claim frame.

THREE STAGES, and only the first two are trustworthy on their own.

  1. abstracts   re-query arXiv storing the abstract, which harvest.py dropped
  2. screen      apply documented keyword rules to produce a PROVISIONAL label
                 and, more importantly, a shortlist of COMPOSE candidates
  3. fulltext    for the shortlist only, pull the paper text and grep the
                 decisive patterns

The screen is a filter, not a verdict. Its job is to make the reading pass
tractable by ruling out the papers that obviously stop, so a human or a careful
model only has to read the residue. Any paper whose label matters to the claim
must be read.

Labels, from ../STOPPING-SURVEY.md:

  STOP     keeps the empirical map, quotes its output as the answer
  REPLACE  substitutes a conditional estimate for the pooled quantile
  TUNE     keeps the map, adapts the level online
  CONSUME  conformal output feeds a downstream decision, not a coordinate system
  COMPOSE  keeps the map and fits a model on its output   <-- the only refuter
  NA       survey, theory, or application proposing no method

A SECOND, ORTHOGONAL axis: what the paper does about residual POOLING. The
smoothing-validity theorem says exact validity forces uniform pooling within a
pre-committed stratification, so the field splits three ways, and the interesting
cell is the one the theorem prices:

  POOLED      one empirical law, no granularity at all (the default)
  STRATIFIED  pools within fixed strata: Mondrian, binned, group-conditional,
              clusterwise. Coarser granularity, still pooling -- still eschews
              smoothness, KEEPS exactness. The theorem permits this.
  SMOOTH      departs from pooling: kernel / localized / similarity /
              nearest-neighbour / test-centred weights. The theorem says this
              FORFEITS exact validity (coverage gap of order the bias), so any
              SMOOTH paper claiming an exact distribution-free guarantee is
              either using known covariate-shift tilts (the Tibshirani escape)
              or overclaiming. SMOOTH papers are therefore shortlisted for
              full-text checking of their validity claim, the same asymmetric
              logic as COMPOSE: a missed overclaim damages the argument, a
              false positive costs one reading.

Usage:
    python classify.py abstracts      # stage 1, a few minutes
    python classify.py screen         # stage 2, instant
    python classify.py fulltext       # stage 3, slow, run overnight
"""

import csv
import re
import sys
import time
import urllib.parse
import urllib.request

API = "http://export.arxiv.org/api/query"
QUERY = 'ti:"conformal prediction"'
FRAME = "frame.csv"
WITH_ABS = "frame_abstracts.csv"
SCREENED = "frame_screened.csv"
FULLTEXT = "fulltext_checks.csv"

# --- the screen -------------------------------------------------------------
# Each rule is (label, regex). Order matters: the first match wins, except that
# COMPOSE_HINT is evaluated independently and always recorded, because a missed
# COMPOSE is the only error that damages the claim. False positives there are
# cheap; false negatives are not.

COMPOSE_HINT = re.compile(
    r"(after|downstream of|on top of|post-)\s+(the\s+)?"
    r"(conformal|rank|empirical|calibrat\w+)\s+"
    r"\w*\s*(transform|map|step|output)"
    r"|"
    r"(gaussianiz\w*|normal scores?|probability integral transform|\bPIT\b)"
    r".{0,120}?(fit|model|regress|learn|refit|autoregress)"
    r"|"
    r"(transform|map)\w*\s+(the\s+)?residual.{0,80}?then\s+\w*(model|fit|learn)",
    re.I | re.S,
)

# --- the pooling axis --------------------------------------------------------
# First match wins: SMOOTH before STRATIFIED, because papers that smooth often
# also mention groups, and the departure from pooling is the informative event.
POOLING_RULES = [
    # SMOOTH means the WEIGHTS ON CALIBRATION RESIDUALS depend on the test point.
    # It does NOT mean a smooth score map: a kernel or normalized SCORE is a richer
    # A(x,.) and is still pooled (frozen-floor: the input may enter through the
    # score while the shape stays one pooled object). The first version of this
    # rule matched bare "kernel|similarity|attention" and caught base-model
    # machinery (hypernetwork kernel parameters, KDE features, retrieval
    # similarity), inflating SMOOTH to 91. The rule now requires the smoothing
    # word to bind to the calibration/residual/weighting step.
    ("SMOOTH", re.compile(
        r"localized\s+conformal|localised\s+conformal|\bLCP\b"
        r"|weighted\s+conformal|conformal\s+prediction\s+with\s+\w*\s*weights"
        r"|(kernel|similarity|distance|proximity).{0,40}?weight\w*\s+"
        r"(the\s+)?(residual|calibration|nonconformity|score)"
        r"|(weight|reweight|re-weight)\w*\s+(the\s+)?"
        r"(residual|calibration|nonconformity|score)s?"
        r"|nearest.?neighbou?r.{0,40}?(residual|calibration|conformal\s+set)"
        r"|test.?(point|centred|centered)\s+weight", re.I | re.S)),
    ("STRATIFIED", re.compile(
        r"mondrian|group.?(conditional|wise)|class.?conditional|clusterwise"
        r"|cluster.?(conditional|based)\s+conformal|binn?ed|stratif\w+"
        r"|taxonom\w+|per.?group\s+(coverage|calibrat)", re.I)),
]
# An exactness CLAIM, recorded independently on SMOOTH papers: the cell the
# smoothing-validity theorem prices is "departs from pooling AND claims exact
# finite-sample validity".
EXACT_CLAIM = re.compile(
    r"exact\s+(finite.?sample\s+)?(coverage|validity)"
    r"|finite.?sample\s+(coverage\s+)?guarantee"
    r"|distribution.?free\s+(coverage|validity|guarantee)"
    r"|provably?\s+valid|valid\s+prediction\s+(set|interval)", re.I)

RULES = [
    ("REPLACE", re.compile(
        r"(reweight|re-weight|weighted)\s+\w*\s*(conformity|nonconformity|residual)"
        r"|replace\w*\s+the\s+empirical\s+quantile"
        r"|conditional\s+quantile\s+(estimat|regress)"
        r"|localiz\w+\s+conformal|localized\s+CP", re.I)),
    ("TUNE", re.compile(
        r"adaptive\s+conformal|online\s+update\s+of\s+.{0,20}alpha"
        r"|adjust\w*\s+the\s+(coverage\s+)?level\s+online"
        r"|PID\s+contro", re.I)),
    ("CONSUME", re.compile(
        r"pseudo-?label|active\s+learning|reinforcement\s+learning|agent"
        r"|filter\w*\s+\w*\s*(candidate|hypothes|label)"
        r"|(select|screen|gate)\w*\s+\w*\s*(sample|data|training)", re.I)),
    ("NA", re.compile(
        r"^(a\s+)?(survey|review|tutorial|overview|introduction)\b"
        r"|we\s+(survey|review)\b", re.I)),
]


def fetch(url, retries=4):
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            if attempt == retries - 1:
                print(f"    give up: {exc}", file=sys.stderr)
                return ""
            time.sleep(5 * (attempt + 1))
    return ""


def stage_abstracts():
    rows, seen = [], set()
    start, page = 0, 100
    while True:
        url = (f"{API}?search_query={urllib.parse.quote(QUERY)}"
               f"&start={start}&max_results={page}"
               f"&sortBy=submittedDate&sortOrder=descending")
        xml = fetch(url)
        entries = re.findall(r"<entry>(.*?)</entry>", xml, re.S)
        if not entries:
            break
        for e in entries:
            def tag(n):
                m = re.search(rf"<{n}>(.*?)</{n}>", e, re.S)
                return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
            idm = re.search(r"<id>http://arxiv\.org/abs/([^<]+)</id>", e)
            aid = idm.group(1) if idm else ""
            if not aid or aid in seen:
                continue
            seen.add(aid)
            rows.append({"arxiv_id": aid, "title": tag("title"),
                         "year": tag("published")[:4], "abstract": tag("summary")})
        print(f"  {start}..{start + len(entries)}  (kept {len(rows)})")
        start += page
        time.sleep(3)
    with open(WITH_ABS, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["arxiv_id", "title", "year", "abstract"])
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows with abstracts to {WITH_ABS}")


def stage_screen():
    rows = list(csv.DictReader(open(WITH_ABS, encoding="utf-8")))
    out, counts, shortlist = [], {}, 0
    for r in rows:
        text = f"{r['title']} {r['abstract']}"
        label = "STOP"          # the default, and the claim's prediction
        for name, rx in RULES:
            if rx.search(text):
                label = name
                break
        hint = bool(COMPOSE_HINT.search(text))
        if hint:
            shortlist += 1
        pooling = "POOLED"                 # the default, and the theorem's subject
        for pname, prx in POOLING_RULES:
            if prx.search(text):
                pooling = pname
                break
        exact = bool(EXACT_CLAIM.search(text))
        counts[label] = counts.get(label, 0) + 1
        counts[f"pool:{pooling}"] = counts.get(f"pool:{pooling}", 0) + 1
        if pooling == "SMOOTH" and exact:
            counts["SMOOTH+exact-claim"] = counts.get("SMOOTH+exact-claim", 0) + 1
        out.append({**r, "provisional": label,
                    "compose_candidate": "yes" if hint else "",
                    "pooling": pooling,
                    "claims_exact": "yes" if exact else "",
                    "label": "", "evidence": "", "checked": ""})
    with open(SCREENED, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    print("provisional labels:", dict(sorted(counts.items())))
    print(f"COMPOSE candidates flagged for reading: {shortlist}")
    print(f"wrote {SCREENED}")


def stage_fulltext():
    rows = [r for r in csv.DictReader(open(SCREENED, encoding="utf-8"))
            if r["compose_candidate"] == "yes"]
    print(f"fetching full text for {len(rows)} candidates")
    checks = []
    for i, r in enumerate(rows, 1):
        aid = r["arxiv_id"]
        txt = fetch(f"https://arxiv.org/abs/{aid}")
        hits = sorted({m.group(0)[:90].replace("\n", " ")
                       for m in COMPOSE_HINT.finditer(txt)})
        checks.append({"arxiv_id": aid, "title": r["title"],
                       "n_hits": len(hits), "hits": " || ".join(hits[:5])})
        print(f"  {i}/{len(rows)} {aid} hits={len(hits)}")
        time.sleep(3)
        if i % 25 == 0:
            _flush(checks)
    _flush(checks)
    print(f"wrote {FULLTEXT}")


def _flush(checks):
    with open(FULLTEXT, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["arxiv_id", "title", "n_hits", "hits"])
        w.writeheader()
        w.writerows(checks)


if __name__ == "__main__":
    stage = sys.argv[1] if len(sys.argv) > 1 else "screen"
    {"abstracts": stage_abstracts, "screen": stage_screen,
     "fulltext": stage_fulltext}[stage]()
