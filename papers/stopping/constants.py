#!/usr/bin/env python3
"""Every number in stopping.tex, recomputed from the tagged store.

The paper's final version is a substitution of constants, and after a referee
caught two hand-transcribed claims (a false "best calibrated" and a wrong
recovery range) the rule is: no number or comparative reaches the manuscript
except through this script. Run it plain to print the constants block; run
with --check to fail (exit 1) if stopping.tex disagrees with the store.

Reads the skaters tidy store shards (CSV) directly; stdlib only, streaming.
Set SKATERS_BENCH to the bench directory if not at the default path.
"""
import csv
import collections
import math
import os
import re
import sys

BENCH = os.environ.get(
    "SKATERS_BENCH",
    os.path.expanduser("~/github/skaters/surrogate/bench"))

# tier -> (shard dir, task-tag marker, real shards)
TIERS = {
    "CONFB": ("fred_shards_m6", ":CONFB:", ("daily", "monthly", "weekly")),
    "CONF": ("fred_shards_m6", ":CONF:", ("daily", "monthly", "weekly")),
}
CONTROLS = {  # tier -> (shard dir, marker, control shards)
    "CONFB": ("iid_shards_m6", ":CONFNB:", ("iid-gauss", "iid-t3", "iid-lap")),
    "CONF": ("iid_shards_m6", ":CONFNULL:", ("iid-gauss", "iid-t3", "iid-lap")),
}
BASE = "laplace"
STOP = "laplace_conformal400"
COMPOSE = "laplace_conffloat400"
ARMS = (BASE, STOP, COMPOSE, "laplace_confewma150")
HORIZONS = ("1", "6", "12")
FLOORS = (-25.0, -20.0, -15.0, -10.0)


def _rows(directory, shards, suffix=""):
    for s in shards:
        path = os.path.join(BENCH, directory, f"{s}{suffix}.csv")
        if not os.path.exists(path):
            continue
        with open(path) as fh:
            yield from csv.DictReader(fh)


def _study_tags(directory, marker, shards):
    """Killed/restarted fills and mid-campaign harness edits leave multiple
    code-hash tags under one study; strict single-tag reads can lose half the
    panel. Policy: pool every tag under the study marker, dedupe per cell
    keeping the latest row (arm-code changes between chunks were
    parity-checked), and surface per-tag counts so contamination is visible."""
    counts = collections.Counter()
    for r in _rows(directory, shards):
        if marker in r["task"]:
            counts[r["task"]] += 1
    return counts


def _paired_lp(directory, marker, shards):
    """(uid, horizon) -> [lp_native per arm], only cells where all arms fill.
    Pools study tags; a later row for the same cell overwrites an earlier."""
    idx = {a: i for i, a in enumerate(ARMS)}
    cells = {}
    for r in _rows(directory, shards):
        if marker not in r["task"] or r["metric"] != "lp_native":
            continue
        i = idx.get(r["model"])
        if i is None:
            continue
        c = cells.setdefault((r["uid"], r["horizon"]), [None] * len(ARMS))
        c[i] = float(r["value"])
    return {k: v for k, v in cells.items() if None not in v}


def _gaps(paired, floor=-25.0):
    """horizon -> {arm: mean lp deficit against BASE}, plus paired n."""
    sums = collections.defaultdict(lambda: collections.defaultdict(float))
    n = collections.Counter()
    for (uid, h), vals in paired.items():
        n[h] += 1
        for a, v in zip(ARMS, vals):
            sums[h][a] += max(v, floor)
    out = {}
    for h in n:
        base = sums[h][BASE] / n[h]
        out[h] = {a: base - sums[h][a] / n[h] for a in ARMS[1:]}
        out[h]["_n"] = n[h]
    return out


def _floor_stats(paired):
    """arm -> (rows, floored at -25), on the same paired cells as the gaps."""
    tot = collections.Counter()
    hit = collections.Counter()
    for vals in paired.values():
        for a, v in zip(ARMS, vals):
            tot[a] += 1
            if v <= -24.999:
                hit[a] += 1
    return {a: (tot[a], hit[a]) for a in tot}


def _coverage(directory, marker, shards):
    """arm -> overall 80% empirical coverage, paired: only (uid, horizon)
    cells where every arm has a row, so arms are compared on identical data."""
    idx = {a: i for i, a in enumerate(ARMS)}
    cells = {}
    for r in _rows(directory, shards, suffix="_raw"):
        if marker not in r["task"]:
            continue
        i = idx.get(r["model"])
        if i is None:
            continue
        y = float(r["y"])
        if math.isnan(y):
            continue
        c = cells.setdefault((r["uid"], r["horizon"]), [None] * len(ARMS))
        c[i] = 1 if float(r["q10"]) <= y <= float(r["q90"]) else 0
    inside = collections.Counter()
    n = 0
    for vals in cells.values():
        if None in vals:
            continue
        n += 1
        for a, v in zip(ARMS, vals):
            inside[a] += v
    return {a: inside[a] / n for a in inside} if n else {}


def compute():
    out = {}
    for tier, (d, marker, shards) in TIERS.items():
        tag_counts = _study_tags(d, marker, shards)
        if not tag_counts:
            out[tier] = None
            continue
        paired = _paired_lp(d, marker, shards)
        raw = _gaps(paired)
        # null-control adjustment: subtract the same arm's deficit on the
        # matched iid control (a finite-sample-overhead gauge, see paper
        # section Design; not an unbiased estimate of the estimation term).
        cd, cmarker, cshards = CONTROLS[tier]
        cgaps = _gaps(_paired_lp(cd, cmarker, cshards))
        adj = None
        if cgaps:
            adj = {
                h: {a: raw[h][a] - cgaps[h][a] for a in ARMS[1:]}
                for h in raw if h in cgaps
            }
        out[tier] = {
            "tags": dict(tag_counts),
            "raw": raw,
            "adjusted": adj,
            "control_n": {h: cgaps[h]["_n"] for h in cgaps} if cgaps else {},
            "floors": {
                F: _gaps(paired, floor=F) for F in FLOORS
            },
            "floor_binding": _floor_stats(paired),
            "coverage": _coverage(d, marker, shards),
        }
    return out


def report(res):
    for tier, r in res.items():
        print(f"\n===== {tier} =====")
        if r is None:
            print("no rows yet")
            continue
        print(f"pooled tags (dedupe: latest row per cell wins):")
        for t, c in sorted(r["tags"].items(), key=lambda kv: -kv[1]):
            print(f"  {c:>10} rows  {t}")
        if r["control_n"]:
            print(f"control paired cells per horizon: {r['control_n']}")
        for label, table in (("raw", r["raw"]), ("null-control-adjusted", r["adjusted"])):
            if table is None:
                print(f"{label}: control not filled yet")
                continue
            print(f"{label} lp deficit vs {BASE} (paired):")
            for h in HORIZONS:
                if h not in table:
                    continue
                row = table[h]
                stop, comp = row[STOP], row[COMPOSE]
                n = r["raw"][h]["_n"]
                rec = 100.0 * (stop - comp) / stop if stop else float("nan")
                print(f"  h={h:>2} n={n:>7}  stop={stop:+.3f}  compose={comp:+.3f}"
                      f"  position={stop - comp:+.3f}  recovery={rec:.0f}%")
        print("floor sensitivity (stop deficit, raw, by floor):")
        for F in FLOORS:
            row = r["floors"][F].get("1", {})
            if STOP in row:
                print(f"  floor={F:6.1f}  h=1 stop={row[STOP]:+.4f}"
                      f"  compose={row[COMPOSE]:+.4f}")
        print("floor binding at -25 by arm:")
        for a, (tot, hit) in sorted(r["floor_binding"].items()):
            print(f"  {a:24s} {100.0 * hit / tot:.3f}% of {tot}")
        print("overall 80% empirical coverage (target 0.800):")
        for a, c in sorted(r["coverage"].items()):
            print(f"  {a:24s} {c:.3f}  |err|={abs(c - 0.800):.3f}")


def check(res):
    """Fail if stopping.tex asserts numbers the store does not support."""
    tex = open(os.path.join(os.path.dirname(__file__) or ".",
                            "stopping.tex")).read()
    failures = []
    r = res.get("CONFB")
    if r and r["adjusted"]:
        for h in HORIZONS:
            row = r["adjusted"].get(h)
            if not row:
                continue
            stop = f"{row[STOP]:.3f}"
            if stop.lstrip("0.") and stop not in tex:
                failures.append(
                    f"CONFB h={h}: adjusted stop deficit {stop} not in tex")
    # comparative claims are checked as computed facts, not string matches:
    # the tex may not say the stop arm is best/closest on any coverage column
    # unless the store says so (it currently does not).
    if r and r["coverage"]:
        errs = {a: abs(c - 0.800) for a, c in r["coverage"].items()}
        closest = min(errs, key=errs.get)
        if closest == STOP and "closest in none" in tex:
            failures.append("tex says stop closest in none; store disagrees")
        if closest != STOP:
            for phrase in ("best calibrated", "best in the table"):
                if phrase in tex:
                    failures.append(f"tex claims '{phrase}' but {closest} "
                                    "is closest to target")
    for f in failures:
        print(f"CHECK FAIL: {f}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    res = compute()
    report(res)
    if "--check" in sys.argv:
        sys.exit(check(res))
