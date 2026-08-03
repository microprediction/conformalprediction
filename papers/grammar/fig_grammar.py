"""Figure for the grammar paper: the five duels under both scoring rules.

Improvement convention in both panels: bars to the right are better for the
first-named config. Log score improvement is the mean difference in nats per
observation. CRPS improvement is the mean difference in percent of the
location-baseline CRPS, sign-flipped so positive means lower CRPS. Win rates
annotate each bar. Numbers from skaters/benchmarks/gaussianize_chain.log
(701 series, final operator).
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

DUELS = [
    ("serial refit vs unconditional leaf\n(E vs D)",              +0.0530, 4.02, 75, 71),
    ("refit through vs no operator\n(E vs F)",        -0.1083, 1.00,  8, 65),
    ("pool with vs pool without\n(G vs H)",           +0.0121, 0.35, 31, 35),
    ("pool vs fixed raw pattern\n(G vs C)",           +0.2493, 4.58, 95, 77),
    ("smooth vs linear operator\n(E2 vs E)",          -0.0050, 0.01, 38, 39),
]

labels = [d[0] for d in DUELS][::-1]
ll = [d[1] for d in DUELS][::-1]
cr = [d[2] for d in DUELS][::-1]
wll = [d[3] for d in DUELS][::-1]
wcr = [d[4] for d in DUELS][::-1]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9.2, 3.4), sharey=True)
y = range(len(labels))

for ax, vals, wins, title, xlab in (
        (ax1, ll, wll, "log score", "improvement (nats per observation)"),
        (ax2, cr, wcr, "CRPS", "improvement (percent of baseline CRPS)")):
    colors = ["#2a7f4f" if v >= 0 else "#b3452c" for v in vals]
    ax.barh(list(y), vals, color=colors, height=0.62)
    ax.axvline(0.0, color="black", lw=0.8)
    ax.set_title(title, fontsize=11)
    ax.set_xlabel(xlab, fontsize=9)
    ax.tick_params(labelsize=9)
    span = max(abs(v) for v in vals)
    ax.set_xlim(-1.35 * span, 1.35 * span)
    for yi, v, w in zip(y, vals, wins):
        off = 0.04 * span if v >= 0 else -0.04 * span
        ax.text(v + off, yi, f"wins {w}%", va="center",
                ha="left" if v >= 0 else "right", fontsize=8)

ax1.set_yticks(list(y))
ax1.set_yticklabels(labels, fontsize=9)
fig.tight_layout()
fig.savefig(__file__.replace("fig_grammar.py", "fig_grammar.pdf"))
print("fig_grammar.pdf written")
