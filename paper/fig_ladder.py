"""Central figure: measured representation values on 701 economic series.

Reads ladder_ablation.csv and r5_nosticky_dev.csv; the final-system increment
is split into the lattice-projection component and the remainder.

    python fig_ladder.py
"""
from __future__ import annotations
import csv
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

FIG = os.path.join(os.path.dirname(__file__), "figures")
CSV = os.path.expanduser("~/github/skaters/benchmarks/ladder_ablation.csv")
NS = os.path.expanduser("~/github/skaters/benchmarks/r5_nosticky_dev.csv")
plt.rcParams.update({
    "font.size": 10, "axes.titlesize": 10, "axes.labelsize": 10,
    "legend.fontsize": 8.5, "figure.dpi": 150, "savefig.bbox": "tight",
    "font.family": "serif",
})
BLUE, GREEN, ORANGE, GREY = "#1f4ed8", "#15803d", "#c2410c", "#888888"

RUNGS = ["R0_uncond", "R1_location", "R2_scale", "R3_seasonal", "R4_serial", "R5_full"]


def main():
    rows = list(csv.DictReader(open(CSV)))
    good = [{k: float(r[k]) for k in RUNGS} | {"series": r["series"]} for r in rows
            if all(r[k] not in ("", "nan") for k in RUNGS)]
    ns = {r["series"]: float(r["R5_nosticky"]) for r in csv.DictReader(open(NS))
          if r["R5_nosticky"] not in ("", "nan")}
    good = [g for g in good if g["series"] in ns]
    n = len(good)
    means = [sum(g[k] for g in good) / n for k in RUNGS]
    total = means[-1] - means[0]
    deltas = [means[i + 1] - means[i] for i in range(4)]
    ns_mean = sum(ns[g["series"]] for g in good) / n
    d_other = ns_mean - means[4]          # final bundle net of lattice
    d_lattice = means[5] - ns_mean        # lattice projection component
    labels = ["location", "scale", "seasonal", "serial",
              "final bundle\n(excl. lattice)", "lattice\nprojection"]
    vals = deltas + [d_other, d_lattice]
    imps = []
    for i in range(4):
        imps.append(sum(1 for g in good if g[RUNGS[i + 1]] > g[RUNGS[i]]) / n)
    imps.append(sum(1 for g in good if ns[g["series"]] > g["R4_serial"]) / n)
    imps.append(sum(1 for g in good if g["R5_full"] > ns[g["series"]]) / n)

    fig, ax = plt.subplots(figsize=(6.4, 2.9))
    ypos = list(range(len(labels) - 1, -1, -1))
    colors = [GREY, BLUE, GREY, GREY, GREEN, ORANGE]
    ax.barh(ypos, vals, color=colors, height=0.62)
    ax.set_yticks(ypos, labels)
    ax.set_xlabel("measured representation value (nats per observation)")
    ax.set_xlim(min(0, min(vals) * 1.2), max(vals) * 1.55)
    for y, d, imp in zip(ypos, vals, imps):
        ax.text(max(d, 0) + 0.004, y,
                f"{100*d/total:.0f}%  (improves {100*imp:.0f}% of series)",
                va="center", fontsize=8.5, color="#333333")
    ax.set_title(f"Where predictive value comes from: {n} economic series, "
                 f"total recovered gain {total:.2f} nats/obs", fontsize=10)
    ax.spines[["top", "right"]].set_visible(False)
    fig.savefig(os.path.join(FIG, "fig_ladder.pdf"))
    print("wrote", os.path.join(FIG, "fig_ladder.pdf"))


if __name__ == "__main__":
    main()
