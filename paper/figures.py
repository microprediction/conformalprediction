"""Generate all figures for the paper, reproducibly, into paper/figures/*.pdf.

Self-contained: needs only numpy / scipy / matplotlib, plus the validated synthetic
generators and time-series methods from ../benchmark (common.py, ts_methods.py), which
are pure-numpy (no MAPIE/crepes needed for these figures). Run:

    python figures.py
"""
from __future__ import annotations
import os, sys
import numpy as np
from scipy.stats import norm
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "benchmark"))
import common as C
import ts_methods as M

FIG = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(FIG, exist_ok=True)
plt.rcParams.update({
    "font.size": 10, "axes.titlesize": 10, "axes.labelsize": 10,
    "legend.fontsize": 8.5, "figure.dpi": 150, "savefig.bbox": "tight",
    "axes.grid": True, "grid.alpha": 0.25, "font.family": "serif",
})
ALPHA = 0.1
Zc = norm.ppf(1 - ALPHA / 2)
BLUE, GREEN, ORANGE, GREY = "#1f4ed8", "#15803d", "#c2410c", "#888888"


def conf_q(scores, alpha):
    s = np.sort(np.abs(np.asarray(scores)))
    n = len(s)
    k = int(np.ceil((n + 1) * (1 - alpha)))
    return np.inf if k > n else s[k - 1]


def truth(x):
    return np.sin(1.3 * x) * 2 + 3


def sigma_x(x):
    return 0.15 + 0.7 * x


# ---------------------------------------------------------------------------
def fig_orthogonality():
    """Prop 1: identical conformal set, arbitrary log-score."""
    rng = np.random.default_rng(0)
    y = rng.standard_normal(4000)
    q = conf_q(y, ALPHA)
    cov = np.mean(np.abs(y) <= q)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(8.2, 3.2))
    xs = np.linspace(-5, 5, 500)
    a1.hist(y, bins=60, density=True, color=GREY, alpha=0.35, label="outcomes $y$")
    for s, c, ls in [(0.5, ORANGE, "-"), (2.2, GREEN, "--")]:
        lab = f"$N(0,{s}^2)$:  logS$=${np.mean(norm.logpdf(y,0,s)):.2f}"
        a1.plot(xs, norm.pdf(xs, 0, s), c, ls=ls, lw=2, label=lab)
    a1.axvspan(-q, q, color=BLUE, alpha=0.12)
    a1.axvline(-q, color=BLUE, lw=1); a1.axvline(q, color=BLUE, lw=1)
    a1.set_title(f"fixed conformal set $[-q,q]$,  coverage $={cov*100:.1f}\\%$")
    a1.set_xlabel("$y$"); a1.set_ylabel("density"); a1.legend(loc="upper left")
    a1.set_xlim(-5, 5)
    ss = np.linspace(0.3, 3.0, 120)
    ls = [np.mean(norm.logpdf(y, 0, s)) for s in ss]
    a2.plot(ss, ls, BLUE, lw=2)
    a2.axvline(1.0, color=GREEN, ls=":", lw=1.5)
    a2.set_title("coverage $\\equiv 90\\%$ for every $s$")
    a2.set_xlabel("forecaster spread $s$"); a2.set_ylabel("mean log-score")
    a2.text(0.97, 0.05, "set & coverage\nfixed; log-score\nvaries freely",
            transform=a2.transAxes, ha="right", va="bottom", fontsize=8.5,
            bbox=dict(boxstyle="round", fc="white", ec="0.7"))
    fig.savefig(os.path.join(FIG, "fig_orthogonality.pdf"))
    plt.close(fig)
    return f"orthogonality: q={q:.3f} cov={cov:.3f} logS(0.6)={np.mean(norm.logpdf(y,0,0.6)):.2f} logS(1.8)={np.mean(norm.logpdf(y,0,1.8)):.2f}"


def _het_split(n=4000, seed=1):
    rng = np.random.default_rng(seed)
    x = rng.uniform(0, 4, n)
    y = truth(x) + sigma_x(x) * rng.standard_normal(n)
    o = np.argsort(rng.random(n))  # random permutation for splitting
    tr, ca, te = o[:n//2], o[n//2:3*n//4], o[3*n//4:]
    coef = np.polyfit(x[tr], y[tr], 3)
    mu = lambda z: np.polyval(coef, z)
    return x, y, tr, ca, te, mu


def fig_marginal_conditional():
    """Marginal-but-not-conditional coverage under heteroscedasticity."""
    x, y, tr, ca, te, mu = _het_split()
    q = conf_q(y[ca] - mu(x[ca]), ALPHA)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(8.4, 3.2))
    gx = np.linspace(0, 4, 200)
    a1.fill_between(gx, mu(gx) - q, mu(gx) + q, color=BLUE, alpha=0.13, label="conformal band")
    inside = np.abs(y[te] - mu(x[te])) <= q
    a1.scatter(x[te][inside], y[te][inside], s=5, color=GREEN, alpha=0.5)
    a1.scatter(x[te][~inside], y[te][~inside], s=7, color=ORANGE, alpha=0.8, label="missed")
    a1.plot(gx, mu(gx), BLUE, lw=2, label="$\\hat\\mu(x)$")
    a1.set_xlabel("$x$"); a1.set_ylabel("$y$"); a1.legend(loc="lower left", fontsize=8); a1.set_xlim(0, 4)
    a1.set_title("constant-width band, 90% marginal")
    nb = 14
    edges = np.linspace(0, 4, nb + 1); ctr = 0.5 * (edges[:-1] + edges[1:])
    cov = []
    for b in range(nb):
        m = (x[te] >= edges[b]) & (x[te] < edges[b+1])
        lo, hi = mu(x[te][m]) - q, mu(x[te][m]) + q
        cov.append(np.mean((y[te][m] >= lo) & (y[te][m] <= hi)) if m.any() else np.nan)
    a2.plot(ctr, cov, "o-", color=BLUE, ms=4)
    a2.axhline(1 - ALPHA, color="k", ls="--", lw=1, label="target 0.90")
    a2.set_ylim(0.5, 1.02); a2.set_xlabel("$x$"); a2.set_ylabel("local coverage")
    a2.legend(loc="lower left"); a2.set_title("over-covers easy $x$, under-covers hard $x$")
    fig.savefig(os.path.join(FIG, "fig_marginal_conditional.pdf"))
    plt.close(fig)
    return f"marg/cond: q={q:.2f} cov_lowx={cov[1]:.2f} cov_highx={cov[-1]:.2f}"


def fig_nogo():
    """Lemma 1(a): localizing to chase conditional coverage -> infinite length."""
    x, y, tr, ca, te, mu = _het_split(n=2600, seed=2)
    Bs = list(range(1, 101, 2))
    worst, finf = [], []
    rc, rt = y[ca] - mu(x[ca]), y[te] - mu(x[te])
    for B in Bs:
        edges = np.linspace(0, 4, B + 1)
        cov_bins, inf_pts, npts = [], 0, 0
        for b in range(B):
            mca = (x[ca] >= edges[b]) & (x[ca] < edges[b+1] + (1e-9 if b == B-1 else 0))
            mte = (x[te] >= edges[b]) & (x[te] < edges[b+1] + (1e-9 if b == B-1 else 0))
            qb = conf_q(rc[mca], ALPHA)
            if mte.any():
                covered = np.abs(rt[mte]) <= qb
                cov_bins.append(np.mean(covered))
                npts += mte.sum()
                if not np.isfinite(qb):
                    inf_pts += mte.sum()
        worst.append(np.nanmin(cov_bins) if cov_bins else np.nan)
        finf.append(inf_pts / max(npts, 1))
    fig, ax = plt.subplots(figsize=(6.2, 3.4))
    ax.plot(Bs, worst, "o-", color=GREEN, ms=3, label="worst-bin coverage")
    ax.axhline(1 - ALPHA, color="k", ls="--", lw=1)
    ax.set_xlabel("conditioning resolution (number of bins $B$)")
    ax.set_ylabel("worst-bin coverage", color=GREEN); ax.set_ylim(0, 1.05)
    ax2 = ax.twinx(); ax2.grid(False)
    ax2.plot(Bs, finf, "s-", color=ORANGE, ms=3, label="frac. intervals $=\\infty$")
    ax2.set_ylabel("fraction of intervals $=(-\\infty,\\infty)$", color=ORANGE); ax2.set_ylim(0, 1.05)
    ax.set_title("The price of conditional coverage")
    lines = ax.get_lines() + ax2.get_lines()
    ax.legend(lines, [l.get_label() for l in lines], loc="center right", fontsize=8)
    fig.savefig(os.path.join(FIG, "fig_nogo.pdf"))
    plt.close(fig)
    return f"nogo: B=1 worst={worst[0]:.2f} finf={finf[0]:.2f}; B=40 worst={worst[-1]:.2f} finf={finf[-1]:.2f}"


def fig_subgroup():
    """Lemma 1(b): distribution-free subgroup coverage = inflated flat band."""
    x, y, tr, ca, te, mu = _het_split(n=4000, seed=3)
    rc = y[ca] - mu(x[ca])
    gx = np.linspace(0, 4, 200)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(8.4, 3.2))
    # left: oracle adaptive vs flat inflated band (delta=0.2)
    delta = 0.2
    q_flat = conf_q(rc, ALPHA * delta)
    a1.scatter(x[te], y[te], s=4, color=GREY, alpha=0.35)
    a1.fill_between(gx, mu(gx) - Zc*sigma_x(gx), mu(gx) + Zc*sigma_x(gx),
                    color=GREEN, alpha=0.2, label="oracle adaptive ($\\sigma(x)$)")
    a1.fill_between(gx, mu(gx) - q_flat, mu(gx) + q_flat, color=ORANGE, alpha=0.0,
                    edgecolor=ORANGE, lw=1.5, label=f"flat band, level $1-\\alpha\\delta$ ($\\delta={delta}$)")
    a1.plot(gx, mu(gx) - q_flat, ORANGE, lw=1.3); a1.plot(gx, mu(gx) + q_flat, ORANGE, lw=1.3)
    a1.plot(gx, mu(gx), BLUE, lw=1.5); a1.set_xlim(0, 4)
    a1.set_xlabel("$x$"); a1.set_ylabel("$y$"); a1.legend(loc="upper left", fontsize=7.5)
    a1.set_title("adaptive vs. distribution-free flat band")
    # right: flat half-width vs delta diverges; oracle avg width reference
    ds = np.linspace(0.02, 1.0, 60)
    qf = [conf_q(rc, ALPHA * d) for d in ds]
    oracle_avg = np.mean(2 * Zc * sigma_x(x[te])) / 2  # half-width avg
    a2.plot(ds, qf, color=ORANGE, lw=2, label="flat band half-width")
    a2.axhline(oracle_avg, color=GREEN, ls="--", lw=1.3, label="oracle avg half-width")
    a2.set_xlabel("subgroup floor $\\delta$"); a2.set_ylabel("half-width")
    a2.invert_xaxis(); a2.legend(loc="upper left")
    a2.set_title("width diverges as $\\delta\\to 0$, never adapts")
    fig.savefig(os.path.join(FIG, "fig_subgroup.pdf"))
    plt.close(fig)
    return f"subgroup: q_flat(delta=0.2)={q_flat:.2f} oracle_avg_hw={oracle_avg:.2f}"


def fig_sharpness_gap():
    """Prop 2-3: CPS re-levels a single residual shape; oracle adapts. Gap = I(R;X)."""
    xgrid = np.linspace(0, 4, 400)
    # marginal residual density gbar(z) = E_x N(z;0,sigma(x))
    xs = np.linspace(0, 4, 400)
    zz = np.linspace(-8, 8, 600)
    gbar = np.mean([norm.pdf(zz, 0, sigma_x(xi)) for xi in xs], axis=0)
    fig, axes = plt.subplots(1, 2, figsize=(8.4, 3.2), sharey=True)
    for ax, xv, lab in [(axes[0], 0.4, "easy input ($x=0.4$)"), (axes[1], 3.4, "hard input ($x=3.4$)")]:
        ax.plot(zz, norm.pdf(zz, 0, sigma_x(xv)), GREEN, lw=2, label="true conditional $r(\\cdot\\mid x)$")
        ax.plot(zz, gbar, ORANGE, ls="--", lw=2, label="CPS single shape $\\bar r$")
        ax.set_title(lab); ax.set_xlabel("residual $r = y-\\hat\\mu(x)$"); ax.set_xlim(-8, 8)
        ax.legend(loc="upper right", fontsize=8)
    axes[0].set_ylabel("density")
    fig.suptitle("The CPS uses one residual shape everywhere; the oracle adapts.  "
                 "Regret $= I(R;X)$.", fontsize=10)
    fig.savefig(os.path.join(FIG, "fig_sharpness_gap.pdf"))
    plt.close(fig)
    return "sharpness_gap: drawn"


def _build_ts(seed=0):
    d = C.make_timeseries(T=3500, seed=seed)
    X, yy, nl = C.lag_features(d["y"], 12)
    sig = d["sigma"][nl:]; level = d["level"][nl:]
    FIT, CAL = 700, 1000
    A = np.column_stack([np.ones(len(yy)), X])
    beta, *_ = np.linalg.lstsq(A[:FIT], yy[:FIT], rcond=None)
    mu = A @ beta
    resid = yy - mu
    ts = slice(CAL, len(yy))
    mu_te, y_te, sig_te, level_te = mu[ts], yy[ts], sig[ts], level[ts]
    warm, resid_cal = resid[:CAL], resid[FIT:CAL]
    m = {}
    m["fixed split"] = (*M.fixed_split(mu_te, resid_cal, y_te, ALPHA), "cp")
    m["ACI"] = (*M.aci(mu_te, y_te, ALPHA, gamma=0.03, warm=warm), "cp")
    m["conformal PID"] = (*M.conformal_pid(mu_te, y_te, ALPHA, warm=warm), "cp")
    m["NexCP"] = (*M.nexcp(mu_te, y_te, ALPHA, warm=warm), "cp")
    lo, hi, _, _ = M.ewma_vol(mu_te, y_te, ALPHA, warm=warm); m["EWMA-vol"] = (lo, hi, "prob")
    lo, hi = C.gaussian_interval(level_te, sig_te, ALPHA); m["oracle"] = (lo, hi, "oracle")
    return m, y_te, sig_te


def fig_timeseries():
    """Under drift: fixed split collapses; adaptive conformal & a vol model recover."""
    m, y_te, _ = _build_ts(seed=0)
    fig, ax = plt.subplots(figsize=(7.6, 3.4))
    W = 100
    sel = [("fixed split", BLUE, "-"), ("ACI", ORANGE, "-"),
           ("conformal PID", GREEN, "-"), ("EWMA-vol", "#7c3aed", "-")]
    for nm, c, ls in sel:
        lo, hi, _ = m[nm]
        rc = C.rolling_coverage(lo, hi, y_te, W)
        ax.plot(np.arange(len(rc)), rc, c, ls=ls, lw=1.3, label=nm)
    ax.axhline(1 - ALPHA, color="k", ls="--", lw=1, label="target 0.90")
    ax.set_ylim(0.4, 1.02); ax.set_xlabel(f"test step (rolling coverage, window {W})")
    ax.set_ylabel("coverage"); ax.legend(ncol=3, loc="lower left", fontsize=8)
    ax.set_title("Coverage now, not on average (nonstationary series)")
    fig.savefig(os.path.join(FIG, "fig_timeseries.pdf"))
    plt.close(fig)
    return "timeseries: drawn"


def fig_plane():
    """The coverage--efficiency plane, populated by the time-series methods."""
    # average over seeds for stability
    rows = {}
    for seed in range(5):
        m, y_te, _ = _build_ts(seed)
        for nm, (lo, hi, fam) in m.items():
            ww = C.worst_window_coverage(lo, hi, y_te, 100)
            isc = C.interval_score(lo, hi, y_te, ALPHA)
            rows.setdefault(nm, {"fam": fam, "ww": [], "is": []})
            rows[nm]["ww"].append(ww); rows[nm]["is"].append(isc)
    col = {"cp": BLUE, "prob": GREEN, "oracle": ORANGE}
    from matplotlib.lines import Line2D
    from adjustText import adjust_text
    fig, ax = plt.subplots(figsize=(7.4, 5.0))
    texts = []
    for nm, r in rows.items():
        ww, isc = np.mean(r["ww"]), np.mean(r["is"])
        ax.scatter(ww, isc, color=col[r["fam"]], s=55, zorder=3)
        texts.append(ax.text(ww, isc, nm, fontsize=8, color=col[r["fam"]]))
    ax.axvline(1 - ALPHA, color="k", ls="--", lw=1)
    ax.set_xlabel("worst rolling-window coverage  ($\\to$ conditional coverage)")
    ax.set_ylabel("interval (Winkler) score  (lower is better)")
    ax.set_title("The coverage--score plane")
    adjust_text(texts, ax=ax, arrowprops=dict(arrowstyle="-", color="0.6", lw=0.5))
    ax.legend(handles=[Line2D([0],[0],marker="o",ls="",color=col[k],
              label={"cp":"conformal","prob":"probabilistic","oracle":"oracle"}[k]) for k in col],
              loc="lower left", fontsize=8)
    fig.savefig(os.path.join(FIG, "fig_plane.pdf"))
    plt.close(fig)
    return "plane: drawn"


if __name__ == "__main__":
    for fn in [fig_orthogonality, fig_marginal_conditional, fig_nogo, fig_subgroup,
               fig_sharpness_gap, fig_timeseries, fig_plane]:
        print(fn())
    print("figures written to", FIG)
