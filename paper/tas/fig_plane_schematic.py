"""Schematic of the coverage--score plane for The American Statistician version.

A conceptual diagram (no benchmark data) illustrating Section 7: conformalization is the
horizontal move (toward exact coverage, never up); X-blind recalibration moves up only to
the single-shape ceiling; crossing the residual-information gap I(R;X) to the oracle
requires conditioning on X. Self-contained: numpy + matplotlib only.

    python fig_plane_schematic.py   ->   figures/fig_plane.pdf
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams.update({
    "font.size": 10, "axes.titlesize": 10, "axes.labelsize": 10,
    "figure.dpi": 150, "savefig.bbox": "tight", "font.family": "serif",
})
BLUE, GREEN, ORANGE, GREY = "#1f4ed8", "#15803d", "#c2410c", "#888888"

FIG = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(FIG, exist_ok=True)

y_oracle, y_ceiling, y_base = 0.92, 0.64, 0.36
x_base, x_conf = 0.74, 0.08

fig, ax = plt.subplots(figsize=(5.4, 3.7))

# exact-coverage line
ax.axvline(x_conf, color=GREY, ls=":", lw=1)
ax.text(x_conf, 0.015, "exact marginal\ncoverage", color=GREY, fontsize=7.5,
        ha="center", va="bottom")

# single-shape ceiling
ax.axhline(y_ceiling, color=GREEN, ls="--", lw=1)
ax.text(0.45, y_ceiling + 0.012, "single-shape CPS ceiling", color=GREEN, fontsize=7.5,
        ha="center", va="bottom")

# oracle
ax.scatter([x_conf], [y_oracle], marker="*", s=180, color=ORANGE, zorder=5)
ax.text(x_conf + 0.03, y_oracle, "oracle", color=ORANGE, fontsize=9, va="center")

# residual-information gap bracket
ax.annotate("", xy=(0.90, y_oracle), xytext=(0.90, y_ceiling),
            arrowprops=dict(arrowstyle="<->", color="k", lw=1))
ax.text(0.875, (y_oracle + y_ceiling) / 2, r"$I(R;X)$", fontsize=9.5,
        ha="right", va="center")
ax.text(0.90, y_ceiling - 0.05, "only crossed by\nconditioning on $X$", fontsize=7,
        ha="right", va="top", color="0.35")

# base report
ax.scatter([x_base], [y_base], color=BLUE, s=45, zorder=5)
ax.text(x_base + 0.02, y_base - 0.02, "base report", color=BLUE, fontsize=8.5, va="top")

# conformalize: horizontal, left, never up
ax.annotate("", xy=(x_conf + 0.01, y_base), xytext=(x_base, y_base),
            arrowprops=dict(arrowstyle="->", color=BLUE, lw=1.7))
ax.text((x_base + x_conf) / 2, y_base + 0.015, "conformalize:\nleft, never up",
        color=BLUE, fontsize=8, ha="center", va="bottom")

# recalibrate / model: vertical, up to the ceiling
ax.annotate("", xy=(x_conf, y_ceiling - 0.01), xytext=(x_conf, y_base),
            arrowprops=dict(arrowstyle="->", color=GREEN, lw=1.7))
ax.text(x_conf + 0.02, (y_base + y_ceiling) / 2, "fit shape to a\nproper score ($X$-blind)",
        color=GREEN, fontsize=8, ha="left", va="center")

ax.set_xlim(0, 1); ax.set_ylim(0, 1)
ax.set_xticks([]); ax.set_yticks([])
ax.set_xlabel("coverage error of the set   (left $=$ exact)")
ax.set_ylabel("proper score $S$   (up $=$ better)")
ax.set_title("The coverage–score plane")
fig.savefig(os.path.join(FIG, "fig_plane.pdf"))
print("wrote", os.path.join(FIG, "fig_plane.pdf"))
plt.close(fig)
